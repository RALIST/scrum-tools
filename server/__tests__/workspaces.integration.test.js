import request from 'supertest';
import { app as mainApp, server, io } from '../index.js'; // Import main app for setup, io/server for teardown
import { pool } from '../db/pool.js'; // Ensure initializePool is not imported
import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
// Import DB functions needed for direct setup/cleanup
import { createWorkspace, addWorkspaceMember } from '../db/workspaces.js';
// Removed unused velocityUtils import for integration test

// Helper function (copied from original test file)
const registerAndLoginUser = async (emailSuffix) => {
    const email = `ws_integ_user_${emailSuffix}_${Date.now()}@example.com`;
    const password = 'password123';
    const name = `WS Integ User ${emailSuffix}`;
    let regResponse = await request(mainApp)
        .post('/api/auth/register')
        .send({ email, password, name });
    if (regResponse.statusCode === 409) {
         const loginRes = await request(mainApp).post('/api/auth/login').send({ email, password });
         if (loginRes.statusCode === 200) return { token: loginRes.body.token, userId: loginRes.body.user.id, email: email };
         throw new Error(`Failed to login existing user ${email}`);
    }
    if (regResponse.statusCode !== 201) {
        throw new Error(`Registration failed for ${email}: ${regResponse.text}`);
    }
    return { token: regResponse.body.token, userId: regResponse.body.user.id, email: email };
};

describe('Workspaces Routes (Integration Tests)', () => {
  let ownerInfo;
  let memberInfo;
  let nonAdminInfo;
  let testWorkspaceId;
  let createdAuthBoardId; // For retro test
  let otherUserInfo;

  beforeAll(async () => {
    // Register users (still uses mainApp, seems less problematic)
    ownerInfo = await registerAndLoginUser('owner_integ');
    memberInfo = await registerAndLoginUser('member_integ');
    nonAdminInfo = await registerAndLoginUser('non_admin_integ');
    otherUserInfo = await registerAndLoginUser('other_integ');

    // Create workspace and add member directly via DB functions
    const workspaceName = `Test Integ Workspace ${Date.now()}`;
    const description = 'Initial workspace for integ tests';
    try {
      // Use the real createTeam function as the dependency
      // createWorkspace now uses internal pool and velocityUtils.createTeam
      const workspace = await createWorkspace(workspaceName, description, ownerInfo.userId);
      expect(workspace).toBeDefined();
      testWorkspaceId = workspace.id;

      // Add nonAdminInfo as a member directly
      await addWorkspaceMember(testWorkspaceId, nonAdminInfo.userId, 'member'); // addWorkspaceMember no longer takes pool
    } catch (err) {
      throw err; // Fail fast if setup fails
    }
  });

  afterAll(async () => {
    server.close(); // Close the server
    await pool.end();
  });

  // --- Tests using mainApp (except where rewritten) ---

  // Rewritten test to call DB function directly
  // Keep the original test using supertest, as it tests the full HTTP flow
  it('POST /api/workspaces - should create a new workspace', async () => {
    const workspaceName = `Test Workspace Create Integ ${Date.now()}`;
    const res = await request(mainApp)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerInfo.token}`)
      .send({ name: workspaceName, description: 'A workspace for testing create integ' });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('message', 'Workspace created successfully');
    expect(res.body).toHaveProperty('workspace');
    expect(res.body.workspace).toHaveProperty('name', workspaceName);
    expect(res.body.workspace).toHaveProperty('owner_id', ownerInfo.userId);

    // Cleanup this specific workspace
    const createdId = res.body.workspace.id;
     if (createdId) {
        await pool.query('DELETE FROM workspace_members WHERE workspace_id = $1', [createdId]);
        await pool.query('DELETE FROM teams WHERE workspace_id = $1 AND name = $2', [createdId, workspaceName]); // Cleanup default team (Correct table name)
        await pool.query('DELETE FROM workspaces WHERE id = $1', [createdId]);
     }
  });

  it('POST /api/workspaces - should fail without authentication', async () => {
    const res = await request(mainApp)
      .post('/api/workspaces')
      .send({ name: 'Unauthorized Workspace Integ' });
    expect(res.statusCode).toEqual(401);
  });

  it('POST /api/workspaces - should fail without workspace name', async () => {
    const res = await request(mainApp)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerInfo.token}`)
      .send({ description: 'Missing name integ' });
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Workspace name is required');
  });

  it('GET /api/workspaces - should get the user\'s workspaces', async () => {
    const res = await request(mainApp)
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${ownerInfo.token}`);

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    const foundWorkspace = res.body.find(ws => ws.id === testWorkspaceId);
    expect(foundWorkspace).toBeDefined();
    expect(foundWorkspace).toHaveProperty('name');
  });

  it('GET /api/workspaces/:id - should get a specific workspace', async () => {
    const res = await request(mainApp)
      .get(`/api/workspaces/${testWorkspaceId}`)
      .set('Authorization', `Bearer ${ownerInfo.token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('id', testWorkspaceId);
    expect(res.body).toHaveProperty('owner_id', ownerInfo.userId);
  });

  it('PUT /api/workspaces/:id - should update a workspace', async () => {
    const updatedName = `Updated Workspace Integ ${Date.now()}`;
    const res = await request(mainApp)
      .put(`/api/workspaces/${testWorkspaceId}`)
      .set('Authorization', `Bearer ${ownerInfo.token}`)
      .send({ name: updatedName, description: 'Updated description integ' });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('message', 'Workspace updated successfully');
    expect(res.body).toHaveProperty('workspace');
    expect(res.body.workspace).toHaveProperty('name', updatedName);
    expect(res.body.workspace).toHaveProperty('description', 'Updated description integ');
  });

  it('POST /api/workspaces/:id/members - should add a member to the workspace', async () => {
    const res = await request(mainApp)
      .post(`/api/workspaces/${testWorkspaceId}/members`)
      .set('Authorization', `Bearer ${ownerInfo.token}`)
      .send({ email: memberInfo.email, role: 'editor' });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('message', 'Member added successfully');
  });

  it('POST /api/workspaces/:id/members - should fail if user is already a member', async () => {
    // nonAdminInfo was added in beforeAll
    const res = await request(mainApp)
      .post(`/api/workspaces/${testWorkspaceId}/members`)
      .set('Authorization', `Bearer ${ownerInfo.token}`)
      .send({ email: nonAdminInfo.email, role: 'editor' }); // Try adding again

    expect(res.statusCode).toEqual(409);
    expect(res.body).toHaveProperty('error', 'User is already a member of this workspace.');
  });

  it('GET /api/workspaces/:id/members - should get workspace members', async () => {
    const res = await request(mainApp)
      .get(`/api/workspaces/${testWorkspaceId}/members`)
      .set('Authorization', `Bearer ${ownerInfo.token}`);

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3); // Owner + nonAdmin + member
    const owner = res.body.find(m => m.id === ownerInfo.userId);
    const member = res.body.find(m => m.id === memberInfo.userId);
    const nonAdmin = res.body.find(m => m.id === nonAdminInfo.userId);
    expect(owner).toBeDefined();
    expect(owner).toHaveProperty('role', 'admin');
    expect(member).toBeDefined();
    expect(member).toHaveProperty('role', 'editor');
    expect(nonAdmin).toBeDefined();
    expect(nonAdmin).toHaveProperty('role', 'member');
  });

  it('DELETE /api/workspaces/:id/members/:memberId - should remove a member', async () => {
     const res = await request(mainApp)
      .delete(`/api/workspaces/${testWorkspaceId}/members/${memberInfo.userId}`)
      .set('Authorization', `Bearer ${ownerInfo.token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('message', 'Member removed successfully');

    // Verify member was removed
    const resVerify = await request(mainApp)
      .get(`/api/workspaces/${testWorkspaceId}/members`)
      .set('Authorization', `Bearer ${ownerInfo.token}`);
    expect(resVerify.statusCode).toEqual(200);
    const member = resVerify.body.find(m => m.id === memberInfo.userId);
    expect(member).toBeUndefined();
  });

  it('GET /api/workspaces/:id/rooms - should get empty poker rooms list', async () => {
    const res = await request(mainApp)
      .get(`/api/workspaces/${testWorkspaceId}/rooms`)
      .set('Authorization', `Bearer ${ownerInfo.token}`);
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toEqual(0); // Assuming no rooms created yet
  });

  it('GET /api/workspaces/:id/retros - should get retro boards list', async () => {
    // Create a retro board via mainApp first
    const retroRes = await request(mainApp)
        .post('/api/retro')
        .set('Authorization', `Bearer ${ownerInfo.token}`)
        .send({ name: 'Workspace Retro Integ Test', workspaceId: testWorkspaceId });
    expect(retroRes.statusCode).toEqual(200);
    createdAuthBoardId = retroRes.body.boardId;

    const res = await request(mainApp)
      .get(`/api/workspaces/${testWorkspaceId}/retros`)
      .set('Authorization', `Bearer ${ownerInfo.token}`);
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const foundBoard = res.body.find(b => b.id === createdAuthBoardId);
    expect(foundBoard).toBeDefined();
    expect(foundBoard).toHaveProperty('name', 'Workspace Retro Integ Test');
  });

  it('GET /api/workspaces/:id/velocity-teams - should get default velocity team list', async () => {
    const res = await request(mainApp)
      .get(`/api/workspaces/${testWorkspaceId}/velocity-teams`)
      .set('Authorization', `Bearer ${ownerInfo.token}`);
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toEqual(1); // Default team created with workspace
    expect(res.body[0]).toHaveProperty('name'); // Name should match workspace name
  });

  // Invitation tests might be better as unit tests with mocks,
  // but include a basic success case here for integration.
  it('POST /api/workspaces/invitations/accept - should allow user to accept a valid invitation (integration)', async () => {
      // 1. Admin creates an invite token
      const inviteRes = await request(mainApp)
          .post(`/api/workspaces/${testWorkspaceId}/invitations`)
          .set('Authorization', `Bearer ${ownerInfo.token}`)
          .send({ roleToAssign: 'member' });
      expect(inviteRes.statusCode).toEqual(201);
      const token = inviteRes.body.token;
      expect(token).toBeDefined();

      // 2. Different user accepts the invitation
      const acceptRes = await request(mainApp)
          .post('/api/workspaces/invitations/accept')
          .set('Authorization', `Bearer ${otherUserInfo.token}`) // Use a different user's token
          .send({ token });
      expect(acceptRes.statusCode).toEqual(200);
      expect(acceptRes.body).toHaveProperty('message', 'Successfully joined workspace!');
      expect(acceptRes.body).toHaveProperty('workspaceId', testWorkspaceId);

      // 3. Verify the user is now a member
      const membersRes = await request(mainApp)
          .get(`/api/workspaces/${testWorkspaceId}/members`)
          .set('Authorization', `Bearer ${ownerInfo.token}`);
      const newMember = membersRes.body.find(m => m.id === otherUserInfo.userId);
      expect(newMember).toBeDefined();
      expect(newMember).toHaveProperty('role', 'member');
  });

});
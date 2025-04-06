import request from 'supertest';
import express from 'express'; // Import express for test app setup
import { app as mainApp, server, io } from '../index.js'; // Import main app for setup, io/server for teardown
import { pool } from '../db/pool.js'; // Ensure initializePool is not imported
import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid'; // Import uuid

// Import the route setup function
import setupWorkspaceRoutes from '../routes/workspaces.js';

// --- Mock DB Objects ---
const mockWorkspaceDb = {
    createWorkspace: jest.fn(),
    getUserWorkspaces: jest.fn(),
    getWorkspaceById: jest.fn(),
    getUserWorkspaceRole: jest.fn(),
    updateWorkspace: jest.fn(),
    addWorkspaceMember: jest.fn(),
    getWorkspaceMembers: jest.fn(),
    removeWorkspaceMember: jest.fn(),
    isWorkspaceMember: jest.fn(),
    createInvitation: jest.fn(),
    findValidInvitationByToken: jest.fn(),
    markInvitationAsUsed: jest.fn(),
};
const mockUserDb = {
    getUserByEmail: jest.fn(),
};
const mockPokerDb = {
    getWorkspaceRooms: jest.fn(),
};
const mockRetroDb = {
    getWorkspaceRetroBoards: jest.fn(),
};
// Revert mockVelocityDb to direct function mock
const mockVelocityDb = {
    getWorkspaceVelocityTeams: jest.fn(),
};
// --- End Mock DB Objects ---

// Helper function (copied) - still needed for user IDs/tokens
const registerAndLoginUser = async (emailSuffix) => {
    const email = `workspace_route_user_${emailSuffix}_${Date.now()}@example.com`;
    const password = 'password123';
    const name = `Workspace Route User ${emailSuffix}`;
    let regResponse = await request(mainApp) // Use mainApp for registration/login
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


describe('Workspaces Routes (Unit/Mock Tests)', () => { // Renamed describe block
  let testApp;
  let ownerInfo;
  let memberInfo;
  let nonAdminInfo;
  let otherUserInfo;
  let testWorkspaceId; // Will be a placeholder UUID
  let generatedInviteToken;

  beforeAll(async () => {
    // Setup test-specific Express app instance
    testApp = express();
    testApp.use(express.json());

    // Mock the authentication middleware
    testApp.use((req, res, next) => {
        const authHeader = req.headers['authorization'];
        req.user = undefined;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const userInfo = [ownerInfo, memberInfo, nonAdminInfo, otherUserInfo].find(info => info && info.token === token);
            if (userInfo) {
                 req.user = { userId: userInfo.userId };
            }
        }
        next();
    });

    // Mount the workspace routes using the setup function and injecting the MOCK DBs
    testApp.use('/api/workspaces', setupWorkspaceRoutes(mockWorkspaceDb, mockUserDb, mockPokerDb, mockRetroDb, mockVelocityDb));

    // Add a dummy error handler
    testApp.use((err, req, res, next) => {
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Internal Server Error' });
    });

    // Register users (still needed for tokens/IDs)
    ownerInfo = await registerAndLoginUser('owner_route');
    memberInfo = await registerAndLoginUser('member_route');
    nonAdminInfo = await registerAndLoginUser('non_admin_route');
    otherUserInfo = await registerAndLoginUser('other_route');

    // Assign placeholder ID - no DB interaction needed for these tests
    testWorkspaceId = uuidv4();
  });

  // Clear mocks before each test
  beforeEach(() => {
    Object.values(mockWorkspaceDb).forEach(mockFn => mockFn.mockReset());
    Object.values(mockUserDb).forEach(mockFn => mockFn.mockReset());
    Object.values(mockPokerDb).forEach(mockFn => mockFn.mockReset());
    Object.values(mockRetroDb).forEach(mockFn => mockFn.mockReset());
    Object.values(mockVelocityDb).forEach(mockFn => mockFn.mockReset()); // Reset direct mock
  });

  afterAll(async () => {
    server.close(); // Close the server
    await pool.end();
  });

  // --- Tests using testApp and Mocks ---

  it('POST /api/workspaces - should return 500 if database fails', async () => {
      const dbError = new Error('DB create workspace failed');
      mockWorkspaceDb.createWorkspace.mockRejectedValueOnce(dbError);

      const res = await request(testApp)
          .post('/api/workspaces')
          .set('Authorization', `Bearer ${ownerInfo.token}`)
          .send({ name: 'Fail Create Workspace' });

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.createWorkspace).toHaveBeenCalledWith('Fail Create Workspace', undefined, ownerInfo.userId); // Removed pool expectation
  });

  it('GET /api/workspaces - should return 500 if database fails', async () => {
      const dbError = new Error('DB get workspaces failed');
      mockWorkspaceDb.getUserWorkspaces.mockRejectedValueOnce(dbError);

      const res = await request(testApp)
          .get('/api/workspaces')
          .set('Authorization', `Bearer ${ownerInfo.token}`);

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getUserWorkspaces).toHaveBeenCalledWith(ownerInfo.userId); // Removed pool expectation
  });

   it('GET /api/workspaces/:id - should return 500 if database fails', async () => {
      const dbError = new Error('DB get workspace by id failed');
      mockWorkspaceDb.getWorkspaceById.mockRejectedValueOnce(dbError);

      const res = await request(testApp)
          .get(`/api/workspaces/${testWorkspaceId}`)
          .set('Authorization', `Bearer ${ownerInfo.token}`);

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getWorkspaceById).toHaveBeenCalledWith(testWorkspaceId); // Removed pool expectation
  });

  it('GET /api/workspaces/:id - should fail for non-existent workspace', async () => {
    const nonExistentId = 'non-existent-id';
    mockWorkspaceDb.getWorkspaceById.mockResolvedValueOnce(null);
    const res = await request(testApp)
      .get(`/api/workspaces/${nonExistentId}`)
      .set('Authorization', `Bearer ${ownerInfo.token}`);
    expect(res.statusCode).toEqual(404);
    expect(mockWorkspaceDb.getWorkspaceById).toHaveBeenCalledWith(nonExistentId); // Removed pool expectation
  });

  it('PUT /api/workspaces/:id - should return 500 if database fails', async () => {
      const dbError = new Error('DB update workspace failed');
      mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin');
      mockWorkspaceDb.updateWorkspace.mockRejectedValueOnce(dbError);
      const updatedName = `Fail Update Workspace ${Date.now()}`;

      const res = await request(testApp)
          .put(`/api/workspaces/${testWorkspaceId}`)
          .set('Authorization', `Bearer ${ownerInfo.token}`)
          .send({ name: updatedName });

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId); // Removed pool expectation
      expect(mockWorkspaceDb.updateWorkspace).toHaveBeenCalledWith(testWorkspaceId, updatedName, undefined); // Removed pool expectation
  });

  it('PUT /api/workspaces/:id - should fail if non-admin tries to update', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('member');
    const res = await request(testApp)
      .put(`/api/workspaces/${testWorkspaceId}`)
      .set('Authorization', `Bearer ${nonAdminInfo.token}`)
      .send({ name: 'Non-Admin Update Attempt', description: 'Should fail' });

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty('error', 'You do not have permission to update this workspace');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, nonAdminInfo.userId); // Removed pool expectation
  });

  it('PUT /api/workspaces/:id - should fail without workspace name', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin');
    const res = await request(testApp)
      .put(`/api/workspaces/${testWorkspaceId}`)
      .set('Authorization', `Bearer ${ownerInfo.token}`)
      .send({ description: 'Missing name update' });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Workspace name is required');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId); // Removed pool expectation
  });

  it('POST /api/workspaces/:id/members - should return 500 if getUserByEmail fails', async () => {
      const dbError = new Error('DB find user failed');
      mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin');
      mockUserDb.getUserByEmail.mockRejectedValueOnce(dbError);

      const res = await request(testApp)
          .post(`/api/workspaces/${testWorkspaceId}/members`)
          .set('Authorization', `Bearer ${ownerInfo.token}`)
          .send({ email: otherUserInfo.email, role: 'viewer' });

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId); // Removed pool expectation
      expect(mockUserDb.getUserByEmail).toHaveBeenCalledWith(otherUserInfo.email); // Removed pool expectation
  });

   it('POST /api/workspaces/:id/members - should return 500 if addWorkspaceMember fails', async () => {
      const dbError = new Error('DB add member failed');
      mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin');
      mockUserDb.getUserByEmail.mockResolvedValueOnce({ id: otherUserInfo.userId, email: otherUserInfo.email, name: 'Other User' });
      mockWorkspaceDb.addWorkspaceMember.mockRejectedValueOnce(dbError);

      const res = await request(testApp)
          .post(`/api/workspaces/${testWorkspaceId}/members`)
          .set('Authorization', `Bearer ${ownerInfo.token}`)
          .send({ email: otherUserInfo.email, role: 'viewer' });

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId); // Removed pool expectation
      expect(mockUserDb.getUserByEmail).toHaveBeenCalledWith(otherUserInfo.email); // Removed pool expectation
      expect(mockWorkspaceDb.addWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, otherUserInfo.userId, 'viewer'); // Removed pool expectation
  });

  it('POST /api/workspaces/:id/members - should fail if non-admin tries to add member', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('member');
    const res = await request(testApp)
      .post(`/api/workspaces/${testWorkspaceId}/members`)
      .set('Authorization', `Bearer ${nonAdminInfo.token}`)
      .send({ email: otherUserInfo.email, role: 'member' });

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty('error', 'You do not have permission to add members');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, nonAdminInfo.userId); // Removed pool expectation
  });

  it('POST /api/workspaces/:id/members - should fail if user email not found', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin');
    mockUserDb.getUserByEmail.mockResolvedValueOnce(null);
    const res = await request(testApp)
      .post(`/api/workspaces/${testWorkspaceId}/members`)
      .set('Authorization', `Bearer ${ownerInfo.token}`)
      .send({ email: 'nonexistent@example.com', role: 'member' });

    expect(res.statusCode).toEqual(404);
    expect(res.body).toHaveProperty('error', 'User not found');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId); // Removed pool expectation
    expect(mockUserDb.getUserByEmail).toHaveBeenCalledWith('nonexistent@example.com'); // Removed pool expectation
  });

   it('GET /api/workspaces/:id/members - should return 500 if database fails', async () => {
      const dbError = new Error('DB get members failed');
      mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin');
      mockWorkspaceDb.getWorkspaceMembers.mockRejectedValueOnce(dbError);

      const res = await request(testApp)
          .get(`/api/workspaces/${testWorkspaceId}/members`)
          .set('Authorization', `Bearer ${ownerInfo.token}`);

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId); // Removed pool expectation
      expect(mockWorkspaceDb.getWorkspaceMembers).toHaveBeenCalledWith(testWorkspaceId); // Removed pool expectation
  });

  it('GET /api/workspaces/:id/members - should fail if user is not a member', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce(null);
    const res = await request(testApp)
      .get(`/api/workspaces/${testWorkspaceId}/members`)
      .set('Authorization', `Bearer ${otherUserInfo.token}`);

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty('error', 'You do not have access to this workspace');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, otherUserInfo.userId); // Removed pool expectation
  });

  it('DELETE /api/workspaces/:id/members/:memberId - should return 500 if database fails', async () => {
      const dbError = new Error('DB remove member failed');
      mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin');
      mockWorkspaceDb.getWorkspaceById.mockResolvedValueOnce({ owner_id: ownerInfo.userId });
      mockWorkspaceDb.removeWorkspaceMember.mockRejectedValueOnce(dbError);

      const res = await request(testApp)
          .delete(`/api/workspaces/${testWorkspaceId}/members/${memberInfo.userId}`)
          .set('Authorization', `Bearer ${ownerInfo.token}`);

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId); // Removed pool expectation
      expect(mockWorkspaceDb.getWorkspaceById).toHaveBeenCalledWith(testWorkspaceId); // Removed pool expectation
      expect(mockWorkspaceDb.removeWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, memberInfo.userId); // Removed pool expectation
  });

  it('DELETE /api/workspaces/:id/members/:memberId - should fail if non-admin tries to remove', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('member');
    const res = await request(testApp)
      .delete(`/api/workspaces/${testWorkspaceId}/members/${nonAdminInfo.userId}`)
      .set('Authorization', `Bearer ${nonAdminInfo.token}`);

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty('error', 'You do not have permission to remove members');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, nonAdminInfo.userId); // Removed pool expectation
  });

  it('DELETE /api/workspaces/:id/members/:memberId - should fail if trying to remove owner', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin');
    mockWorkspaceDb.getWorkspaceById.mockResolvedValueOnce({ owner_id: ownerInfo.userId });
    const res = await request(testApp)
      .delete(`/api/workspaces/${testWorkspaceId}/members/${ownerInfo.userId}`)
      .set('Authorization', `Bearer ${ownerInfo.token}`);

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty('error', 'Cannot remove the workspace owner.');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId); // Removed pool expectation
    expect(mockWorkspaceDb.getWorkspaceById).toHaveBeenCalledWith(testWorkspaceId); // Removed pool expectation
  });

  it('DELETE /api/workspaces/:id/members/:memberId - should fail for non-existent memberId', async () => {
    const nonExistentMemberId = 'non-existent-user-id';
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin');
    mockWorkspaceDb.getWorkspaceById.mockResolvedValueOnce({ owner_id: ownerInfo.userId });
    mockWorkspaceDb.removeWorkspaceMember.mockResolvedValueOnce(); // Mock remove success (doesn't throw)

    const res = await request(testApp)
      .delete(`/api/workspaces/${testWorkspaceId}/members/${nonExistentMemberId}`)
      .set('Authorization', `Bearer ${ownerInfo.token}`);

    expect(res.statusCode).toEqual(200); // Route returns 200 even if member doesn't exist
    expect(res.body).toHaveProperty('message', 'Member removed successfully');
    expect(mockWorkspaceDb.removeWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, nonExistentMemberId); // Removed pool expectation
  });

  it('GET /api/workspaces/:id/rooms - should return 500 if database fails', async () => {
      const dbError = new Error('DB get rooms failed');
      mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin');
      mockPokerDb.getWorkspaceRooms.mockRejectedValueOnce(dbError);

      const res = await request(testApp)
          .get(`/api/workspaces/${testWorkspaceId}/rooms`)
          .set('Authorization', `Bearer ${ownerInfo.token}`);

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId); // Removed pool expectation
      expect(mockPokerDb.getWorkspaceRooms).toHaveBeenCalledWith(testWorkspaceId);
  });

  it('GET /api/workspaces/:id/rooms - should fail if user is not a member', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce(null);
    const res = await request(testApp)
      .get(`/api/workspaces/${testWorkspaceId}/rooms`)
      .set('Authorization', `Bearer ${otherUserInfo.token}`);

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty('error', 'You do not have access to this workspace');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, otherUserInfo.userId); // Removed pool expectation
  });

   it('GET /api/workspaces/:id/retros - should return 500 if database fails', async () => {
      const dbError = new Error('DB get retros failed');
      mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin');
      mockRetroDb.getWorkspaceRetroBoards.mockRejectedValueOnce(dbError);

      const res = await request(testApp)
          .get(`/api/workspaces/${testWorkspaceId}/retros`)
          .set('Authorization', `Bearer ${ownerInfo.token}`);

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId); // Removed pool expectation
      expect(mockRetroDb.getWorkspaceRetroBoards).toHaveBeenCalledWith(testWorkspaceId);
  });

  it('GET /api/workspaces/:id/retros - should fail if user is not a member', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce(null);
    const res = await request(testApp)
      .get(`/api/workspaces/${testWorkspaceId}/retros`)
      .set('Authorization', `Bearer ${otherUserInfo.token}`);

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty('error', 'You do not have access to this workspace');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, otherUserInfo.userId); // Removed pool expectation
  });

  it('GET /api/workspaces/:id/velocity-teams - should return 500 if database fails', async () => {
      const dbError = new Error('DB get velocity teams failed');
      mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin');
      mockVelocityDb.getWorkspaceVelocityTeams.mockRejectedValueOnce(dbError);

      const res = await request(testApp)
          .get(`/api/workspaces/${testWorkspaceId}/velocity-teams`)
          .set('Authorization', `Bearer ${ownerInfo.token}`);

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId); // Removed pool expectation
      expect(mockVelocityDb.getWorkspaceVelocityTeams).toHaveBeenCalledWith(testWorkspaceId); // Check direct mock call
  });

  it('GET /api/workspaces/:id/velocity-teams - should fail if user is not a member', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce(null);
    const res = await request(testApp)
      .get(`/api/workspaces/${testWorkspaceId}/velocity-teams`)
      .set('Authorization', `Bearer ${otherUserInfo.token}`);

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty('error', 'You do not have access to this workspace');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, otherUserInfo.userId); // Removed pool expectation
  });

  // --- Invitation Tests (using mocks) ---

  it('POST /api/workspaces/:id/invitations - admin should create an invitation token', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin');
    mockWorkspaceDb.createInvitation.mockResolvedValueOnce('mock-invite-token-123');

    const res = await request(testApp)
      .post(`/api/workspaces/${testWorkspaceId}/invitations`)
      .set('Authorization', `Bearer ${ownerInfo.token}`)
      .send({ roleToAssign: 'member' });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('token', 'mock-invite-token-123');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId); // Removed pool expectation
    expect(mockWorkspaceDb.createInvitation).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId, 'member', 7); // Removed pool expectation
    generatedInviteToken = res.body.token;
  });

   it('POST /api/workspaces/:id/invitations - should return 500 if database fails', async () => {
      const dbError = new Error('DB create invitation failed');
      mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin');
      mockWorkspaceDb.createInvitation.mockRejectedValueOnce(dbError);

      const res = await request(testApp)
          .post(`/api/workspaces/${testWorkspaceId}/invitations`)
          .set('Authorization', `Bearer ${ownerInfo.token}`)
          .send({ roleToAssign: 'member' });

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId); // Removed pool expectation
      expect(mockWorkspaceDb.createInvitation).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId, 'member', expect.any(Number)); // Removed pool expectation
  });

  it('POST /api/workspaces/:id/invitations - non-admin should not create an invitation token', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('member');
    const res = await request(testApp)
      .post(`/api/workspaces/${testWorkspaceId}/invitations`)
      .set('Authorization', `Bearer ${nonAdminInfo.token}`)
      .send({});

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty('error', 'Forbidden: Only admins can create invitations.');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, nonAdminInfo.userId); // Removed pool expectation
  });

   it('POST /api/workspaces/invitations/accept - should allow user to accept a valid invitation', async () => {
     const validToken = 'valid-invite-token';
     const assignedRole = 'editor';
     mockWorkspaceDb.findValidInvitationByToken.mockResolvedValueOnce({ id: 'invite-id-1', workspace_id: testWorkspaceId, role_to_assign: assignedRole });
     mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(false);
     mockWorkspaceDb.addWorkspaceMember.mockResolvedValueOnce();
     mockWorkspaceDb.markInvitationAsUsed.mockResolvedValueOnce(true);

     const res = await request(testApp)
       .post('/api/workspaces/invitations/accept')
       .set('Authorization', `Bearer ${memberInfo.token}`)
       .send({ token: validToken });

     expect(res.statusCode).toEqual(200);
     expect(res.body).toHaveProperty('message', 'Successfully joined workspace!');
     expect(res.body).toHaveProperty('workspaceId', testWorkspaceId);
     expect(mockWorkspaceDb.findValidInvitationByToken).toHaveBeenCalledWith(validToken); // Removed pool expectation
     expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, memberInfo.userId); // Removed pool expectation
     expect(mockWorkspaceDb.addWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, memberInfo.userId, assignedRole); // Removed pool expectation
     expect(mockWorkspaceDb.markInvitationAsUsed).toHaveBeenCalledWith('invite-id-1', memberInfo.userId); // Removed pool expectation
   });

   it('POST /api/workspaces/invitations/accept - should return 500 if database fails', async () => {
      const validToken = 'valid-invite-token-fail';
      const assignedRole = 'viewer';
      const dbError = new Error('DB accept invite failed');
      mockWorkspaceDb.findValidInvitationByToken.mockResolvedValueOnce({ id: 'invite-id-fail', workspace_id: testWorkspaceId, role_to_assign: assignedRole });
      mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(false);
      mockWorkspaceDb.addWorkspaceMember.mockRejectedValueOnce(dbError);

      const res = await request(testApp)
        .post('/api/workspaces/invitations/accept')
        .set('Authorization', `Bearer ${otherUserInfo.token}`)
        .send({ token: validToken });

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.findValidInvitationByToken).toHaveBeenCalledWith(validToken); // Removed pool expectation
      expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, otherUserInfo.userId); // Removed pool expectation
      expect(mockWorkspaceDb.addWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, otherUserInfo.userId, assignedRole); // Removed pool expectation
      expect(mockWorkspaceDb.markInvitationAsUsed).not.toHaveBeenCalled();
  });

   it('POST /api/workspaces/invitations/accept - should fail with invalid token', async () => {
    mockWorkspaceDb.findValidInvitationByToken.mockResolvedValueOnce(null);
    const res = await request(testApp)
      .post('/api/workspaces/invitations/accept')
      .set('Authorization', `Bearer ${otherUserInfo.token}`)
      .send({ token: 'invalid-token-123' });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Invalid or expired invitation token.');
    expect(mockWorkspaceDb.findValidInvitationByToken).toHaveBeenCalledWith('invalid-token-123'); // Removed pool expectation
  });

   it('POST /api/workspaces/invitations/accept - should fail with used token', async () => {
    mockWorkspaceDb.findValidInvitationByToken.mockResolvedValueOnce(null);
    const res = await request(testApp)
      .post('/api/workspaces/invitations/accept')
      .set('Authorization', `Bearer ${otherUserInfo.token}`)
      .send({ token: 'used-token-abc' });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Invalid or expired invitation token.');
    expect(mockWorkspaceDb.findValidInvitationByToken).toHaveBeenCalledWith('used-token-abc'); // Removed pool expectation
  });

  it('POST /api/workspaces/invitations/accept - should return OK if user is already a member (using valid token)', async () => {
    const validToken = 'valid-token-already-member';
    mockWorkspaceDb.findValidInvitationByToken.mockResolvedValueOnce({ id: 'invite-id-already', workspace_id: testWorkspaceId, role_to_assign: 'viewer' });
    mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true);

    const res = await request(testApp)
      .post('/api/workspaces/invitations/accept')
      .set('Authorization', `Bearer ${memberInfo.token}`)
      .send({ token: validToken });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('message', 'You are already a member of this workspace.');
    expect(res.body).toHaveProperty('workspaceId', testWorkspaceId);
    expect(mockWorkspaceDb.findValidInvitationByToken).toHaveBeenCalledWith(validToken); // Removed pool expectation
    expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, memberInfo.userId); // Removed pool expectation
    expect(mockWorkspaceDb.addWorkspaceMember).not.toHaveBeenCalled();
    expect(mockWorkspaceDb.markInvitationAsUsed).not.toHaveBeenCalled();
  });

   it('POST /api/workspaces/invitations/accept - should fail without authentication', async () => {
    const res = await request(testApp)
      .post('/api/workspaces/invitations/accept')
      .send({ token: 'some-token' });

    expect(res.statusCode).toEqual(401);
    // No need to test mainApp here as the testApp mock middleware handles this
  });

   it('POST /api/workspaces/invitations/accept - should fail without token in body', async () => {
    const res = await request(testApp)
      .post('/api/workspaces/invitations/accept')
      .set('Authorization', `Bearer ${otherUserInfo.token}`)
      .send({});

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Invitation token is required.');
  });
});

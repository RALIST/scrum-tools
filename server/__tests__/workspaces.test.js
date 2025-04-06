import request from 'supertest';
import express from 'express'; // Import express for test app setup
import { app as mainApp, server, io } from '../index.js'; // Import main app for setup, io/server for teardown
import { pool } from '../db/pool.js';
// Import necessary functions from Jest globals for ESM
import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'; // Use beforeEach for mock resets

// Import the route setup function
import setupWorkspaceRoutes from '../routes/workspaces.js';
// NOTE: We DO NOT import the actual DB functions here anymore

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
const mockVelocityDb = {
    getWorkspaceVelocityTeams: jest.fn(),
};
// --- End Mock DB Objects ---

// --- Test Express App Setup ---
const testApp = express();
testApp.use(express.json()); // Add middleware needed by routes

// Mock the authentication middleware for testApp requests needing req.user
// This is a simplified mock; adjust if more complex user data is needed
// Simplified mock authentication middleware for testApp
testApp.use((req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        // If any Bearer token is present, mock a generic user ID.
        // Specific user ID checks will happen in the mock function assertions.
        req.user = { userId: 'mock-user-id-from-token' };
    }
    next();
});

// Mount the workspace routes using the setup function and injecting the MOCK DBs
testApp.use('/api/workspaces', setupWorkspaceRoutes(mockWorkspaceDb, mockUserDb, mockPokerDb, mockRetroDb, mockVelocityDb));

// Add a dummy error handler for testing 500 errors on testApp
testApp.use((err, req, res, next) => {
    console.error("Test App Error Handler:", err.message); // Log error in test context
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Internal Server Error' });
});
// --- End Test Express App Setup ---


// Helper function to register/login a user and get token (uses mainApp)
const registerAndLoginUser = async (emailSuffix) => {
    const email = `workspace_user_${emailSuffix}_${Date.now()}@example.com`;
    const password = 'password123';
    const name = `Workspace User ${emailSuffix}`;
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


describe('Workspaces Routes', () => {
  // Use global variables defined outside describe if needed by the mock middleware above
  // let ownerInfo; // { token, userId, email } ... etc.
  // These are now defined globally for the mock middleware to access them
  let ownerInfo;
  let memberInfo;
  let nonAdminInfo;
  let otherUserInfo;
  let testWorkspaceId;
  let generatedInviteToken; // To store the generated invite token


  // Register and login users before running workspace tests (uses mainApp)
  beforeAll(async () => {
    ownerInfo = await registerAndLoginUser('owner');
    memberInfo = await registerAndLoginUser('member');
    nonAdminInfo = await registerAndLoginUser('non_admin');
    otherUserInfo = await registerAndLoginUser('other');

    // Create initial workspace using the API (relies on actual DB via mainApp)
    const workspaceName = `Test Workspace ${Date.now()}`;
    const res = await request(mainApp)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerInfo.token}`)
      .send({ name: workspaceName, description: 'Initial workspace' });
    expect(res.statusCode).toEqual(201);
    testWorkspaceId = res.body.workspace.id;

    // Add user 3 (nonAdminInfo) as a member for certain tests (relies on actual DB via mainApp)
     await request(mainApp)
       .post(`/api/workspaces/${testWorkspaceId}/members`)
       .set('Authorization', `Bearer ${ownerInfo.token}`)
       .send({ email: nonAdminInfo.email, role: 'member' });
  });

  // Clear mocks before each test
  beforeEach(() => {
    // Iterate over mock objects and reset each function
    Object.values(mockWorkspaceDb).forEach(mockFn => mockFn.mockReset());
    Object.values(mockUserDb).forEach(mockFn => mockFn.mockReset());
    Object.values(mockPokerDb).forEach(mockFn => mockFn.mockReset());
    Object.values(mockRetroDb).forEach(mockFn => mockFn.mockReset());
    Object.values(mockVelocityDb).forEach(mockFn => mockFn.mockReset());
  });

  // Close the server and database pool after all tests are done
  afterAll(async () => {
    io.close(); // Close Socket.IO server
    await new Promise(resolve => server.close(resolve)); // Close the HTTP server
    await pool.end(); // Close DB pool
  });

  // Test creating a workspace (Success path - uses mainApp)
  it('POST /api/workspaces - should create a new workspace', async () => {
    const workspaceName = `Test Workspace Create ${Date.now()}`;
    const res = await request(mainApp) // Use mainApp for success path
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerInfo.token}`)
      .send({ name: workspaceName, description: 'A workspace for testing create' });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('message', 'Workspace created successfully');
    expect(res.body).toHaveProperty('workspace');
    expect(res.body.workspace).toHaveProperty('name', workspaceName);
    expect(res.body.workspace).toHaveProperty('owner_id', ownerInfo.userId);
  });

  // Test creating a workspace (DB failure - uses testApp with mock)
  it('POST /api/workspaces - should return 500 if database fails', async () => {
      const dbError = new Error('DB create workspace failed');
      mockWorkspaceDb.createWorkspace.mockRejectedValueOnce(dbError); // Configure mock

      const res = await request(testApp) // Use testApp
          .post('/api/workspaces')
          .set('Authorization', `Bearer ${ownerInfo.token}`) // Mock middleware will add req.user
          .send({ name: 'Fail Create Workspace' });

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.createWorkspace).toHaveBeenCalled(); // Check mock call
  });


  it('POST /api/workspaces - should fail without authentication', async () => {
    const res = await request(mainApp) // Use mainApp for auth middleware check
      .post('/api/workspaces')
      .send({ name: 'Unauthorized Workspace' });
    expect(res.statusCode).toEqual(401);
  });

  it('POST /api/workspaces - should fail without workspace name', async () => {
    const res = await request(mainApp) // Use mainApp for validation check
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${ownerInfo.token}`)
      .send({ description: 'Missing name' });
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Workspace name is required');
  });

  // Test getting user's workspaces (Success path - uses mainApp)
  it('GET /api/workspaces - should get the user\'s workspaces', async () => {
    const res = await request(mainApp) // Use mainApp
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${ownerInfo.token}`);

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    const foundWorkspace = res.body.find(ws => ws.id === testWorkspaceId);
    expect(foundWorkspace).toBeDefined();
    expect(foundWorkspace).toHaveProperty('name');
  });

  // Test getting user's workspaces (DB failure - uses testApp with mock)
  it('GET /api/workspaces - should return 500 if database fails', async () => {
      const dbError = new Error('DB get workspaces failed');
      mockWorkspaceDb.getUserWorkspaces.mockRejectedValueOnce(dbError); // Configure mock

      const res = await request(testApp) // Use testApp
          .get('/api/workspaces')
          .set('Authorization', `Bearer ${ownerInfo.token}`); // Mock middleware adds req.user

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getUserWorkspaces).toHaveBeenCalledWith(ownerInfo.userId); // Check mock call
  });

  // Test getting a specific workspace (Success path - uses mainApp)
  it('GET /api/workspaces/:id - should get a specific workspace', async () => {
    const res = await request(mainApp) // Use mainApp
      .get(`/api/workspaces/${testWorkspaceId}`)
      .set('Authorization', `Bearer ${ownerInfo.token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('id', testWorkspaceId);
    expect(res.body).toHaveProperty('owner_id', ownerInfo.userId);
  });

   // Test getting a specific workspace (DB failure - uses testApp with mock)
   it('GET /api/workspaces/:id - should return 500 if database fails', async () => {
      const dbError = new Error('DB get workspace by id failed');
      mockWorkspaceDb.getWorkspaceById.mockRejectedValueOnce(dbError); // Configure mock

      const res = await request(testApp) // Use testApp
          .get(`/api/workspaces/${testWorkspaceId}`)
          .set('Authorization', `Bearer ${ownerInfo.token}`); // Mock middleware adds req.user

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      // The route only calls getWorkspaceById with workspaceId
      expect(mockWorkspaceDb.getWorkspaceById).toHaveBeenCalledWith(testWorkspaceId); // Check mock call
  });


  it('GET /api/workspaces/:id - should fail for non-existent workspace', async () => {
    const nonExistentId = 'non-existent-id';
    // Mock getWorkspaceById to return null for this case using testApp
    mockWorkspaceDb.getWorkspaceById.mockResolvedValueOnce(null);
    const res = await request(testApp) // Use testApp
      .get(`/api/workspaces/${nonExistentId}`)
      .set('Authorization', `Bearer ${ownerInfo.token}`);
    expect(res.statusCode).toEqual(404);
    expect(mockWorkspaceDb.getWorkspaceById).toHaveBeenCalledWith(nonExistentId);
  });

  // Test updating a workspace (Success path - uses mainApp)
  it('PUT /api/workspaces/:id - should update a workspace', async () => {
    const updatedName = `Updated Workspace ${Date.now()}`;
    const res = await request(mainApp) // Use mainApp
      .put(`/api/workspaces/${testWorkspaceId}`)
      .set('Authorization', `Bearer ${ownerInfo.token}`)
      .send({ name: updatedName, description: 'Updated description' });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('message', 'Workspace updated successfully');
    expect(res.body).toHaveProperty('workspace');
    expect(res.body.workspace).toHaveProperty('name', updatedName);
    expect(res.body.workspace).toHaveProperty('description', 'Updated description');
  });

  // Test updating a workspace (DB failure - uses testApp with mock)
  it('PUT /api/workspaces/:id - should return 500 if database fails', async () => {
      const dbError = new Error('DB update workspace failed');
      // Mock role check to succeed
      mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin');
      mockWorkspaceDb.updateWorkspace.mockRejectedValueOnce(dbError); // Configure mock to fail update
      const updatedName = `Fail Update Workspace ${Date.now()}`;

      const res = await request(testApp) // Use testApp
          .put(`/api/workspaces/${testWorkspaceId}`)
          .set('Authorization', `Bearer ${ownerInfo.token}`) // Mock middleware adds req.user
          .send({ name: updatedName });

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId);
      expect(mockWorkspaceDb.updateWorkspace).toHaveBeenCalled(); // Check mock call
  });


  it('PUT /api/workspaces/:id - should fail if non-admin tries to update', async () => {
    // Mock role check to return non-admin role
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('member');
    const res = await request(testApp) // Use testApp
      .put(`/api/workspaces/${testWorkspaceId}`)
      .set('Authorization', `Bearer ${nonAdminInfo.token}`) // Mock middleware adds req.user
      .send({ name: 'Non-Admin Update Attempt', description: 'Should fail' });

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty('error', 'You do not have permission to update this workspace');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, nonAdminInfo.userId);
  });

  it('PUT /api/workspaces/:id - should fail without workspace name', async () => {
    // Mock role check to succeed
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin');
    const res = await request(testApp) // Use testApp
      .put(`/api/workspaces/${testWorkspaceId}`)
      .set('Authorization', `Bearer ${ownerInfo.token}`) // Mock middleware adds req.user
      .send({ description: 'Missing name update' });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Workspace name is required');
    // Role check still happens before validation
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId);
  });

  // Test adding a member (Success path - uses mainApp)
  it('POST /api/workspaces/:id/members - should add a member to the workspace', async () => {
    const res = await request(mainApp) // Use mainApp
      .post(`/api/workspaces/${testWorkspaceId}/members`)
      .set('Authorization', `Bearer ${ownerInfo.token}`)
      .send({ email: memberInfo.email, role: 'editor' });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('message', 'Member added successfully');
  });

  // Test adding a member (getUserByEmail failure - uses testApp with mock)
  it('POST /api/workspaces/:id/members - should return 500 if getUserByEmail fails', async () => {
      const dbError = new Error('DB find user failed');
      mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin'); // Mock role check
      mockUserDb.getUserByEmail.mockRejectedValueOnce(dbError); // Configure mock

      const res = await request(testApp) // Use testApp
          .post(`/api/workspaces/${testWorkspaceId}/members`)
          .set('Authorization', `Bearer ${ownerInfo.token}`) // Mock middleware adds req.user
          .send({ email: otherUserInfo.email, role: 'viewer' });

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId);
      expect(mockUserDb.getUserByEmail).toHaveBeenCalledWith(otherUserInfo.email); // Check mock call
  });

  // Test adding a member (addWorkspaceMember failure - uses testApp with mock)
   it('POST /api/workspaces/:id/members - should return 500 if addWorkspaceMember fails', async () => {
      const dbError = new Error('DB add member failed');
      mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin'); // Mock role check
      mockUserDb.getUserByEmail.mockResolvedValueOnce({ id: otherUserInfo.userId, email: otherUserInfo.email, name: 'Other User' }); // Mock user lookup
      mockWorkspaceDb.addWorkspaceMember.mockRejectedValueOnce(dbError); // Configure mock

      const res = await request(testApp) // Use testApp
          .post(`/api/workspaces/${testWorkspaceId}/members`)
          .set('Authorization', `Bearer ${ownerInfo.token}`) // Mock middleware adds req.user
          .send({ email: otherUserInfo.email, role: 'viewer' });

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId);
      expect(mockUserDb.getUserByEmail).toHaveBeenCalledWith(otherUserInfo.email);
      expect(mockWorkspaceDb.addWorkspaceMember).toHaveBeenCalled(); // Check mock call
  });


  it('POST /api/workspaces/:id/members - should fail if non-admin tries to add member', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('member'); // Mock role check
    const res = await request(testApp) // Use testApp
      .post(`/api/workspaces/${testWorkspaceId}/members`)
      .set('Authorization', `Bearer ${nonAdminInfo.token}`) // Mock middleware adds req.user
      .send({ email: otherUserInfo.email, role: 'member' });

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty('error', 'You do not have permission to add members');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, nonAdminInfo.userId);
  });

  it('POST /api/workspaces/:id/members - should fail if user email not found', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin'); // Mock role check
    mockUserDb.getUserByEmail.mockResolvedValueOnce(null); // Mock user lookup failure
    const res = await request(testApp) // Use testApp
      .post(`/api/workspaces/${testWorkspaceId}/members`)
      .set('Authorization', `Bearer ${ownerInfo.token}`) // Mock middleware adds req.user
      .send({ email: 'nonexistent@example.com', role: 'member' });

    expect(res.statusCode).toEqual(404);
    expect(res.body).toHaveProperty('error', 'User not found');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId);
    expect(mockUserDb.getUserByEmail).toHaveBeenCalledWith('nonexistent@example.com');
  });

  // Test adding a user who is already a member (uses mainApp for real DB check)
  it('POST /api/workspaces/:id/members - should fail if user is already a member', async () => {
    // User 3 (nonAdminInfo) was added in beforeAll
    const res = await request(mainApp) // Use mainApp
      .post(`/api/workspaces/${testWorkspaceId}/members`)
      .set('Authorization', `Bearer ${ownerInfo.token}`) // Admin token
      .send({ email: nonAdminInfo.email, role: 'editor' }); // Try adding again

    expect(res.statusCode).toEqual(409);
    expect(res.body).toHaveProperty('error', 'User is already a member of this workspace.');
  });

  // Test getting members (Success path - uses mainApp)
  it('GET /api/workspaces/:id/members - should get workspace members', async () => {
    const res = await request(mainApp) // Use mainApp
      .get(`/api/workspaces/${testWorkspaceId}/members`)
      .set('Authorization', `Bearer ${ownerInfo.token}`);

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2); // Owner + added member
    const owner = res.body.find(m => m.id === ownerInfo.userId);
    const member = res.body.find(m => m.id === memberInfo.userId);
    expect(owner).toBeDefined();
    expect(owner).toHaveProperty('role', 'admin');
    expect(member).toBeDefined();
    expect(member).toHaveProperty('role', 'editor');
  });

   // Test getting members (DB failure - uses testApp with mock)
   it('GET /api/workspaces/:id/members - should return 500 if database fails', async () => {
      const dbError = new Error('DB get members failed');
      mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin'); // Mock role check
      mockWorkspaceDb.getWorkspaceMembers.mockRejectedValueOnce(dbError); // Configure mock

      const res = await request(testApp) // Use testApp
          .get(`/api/workspaces/${testWorkspaceId}/members`)
          .set('Authorization', `Bearer ${ownerInfo.token}`); // Mock middleware adds req.user

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId);
      expect(mockWorkspaceDb.getWorkspaceMembers).toHaveBeenCalledWith(testWorkspaceId); // Check mock call
  });


  it('GET /api/workspaces/:id/members - should fail if user is not a member', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce(null); // Mock role check failure
    const res = await request(testApp) // Use testApp
      .get(`/api/workspaces/${testWorkspaceId}/members`)
      .set('Authorization', `Bearer ${otherUserInfo.token}`); // Mock middleware adds req.user

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty('error', 'You do not have access to this workspace');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, otherUserInfo.userId);
  });

  // Test removing a member (Success path - uses mainApp)
  it('DELETE /api/workspaces/:id/members/:memberId - should remove a member', async () => {
     const res = await request(mainApp) // Use mainApp
      .delete(`/api/workspaces/${testWorkspaceId}/members/${memberInfo.userId}`)
      .set('Authorization', `Bearer ${ownerInfo.token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('message', 'Member removed successfully');

    // Verify member was removed (uses mainApp)
    const resVerify = await request(mainApp)
      .get(`/api/workspaces/${testWorkspaceId}/members`)
      .set('Authorization', `Bearer ${ownerInfo.token}`);
    expect(resVerify.statusCode).toEqual(200);
    const member = resVerify.body.find(m => m.id === memberInfo.userId);
    expect(member).toBeUndefined();
  });

  // Test removing a member (DB failure - uses testApp with mock)
  it('DELETE /api/workspaces/:id/members/:memberId - should return 500 if database fails', async () => {
      const dbError = new Error('DB remove member failed');
      // Re-add member first using mainApp to ensure they exist for removal attempt
       await request(mainApp)
         .post(`/api/workspaces/${testWorkspaceId}/members`)
         .set('Authorization', `Bearer ${ownerInfo.token}`)
         .send({ email: memberInfo.email, role: 'editor' });

      mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin'); // Mock role check
      mockWorkspaceDb.getWorkspaceById.mockResolvedValueOnce({ owner_id: ownerInfo.userId }); // Mock owner check
      mockWorkspaceDb.removeWorkspaceMember.mockRejectedValueOnce(dbError); // Configure mock

      const res = await request(testApp) // Use testApp
          .delete(`/api/workspaces/${testWorkspaceId}/members/${memberInfo.userId}`)
          .set('Authorization', `Bearer ${ownerInfo.token}`); // Mock middleware adds req.user

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId);
      expect(mockWorkspaceDb.getWorkspaceById).toHaveBeenCalledWith(testWorkspaceId);
      expect(mockWorkspaceDb.removeWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, memberInfo.userId); // Check mock call
  });


  it('DELETE /api/workspaces/:id/members/:memberId - should fail if non-admin tries to remove', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('member'); // Mock role check failure
    const res = await request(testApp) // Use testApp
      .delete(`/api/workspaces/${testWorkspaceId}/members/${nonAdminInfo.userId}`)
      .set('Authorization', `Bearer ${nonAdminInfo.token}`); // Mock middleware adds req.user

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty('error', 'You do not have permission to remove members');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, nonAdminInfo.userId);
  });

  it('DELETE /api/workspaces/:id/members/:memberId - should fail if trying to remove owner', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin'); // Mock role check
    mockWorkspaceDb.getWorkspaceById.mockResolvedValueOnce({ owner_id: ownerInfo.userId }); // Mock owner check
    const res = await request(testApp) // Use testApp
      .delete(`/api/workspaces/${testWorkspaceId}/members/${ownerInfo.userId}`)
      .set('Authorization', `Bearer ${ownerInfo.token}`); // Mock middleware adds req.user

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty('error', 'Cannot remove the workspace owner.');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId);
    expect(mockWorkspaceDb.getWorkspaceById).toHaveBeenCalledWith(testWorkspaceId);
  });

  it('DELETE /api/workspaces/:id/members/:memberId - should fail for non-existent memberId', async () => {
    const nonExistentMemberId = 'non-existent-user-id';
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin'); // Mock role check
    mockWorkspaceDb.getWorkspaceById.mockResolvedValueOnce({ owner_id: ownerInfo.userId }); // Mock owner check
    mockWorkspaceDb.removeWorkspaceMember.mockResolvedValueOnce(); // Mock remove success (doesn't throw)

    const res = await request(testApp) // Use testApp
      .delete(`/api/workspaces/${testWorkspaceId}/members/${nonExistentMemberId}`)
      .set('Authorization', `Bearer ${ownerInfo.token}`); // Mock middleware adds req.user

    expect(res.statusCode).toEqual(200); // Route returns 200 even if member doesn't exist
    expect(res.body).toHaveProperty('message', 'Member removed successfully');
    expect(mockWorkspaceDb.removeWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, nonExistentMemberId);
  });

  // Test getting workspace rooms (Success path - uses mainApp)
  it('GET /api/workspaces/:id/rooms - should get empty poker rooms list', async () => {
    const res = await request(mainApp) // Use mainApp
      .get(`/api/workspaces/${testWorkspaceId}/rooms`)
      .set('Authorization', `Bearer ${ownerInfo.token}`);
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toEqual(0); // Assuming no rooms created yet
  });

  // Test getting workspace rooms (DB failure - uses testApp with mock)
  it('GET /api/workspaces/:id/rooms - should return 500 if database fails', async () => {
      const dbError = new Error('DB get rooms failed');
      mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin'); // Mock role check
      mockPokerDb.getWorkspaceRooms.mockRejectedValueOnce(dbError); // Configure mock

      const res = await request(testApp) // Use testApp
          .get(`/api/workspaces/${testWorkspaceId}/rooms`)
          .set('Authorization', `Bearer ${ownerInfo.token}`); // Mock middleware adds req.user

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId);
      expect(mockPokerDb.getWorkspaceRooms).toHaveBeenCalledWith(testWorkspaceId); // Check mock call
  });


  it('GET /api/workspaces/:id/rooms - should fail if user is not a member', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce(null); // Mock role check failure
    const res = await request(testApp) // Use testApp
      .get(`/api/workspaces/${testWorkspaceId}/rooms`)
      .set('Authorization', `Bearer ${otherUserInfo.token}`); // Mock middleware adds req.user

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty('error', 'You do not have access to this workspace');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, otherUserInfo.userId);
  });

  // Test getting workspace retros (Success path - uses mainApp)
  it('GET /api/workspaces/:id/retros - should get retro boards list', async () => {
    // Create a retro board via mainApp first
    const retroRes = await request(mainApp).post('/api/retro').send({ name: 'Workspace Retro Test', workspaceId: testWorkspaceId });
    const createdAuthBoardId = retroRes.body.boardId; // Get the actual ID

    const res = await request(mainApp) // Use mainApp
      .get(`/api/workspaces/${testWorkspaceId}/retros`)
      .set('Authorization', `Bearer ${ownerInfo.token}`);
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1); // Expecting at least 1
    expect(res.body.some(b => b.id === createdAuthBoardId)).toBe(true);
  });

   // Test getting workspace retros (DB failure - uses testApp with mock)
   it('GET /api/workspaces/:id/retros - should return 500 if database fails', async () => {
      const dbError = new Error('DB get retros failed');
      mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin'); // Mock role check
      mockRetroDb.getWorkspaceRetroBoards.mockRejectedValueOnce(dbError); // Configure mock

      const res = await request(testApp) // Use testApp
          .get(`/api/workspaces/${testWorkspaceId}/retros`)
          .set('Authorization', `Bearer ${ownerInfo.token}`); // Mock middleware adds req.user

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId);
      expect(mockRetroDb.getWorkspaceRetroBoards).toHaveBeenCalledWith(testWorkspaceId); // Check mock call
  });


  it('GET /api/workspaces/:id/retros - should fail if user is not a member', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce(null); // Mock role check failure
    const res = await request(testApp) // Use testApp
      .get(`/api/workspaces/${testWorkspaceId}/retros`)
      .set('Authorization', `Bearer ${otherUserInfo.token}`); // Mock middleware adds req.user

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty('error', 'You do not have access to this workspace');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, otherUserInfo.userId);
  });

  // Test getting velocity teams (Success path - uses mainApp)
  it('GET /api/workspaces/:id/velocity-teams - should get default velocity team list', async () => {
    const res = await request(mainApp) // Use mainApp
      .get(`/api/workspaces/${testWorkspaceId}/velocity-teams`)
      .set('Authorization', `Bearer ${ownerInfo.token}`);
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toEqual(1); // Default team created with workspace
    expect(res.body[0]).toHaveProperty('name');
  });

  // Test getting velocity teams (DB failure - uses testApp with mock)
  it('GET /api/workspaces/:id/velocity-teams - should return 500 if database fails', async () => {
      const dbError = new Error('DB get velocity teams failed');
      mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin'); // Mock role check
      mockVelocityDb.getWorkspaceVelocityTeams.mockRejectedValueOnce(dbError); // Configure mock

      const res = await request(testApp) // Use testApp
          .get(`/api/workspaces/${testWorkspaceId}/velocity-teams`)
          .set('Authorization', `Bearer ${ownerInfo.token}`); // Mock middleware adds req.user

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId);
      expect(mockVelocityDb.getWorkspaceVelocityTeams).toHaveBeenCalledWith(testWorkspaceId); // Check mock call
  });


  it('GET /api/workspaces/:id/velocity-teams - should fail if user is not a member', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce(null); // Mock role check failure
    const res = await request(testApp) // Use testApp
      .get(`/api/workspaces/${testWorkspaceId}/velocity-teams`)
      .set('Authorization', `Bearer ${otherUserInfo.token}`); // Mock middleware adds req.user

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty('error', 'You do not have access to this workspace');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, otherUserInfo.userId);
  });

  // --- Invitation Tests ---

  it('POST /api/workspaces/:id/invitations - admin should create an invitation token', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin'); // Mock role check
    mockWorkspaceDb.createInvitation.mockResolvedValueOnce('mock-invite-token-123'); // Configure mock

    const res = await request(testApp) // Use testApp
      .post(`/api/workspaces/${testWorkspaceId}/invitations`)
      .set('Authorization', `Bearer ${ownerInfo.token}`) // Mock middleware adds req.user
      .send({ roleToAssign: 'member' });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('token', 'mock-invite-token-123');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId);
    expect(mockWorkspaceDb.createInvitation).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId, 'member', 7); // Check mock call
    generatedInviteToken = res.body.token; // Save for later tests (though it's mocked)
  });

   // Test creating invitation (DB failure - uses testApp with mock)
   it('POST /api/workspaces/:id/invitations - should return 500 if database fails', async () => {
      const dbError = new Error('DB create invitation failed');
      mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('admin'); // Mock role check
      mockWorkspaceDb.createInvitation.mockRejectedValueOnce(dbError); // Configure mock

      const res = await request(testApp) // Use testApp
          .post(`/api/workspaces/${testWorkspaceId}/invitations`)
          .set('Authorization', `Bearer ${ownerInfo.token}`) // Mock middleware adds req.user
          .send({ roleToAssign: 'member' });

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, ownerInfo.userId);
      expect(mockWorkspaceDb.createInvitation).toHaveBeenCalled(); // Check mock call
  });


  it('POST /api/workspaces/:id/invitations - non-admin should not create an invitation token', async () => {
    mockWorkspaceDb.getUserWorkspaceRole.mockResolvedValueOnce('member'); // Mock role check failure
    const res = await request(testApp) // Use testApp
      .post(`/api/workspaces/${testWorkspaceId}/invitations`)
      .set('Authorization', `Bearer ${nonAdminInfo.token}`) // Mock middleware adds req.user
      .send({});

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty('error', 'Forbidden: Only admins can create invitations.');
    expect(mockWorkspaceDb.getUserWorkspaceRole).toHaveBeenCalledWith(testWorkspaceId, nonAdminInfo.userId);
  });

   it('POST /api/workspaces/invitations/accept - should allow user to accept a valid invitation', async () => {
     const validToken = 'valid-invite-token';
     const assignedRole = 'editor';
     mockWorkspaceDb.findValidInvitationByToken.mockResolvedValueOnce({ id: 'invite-id-1', workspace_id: testWorkspaceId, role_to_assign: assignedRole });
     mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(false); // User is not already a member
     mockWorkspaceDb.addWorkspaceMember.mockResolvedValueOnce(); // Mock adding member success
     mockWorkspaceDb.markInvitationAsUsed.mockResolvedValueOnce(true); // Mock marking token success

     const res = await request(testApp) // Use testApp
       .post('/api/workspaces/invitations/accept')
       .set('Authorization', `Bearer ${memberInfo.token}`) // Mock middleware adds req.user
       .send({ token: validToken });

     expect(res.statusCode).toEqual(200);
     expect(res.body).toHaveProperty('message', 'Successfully joined workspace!');
     expect(res.body).toHaveProperty('workspaceId', testWorkspaceId);
     expect(mockWorkspaceDb.findValidInvitationByToken).toHaveBeenCalledWith(validToken);
     expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, memberInfo.userId);
     expect(mockWorkspaceDb.addWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, memberInfo.userId, assignedRole);
     expect(mockWorkspaceDb.markInvitationAsUsed).toHaveBeenCalledWith('invite-id-1', memberInfo.userId);
   });

   // Test accepting invitation (DB failure - uses testApp with mock)
   it('POST /api/workspaces/invitations/accept - should return 500 if database fails', async () => {
      const validToken = 'valid-invite-token-fail';
      const assignedRole = 'viewer';
      const dbError = new Error('DB accept invite failed');
      // Mock findValidInvitationByToken to succeed
      mockWorkspaceDb.findValidInvitationByToken.mockResolvedValueOnce({ id: 'invite-id-fail', workspace_id: testWorkspaceId, role_to_assign: assignedRole });
      // Mock isWorkspaceMember to return false
      mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(false);
      // Mock addWorkspaceMember to fail
      mockWorkspaceDb.addWorkspaceMember.mockRejectedValueOnce(dbError);

      const res = await request(testApp) // Use testApp
        .post('/api/workspaces/invitations/accept')
        .set('Authorization', `Bearer ${otherUserInfo.token}`) // Mock middleware adds req.user
        .send({ token: validToken });

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(mockWorkspaceDb.findValidInvitationByToken).toHaveBeenCalledWith(validToken);
      expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, otherUserInfo.userId);
      expect(mockWorkspaceDb.addWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, otherUserInfo.userId, assignedRole); // Check mock call
      expect(mockWorkspaceDb.markInvitationAsUsed).not.toHaveBeenCalled(); // Should not be called if add fails
  });


   it('POST /api/workspaces/invitations/accept - should fail with invalid token', async () => {
    mockWorkspaceDb.findValidInvitationByToken.mockResolvedValueOnce(null); // Mock token not found
    const res = await request(testApp) // Use testApp
      .post('/api/workspaces/invitations/accept')
      .set('Authorization', `Bearer ${otherUserInfo.token}`) // Mock middleware adds req.user
      .send({ token: 'invalid-token-123' });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Invalid or expired invitation token.');
    expect(mockWorkspaceDb.findValidInvitationByToken).toHaveBeenCalledWith('invalid-token-123');
  });

   it('POST /api/workspaces/invitations/accept - should fail with used token', async () => {
    // This case is covered by findValidInvitationByToken returning null
    mockWorkspaceDb.findValidInvitationByToken.mockResolvedValueOnce(null);
    const res = await request(testApp) // Use testApp
      .post('/api/workspaces/invitations/accept')
      .set('Authorization', `Bearer ${otherUserInfo.token}`) // Mock middleware adds req.user
      .send({ token: 'used-token-abc' });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Invalid or expired invitation token.');
    expect(mockWorkspaceDb.findValidInvitationByToken).toHaveBeenCalledWith('used-token-abc');
  });

  it('POST /api/workspaces/invitations/accept - should return OK if user is already a member (using valid token)', async () => {
    const validToken = 'valid-token-already-member';
    mockWorkspaceDb.findValidInvitationByToken.mockResolvedValueOnce({ id: 'invite-id-already', workspace_id: testWorkspaceId, role_to_assign: 'viewer' });
    mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // User is already a member

    const res = await request(testApp) // Use testApp
      .post('/api/workspaces/invitations/accept')
      .set('Authorization', `Bearer ${memberInfo.token}`) // Mock middleware adds req.user
      .send({ token: validToken });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('message', 'You are already a member of this workspace.');
    expect(res.body).toHaveProperty('workspaceId', testWorkspaceId);
    expect(mockWorkspaceDb.findValidInvitationByToken).toHaveBeenCalledWith(validToken);
    expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, memberInfo.userId);
    expect(mockWorkspaceDb.addWorkspaceMember).not.toHaveBeenCalled(); // Should not be called
    expect(mockWorkspaceDb.markInvitationAsUsed).not.toHaveBeenCalled(); // Should not be called
  });

   it('POST /api/workspaces/invitations/accept - should fail without authentication', async () => {
    const res = await request(testApp) // Use testApp (mock middleware won't add req.user)
      .post('/api/workspaces/invitations/accept')
      .send({ token: 'some-token' });

    expect(res.statusCode).toEqual(401); // Assuming authenticateToken middleware is applied before this route in mainApp
                                        // Since testApp doesn't have that, this might pass if route doesn't check req.user
                                        // Let's test against mainApp to be sure
    const resMain = await request(mainApp)
      .post('/api/workspaces/invitations/accept')
      .send({ token: 'some-token' });
    expect(resMain.statusCode).toEqual(401);

  });

   it('POST /api/workspaces/invitations/accept - should fail without token in body', async () => {
    const res = await request(testApp) // Use testApp
      .post('/api/workspaces/invitations/accept')
      .set('Authorization', `Bearer ${otherUserInfo.token}`) // Mock middleware adds req.user
      .send({});

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Invitation token is required.');
  });
});

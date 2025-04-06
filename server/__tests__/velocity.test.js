import request from 'supertest';
import express from 'express'; // Import express for test app setup
import { app as mainApp, server, io } from '../index.js'; // Import main app for setup, io/server for teardown
import { pool } from '../db/pool.js';
// Import necessary functions from Jest globals for ESM
import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

// Import the route setup function
import setupVelocityRoutes from '../routes/velocity.js';
// NOTE: We DO NOT import the actual DB functions here anymore

// --- Mock DB Objects ---
const mockVelocityDb = {
    createTeam: jest.fn(),
    getTeamByName: jest.fn(),
    createSprint: jest.fn(),
    updateSprintVelocity: jest.fn(),
    getSprintById: jest.fn(),
    getTeamVelocity: jest.fn(),
    verifyTeamPassword: jest.fn(), // Needed for anonymous team password checks
    getTeamAverageVelocity: jest.fn(), // Added missing mock
    getTeamByWorkspace: jest.fn(), // Added missing mock
    getTeamVelocityByWorkspace: jest.fn(), // Added missing mock
    getTeamAverageVelocityByWorkspace: jest.fn(), // Added missing mock
    checkIfTeamRequiresPassword: jest.fn(), // Added for refactored route
};
const mockWorkspaceDb = {
    // Only need isWorkspaceMember for velocity routes authorization checks
    isWorkspaceMember: jest.fn(),
};
// --- End Mock DB Objects ---

// --- Test Express App Setup ---
const testApp = express();
testApp.use(express.json()); // Add middleware needed by routes

// Mock the authentication middleware for testApp requests needing req.user
testApp.use((req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        // Use the actual userId from the test setup based on the token
        // This assumes authUserInfo and otherAuthUserInfo are accessible in this scope
        if (authUserInfo && token === authUserInfo.token) {
             req.user = { userId: authUserInfo.userId };
        } else if (otherAuthUserInfo && token === otherAuthUserInfo.token) {
             req.user = { userId: otherAuthUserInfo.userId };
        } else {
             req.user = undefined; // Unknown token
        }
    } else {
        req.user = undefined; // No token, no user
    }
    // Add workspaceId to req if header is present
    const workspaceIdHeader = req.headers['workspace-id'];
    if (workspaceIdHeader) {
        req.workspaceId = workspaceIdHeader;
    }
    next();
});

// Mount the velocity routes using the setup function and injecting the MOCK DBs
testApp.use('/api/velocity', setupVelocityRoutes(mockVelocityDb, mockWorkspaceDb));

// Add a dummy error handler for testing 500 errors on testApp
testApp.use((err, req, res, next) => {
    console.error("Test App Error Handler:", err.message); // Log error in test context
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Internal Server Error' });
});
// --- End Test Express App Setup ---


// Helper function to register/login a user and get token (uses mainApp)
const registerAndLoginUser = async (emailSuffix) => {
    const email = `velocity_di_user_${emailSuffix}_${Date.now()}@example.com`;
    const password = 'password123';
    const name = `Velocity DI User ${emailSuffix}`;
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


// Declare variables needed by mock middleware and tests in a higher scope
let authUserInfo; // { token, userId, email }
let otherAuthUserInfo; // For access control tests
let testWorkspaceId;
let otherTestWorkspaceId; // For access control tests

describe('Velocity Routes (/api/velocity) with DI', () => {
  // Variables needed across contexts
  let anonymousTeamId = 'test-anon-team-id';
  let anonymousTeamName = 'Anon Team DI Test';
  let anonymousTeamPassword = 'anonPasswordDI';
  let createdAnonSprintId = 'test-anon-sprint-id';
  let workspaceTeamId = 'test-ws-team-id';
  let workspaceTeamName = 'WS Team DI Test';
  let createdWsSprintId = 'test-ws-sprint-id';
  // authUserInfo, otherAuthUserInfo, testWorkspaceId, otherTestWorkspaceId are now defined globally

  // Setup: Register users and create workspaces using mainApp for context
  beforeAll(async () => {
    authUserInfo = await registerAndLoginUser('velocity_di_owner');
    otherAuthUserInfo = await registerAndLoginUser('velocity_di_other');

    // Create workspace for main authenticated user
    const workspaceName = `Velocity DI Test Workspace ${Date.now()}`;
    const resWorkspace = await request(mainApp)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${authUserInfo.token}`)
      .send({ name: workspaceName });
    expect(resWorkspace.statusCode).toEqual(201);
    testWorkspaceId = resWorkspace.body.workspace.id;

    // Create another workspace for access control tests
    const otherWorkspaceName = `Other Velocity DI WS ${Date.now()}`;
    const resOtherWorkspace = await request(mainApp)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${authUserInfo.token}`) // Main user creates it
      .send({ name: otherWorkspaceName });
    expect(resOtherWorkspace.statusCode).toEqual(201);
    otherTestWorkspaceId = resOtherWorkspace.body.workspace.id;

    // No longer creating teams/sprints here; tests will use mocks
  });

  // Reset mocks before each test
  beforeEach(() => {
    Object.values(mockVelocityDb).forEach(mockFn => mockFn.mockReset());
    Object.values(mockWorkspaceDb).forEach(mockFn => mockFn.mockReset());
  });

  // Close server, io, pool after all tests
  afterAll(async () => {
    io.close();
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  });

  // --- Anonymous Access Tests ---
  describe('Anonymous Access', () => {
    it('POST /api/velocity/teams - should create a new anonymous team', async () => {
      const teamName = `Anon Create DI ${Date.now()}`;
      const password = 'createPasswordDI';
      const mockTeam = { id: 'new-anon-team-id', name: teamName, workspace_id: null };
      mockVelocityDb.getTeamByName.mockResolvedValueOnce(null); // Mock team doesn't exist
      mockVelocityDb.createTeam.mockResolvedValueOnce(mockTeam); // Mock creation success

      const res = await request(testApp) // Use testApp
        .post('/api/velocity/teams')
        .send({ name: teamName, password });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.team).toEqual(mockTeam);
      expect(mockVelocityDb.getTeamByName).toHaveBeenCalledWith(teamName, null); // workspaceId is null
      // Corrected assertion for createTeam arguments
      expect(mockVelocityDb.createTeam).toHaveBeenCalledWith(expect.any(String), teamName, password, null, null);
    });

    it('POST /api/velocity/teams - should find existing anonymous team with correct password', async () => {
       const mockTeam = { id: anonymousTeamId, name: anonymousTeamName, workspace_id: null };
       mockVelocityDb.getTeamByName.mockResolvedValueOnce(mockTeam); // Mock team exists
       // Mock the functions called in this path
       mockVelocityDb.getTeamVelocity.mockResolvedValueOnce([]); // Assume empty velocity data

       const res = await request(testApp) // Use testApp
        .post('/api/velocity/teams')
        .send({ name: anonymousTeamName, password: anonymousTeamPassword });

       expect(res.statusCode).toEqual(200);
       expect(res.body).toHaveProperty('success', true);
       expect(res.body.team).toEqual(mockTeam);
       expect(mockVelocityDb.getTeamByName).toHaveBeenCalledWith(anonymousTeamName, null);
       // Route doesn't call verifyTeamPassword here, it calls getTeamVelocity
       expect(mockVelocityDb.getTeamVelocity).toHaveBeenCalledWith(anonymousTeamName, anonymousTeamPassword);
       expect(mockVelocityDb.createTeam).not.toHaveBeenCalled();
    });

    it('POST /api/velocity/teams - should fail to create anonymous team without password', async () => {
      const teamName = `Anon No Password DI ${Date.now()}`;
      mockVelocityDb.getTeamByName.mockResolvedValueOnce(null); // Mock team not found

      const res = await request(testApp) // Use testApp
        .post('/api/velocity/teams')
        .send({ name: teamName }); // No password

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', 'Password is required to create an anonymous team.');
      // Route *does* call getTeamByName first
      expect(mockVelocityDb.getTeamByName).toHaveBeenCalled();
      expect(mockVelocityDb.createTeam).not.toHaveBeenCalled();
    });

    it('POST /api/velocity/teams - should fail with wrong password for existing anonymous team', async () => {
      const mockTeam = { id: anonymousTeamId, name: anonymousTeamName, workspace_id: null };
      mockVelocityDb.getTeamByName.mockResolvedValueOnce(mockTeam); // Mock team exists
      // Mock getTeamVelocity to throw an error simulating password failure
      mockVelocityDb.getTeamVelocity.mockRejectedValueOnce(new Error("Invalid password for anonymous team"));

      const res = await request(testApp) // Use testApp
        .post('/api/velocity/teams')
        .send({ name: anonymousTeamName, password: 'wrongPassword' });

      // Route catches the error from getTeamVelocity and returns 401
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error', 'Invalid team name or password');
      expect(mockVelocityDb.getTeamByName).toHaveBeenCalledWith(anonymousTeamName, null);
      expect(mockVelocityDb.getTeamVelocity).toHaveBeenCalledWith(anonymousTeamName, 'wrongPassword');
    });

    it('POST /api/velocity/teams - should fail without password for existing password-protected anonymous team', async () => {
      const mockTeam = { id: anonymousTeamId, name: anonymousTeamName, workspace_id: null };
      mockVelocityDb.getTeamByName.mockResolvedValueOnce(mockTeam); // Mock team exists
      // Mock getTeamVelocity to throw an error simulating password required
      mockVelocityDb.getTeamVelocity.mockRejectedValueOnce(new Error("Password required for this anonymous team"));

      const res = await request(testApp) // Use testApp
        .post('/api/velocity/teams')
        .send({ name: anonymousTeamName }); // No password

      // Route catches the error from getTeamVelocity and returns 401
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error', 'Invalid team name or password');
      expect(mockVelocityDb.getTeamByName).toHaveBeenCalledWith(anonymousTeamName, null);
      expect(mockVelocityDb.getTeamVelocity).toHaveBeenCalledWith(anonymousTeamName, undefined); // Password is undefined
    });

    it('POST /api/velocity/teams/:name/sprints - should create sprint for anonymous team', async () => {
        const mockTeam = { id: anonymousTeamId, name: anonymousTeamName, workspace_id: null };
        const mockSprint = { id: 'new-anon-sprint-id' }; // Route only returns id
        mockVelocityDb.getTeamByName.mockResolvedValueOnce(mockTeam);
        // Mock password check success
        mockVelocityDb.checkIfTeamRequiresPassword.mockResolvedValueOnce(true);
        mockVelocityDb.verifyTeamPassword.mockResolvedValueOnce(true);
        mockVelocityDb.createSprint.mockResolvedValueOnce(mockSprint);

        const sprintName = 'Anon Sprint Test DI';
        const startDate = new Date().toISOString().split('T')[0];
        const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const res = await request(testApp) // Use testApp
          .post(`/api/velocity/teams/${anonymousTeamName}/sprints`)
          .query({ password: anonymousTeamPassword })
          .send({ sprintName, startDate, endDate });

        expect(res.statusCode).toEqual(201);
        expect(res.body).toEqual({ id: mockSprint.id }); // Check only id
        expect(mockVelocityDb.getTeamByName).toHaveBeenCalledWith(anonymousTeamName, null);
        expect(mockVelocityDb.checkIfTeamRequiresPassword).toHaveBeenCalledWith(anonymousTeamId);
        expect(mockVelocityDb.verifyTeamPassword).toHaveBeenCalledWith(anonymousTeamId, anonymousTeamPassword);
        expect(mockVelocityDb.createSprint).toHaveBeenCalledWith(expect.any(String), anonymousTeamId, sprintName, startDate, endDate);
    });

    it('POST /api/velocity/teams/:name/sprints - should fail with wrong password', async () => {
      const mockTeam = { id: anonymousTeamId, name: anonymousTeamName, workspace_id: null };
      mockVelocityDb.getTeamByName.mockResolvedValueOnce(mockTeam);
      mockVelocityDb.checkIfTeamRequiresPassword.mockResolvedValueOnce(true); // Mock team requires password
      mockVelocityDb.verifyTeamPassword.mockResolvedValueOnce(false); // Mock wrong password

      const sprintName = 'Anon Sprint Fail DI';
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const res = await request(testApp) // Use testApp
        .post(`/api/velocity/teams/${anonymousTeamName}/sprints`)
        .query({ password: 'wrongPassword' })
        .send({ sprintName, startDate, endDate });

      // With corrected route logic, this should now correctly return 401
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error', 'Invalid team name or password'); // Error comes from verify step now
      expect(mockVelocityDb.getTeamByName).toHaveBeenCalledWith(anonymousTeamName, null);
      expect(mockVelocityDb.checkIfTeamRequiresPassword).toHaveBeenCalledWith(anonymousTeamId);
      expect(mockVelocityDb.verifyTeamPassword).toHaveBeenCalledWith(anonymousTeamId, 'wrongPassword');
      expect(mockVelocityDb.createSprint).not.toHaveBeenCalled();
    });

    it('POST /api/velocity/teams/:name/sprints - should fail if team not found', async () => {
      mockVelocityDb.getTeamByName.mockResolvedValueOnce(null); // Mock team not found

      const sprintName = 'Anon Sprint Fail Team DI';
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const nonExistentTeamName = `non-existent-team-${Date.now()}`;

      const res = await request(testApp) // Use testApp
        .post(`/api/velocity/teams/${nonExistentTeamName}/sprints`)
        .query({ password: 'anyPassword' })
        .send({ sprintName, startDate, endDate });

      expect(res.statusCode).toEqual(401); // Route returns 401 when team not found
      expect(res.body).toHaveProperty('error', 'Invalid team name or password');
      expect(mockVelocityDb.getTeamByName).toHaveBeenCalledWith(nonExistentTeamName, null);
      expect(mockVelocityDb.verifyTeamPassword).not.toHaveBeenCalled();
      expect(mockVelocityDb.createSprint).not.toHaveBeenCalled();
    });

    it('PUT /api/velocity/sprints/:sprintId/velocity - should update sprint velocity anonymously', async () => {
      const mockSprint = { id: createdAnonSprintId, team_id: anonymousTeamId, workspace_id: null }; // Added workspace_id: null
      const updatedSprint = { ...mockSprint, committed_points: 25, completed_points: 22 };
      mockVelocityDb.getSprintById.mockResolvedValueOnce(mockSprint);
      mockVelocityDb.checkIfTeamRequiresPassword.mockResolvedValueOnce(true); // Mock team requires password
      mockVelocityDb.verifyTeamPassword.mockResolvedValueOnce(true); // Mock password correct
      mockVelocityDb.updateSprintVelocity.mockResolvedValueOnce(updatedSprint);

      const committedPoints = 25;
      const completedPoints = 22;

      const res = await request(testApp) // Use testApp
        .put(`/api/velocity/sprints/${createdAnonSprintId}/velocity`)
        .query({ password: anonymousTeamPassword })
        .send({ committedPoints, completedPoints });

      // With corrected route logic using mocks, this should now return 200
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(updatedSprint);
      expect(mockVelocityDb.getSprintById).toHaveBeenCalledWith(createdAnonSprintId);
      expect(mockVelocityDb.checkIfTeamRequiresPassword).toHaveBeenCalledWith(anonymousTeamId);
      expect(mockVelocityDb.verifyTeamPassword).toHaveBeenCalledWith(anonymousTeamId, anonymousTeamPassword);
      expect(mockVelocityDb.updateSprintVelocity).toHaveBeenCalledWith(createdAnonSprintId, committedPoints, completedPoints);
    });

    it('PUT /api/velocity/sprints/:sprintId/velocity - should fail with wrong password', async () => {
      const mockSprint = { id: createdAnonSprintId, team_id: anonymousTeamId, workspace_id: null }; // Added workspace_id: null
      mockVelocityDb.getSprintById.mockResolvedValueOnce(mockSprint);
      mockVelocityDb.checkIfTeamRequiresPassword.mockResolvedValueOnce(true); // Mock team requires password
      mockVelocityDb.verifyTeamPassword.mockResolvedValueOnce(false); // Mock wrong password

      const res = await request(testApp) // Use testApp
        .put(`/api/velocity/sprints/${createdAnonSprintId}/velocity`)
        .query({ password: 'wrongPassword' })
        .send({ committedPoints: 10, completedPoints: 5 });

      expect(res.statusCode).toEqual(401);
      // Error message should now be 'Invalid password' from the verify step
      expect(res.body).toHaveProperty('error', 'Invalid password');
      expect(mockVelocityDb.getSprintById).toHaveBeenCalledWith(createdAnonSprintId);
      expect(mockVelocityDb.checkIfTeamRequiresPassword).toHaveBeenCalledWith(anonymousTeamId);
      expect(mockVelocityDb.verifyTeamPassword).toHaveBeenCalledWith(anonymousTeamId, 'wrongPassword');
      expect(mockVelocityDb.updateSprintVelocity).not.toHaveBeenCalled();
    });

    it('PUT /api/velocity/sprints/:sprintId/velocity - should fail if sprint not found', async () => {
      const nonExistentSprintId = 'non-existent-sprint-id';
      mockVelocityDb.getSprintById.mockResolvedValueOnce(null); // Mock sprint not found

      const res = await request(testApp) // Use testApp
        .put(`/api/velocity/sprints/${nonExistentSprintId}/velocity`)
        .query({ password: anonymousTeamPassword })
        .send({ committedPoints: 10, completedPoints: 5 });

      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error', 'Sprint not found');
      // Ensure getSprintById mock returns null for this test
      expect(mockVelocityDb.getSprintById).toHaveBeenCalledWith(nonExistentSprintId);
      expect(mockVelocityDb.verifyTeamPassword).not.toHaveBeenCalled();
      expect(mockVelocityDb.updateSprintVelocity).not.toHaveBeenCalled();
    });

    it('GET /api/velocity/teams/:name/velocity - should return 400 for anonymous attempt', async () => {
       // No mocks needed as the route should fail before DB access
       const res = await request(testApp) // Use testApp
        .get(`/api/velocity/teams/${anonymousTeamName}/velocity`)
        .query({ password: anonymousTeamPassword });

       expect(res.statusCode).toEqual(400);
       expect(res.body).toHaveProperty('error', 'Workspace context required for this request.');
     });
  }); // End Anonymous Access describe

  // --- Authenticated Access Tests ---
  describe('Authenticated Access', () => {
    // Auth setup (users, workspaces) is in the main beforeAll

    it('POST /api/velocity/teams - should fail if workspaceId provided but user not authenticated', async () => {
      // Test against testApp, mock auth middleware won't add req.user if no header
      const res = await request(testApp)
        .post('/api/velocity/teams')
        .send({ name: 'Any Name', workspaceId: testWorkspaceId }); // No Auth header

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error', 'Authentication required for workspace teams.');
    });

    it('POST /api/velocity/teams - should fail if user not member of workspace', async () => {
      mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(false); // Mock user not member

      const res = await request(testApp) // Use testApp
        .post('/api/velocity/teams')
        .set('Authorization', `Bearer ${authUserInfo.token}`) // Mock auth adds req.user
        .send({ name: 'Any Name', workspaceId: testWorkspaceId });

      // Route logic fixed, should now correctly return 403
      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('error', 'Forbidden: Access denied to this workspace.');
      expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId);
    });

    it('POST /api/velocity/teams - should return 404 if workspace team does not exist', async () => {
      mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // Mock user is member
      mockVelocityDb.getTeamByWorkspace.mockResolvedValueOnce(null); // Mock team not found

      const nonExistentTeamName = `NonExistent WS Team DI ${Date.now()}`;
      const res = await request(testApp) // Use testApp
        .post('/api/velocity/teams')
        .set('Authorization', `Bearer ${authUserInfo.token}`)
        .send({ name: nonExistentTeamName, workspaceId: testWorkspaceId });

      // Route logic fixed, should now correctly return 404
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error', `Team '${nonExistentTeamName}' not found in this workspace.`);
      expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId);
      expect(mockVelocityDb.getTeamByWorkspace).toHaveBeenCalledWith(nonExistentTeamName, testWorkspaceId); // Route uses getTeamByWorkspace here
    });

    it('POST /api/velocity/teams - should return 404 if team exists but in different workspace', async () => {
      mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // Mock user is member of otherTestWorkspaceId
      mockVelocityDb.getTeamByWorkspace.mockResolvedValueOnce(null); // Mock team not found in *this* workspace

      const res = await request(testApp) // Use testApp
        .post('/api/velocity/teams')
        .set('Authorization', `Bearer ${authUserInfo.token}`)
        .send({ name: workspaceTeamName, workspaceId: otherTestWorkspaceId }); // Correct team name, WRONG workspace ID

      // Route logic fixed, should now correctly return 404
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error', `Team '${workspaceTeamName}' not found in this workspace.`);
      expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(otherTestWorkspaceId, authUserInfo.userId);
      expect(mockVelocityDb.getTeamByWorkspace).toHaveBeenCalledWith(workspaceTeamName, otherTestWorkspaceId); // Route uses getTeamByWorkspace here
    });

    it('POST /api/velocity/teams - should find existing workspace team', async () => {
      const mockTeam = { id: workspaceTeamId, name: workspaceTeamName, workspace_id: testWorkspaceId };
      mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // Mock user is member
      mockVelocityDb.getTeamByWorkspace.mockResolvedValueOnce(mockTeam); // Mock team found

      const res = await request(testApp) // Use testApp
        .post('/api/velocity/teams')
        .set('Authorization', `Bearer ${authUserInfo.token}`)
        .send({ name: workspaceTeamName, workspaceId: testWorkspaceId });

      // Route logic fixed, should now correctly return 200
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.team).toEqual(mockTeam);
      expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId);
      expect(mockVelocityDb.getTeamByWorkspace).toHaveBeenCalledWith(workspaceTeamName, testWorkspaceId); // Route uses getTeamByWorkspace here
      expect(mockVelocityDb.createTeam).not.toHaveBeenCalled(); // Should not create if found
    });

    it('POST /api/velocity/teams/:name/sprints - should create sprint for workspace team when authenticated', async () => {
        const mockTeam = { id: workspaceTeamId, name: workspaceTeamName, workspace_id: testWorkspaceId };
        const mockSprint = { id: 'new-ws-sprint-id' }; // Route only returns id
        mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // Mock user is member
        mockVelocityDb.getTeamByWorkspace.mockResolvedValueOnce(mockTeam); // Mock team found
        mockVelocityDb.createSprint.mockResolvedValueOnce(mockSprint); // Mock sprint creation

        const sprintName = 'WS Sprint Auth DI';
        const startDate = new Date().toISOString().split('T')[0];
        const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const res = await request(testApp) // Use testApp
          .post(`/api/velocity/teams/${workspaceTeamName}/sprints`)
          .set('Authorization', `Bearer ${authUserInfo.token}`)
          .send({ sprintName, startDate, endDate, workspaceId: testWorkspaceId }); // Send workspaceId in body

        // Route logic fixed, should now correctly return 201
        expect(res.statusCode).toEqual(201);
        expect(res.body).toEqual({ id: mockSprint.id }); // Route only returns { id: ... }
        expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId);
        expect(mockVelocityDb.getTeamByWorkspace).toHaveBeenCalledWith(workspaceTeamName, testWorkspaceId); // Route uses getTeamByWorkspace here
        expect(mockVelocityDb.createSprint).toHaveBeenCalledWith(expect.any(String), workspaceTeamId, sprintName, startDate, endDate);
    });

    it('POST /api/velocity/teams/:name/sprints - should fail if user not workspace member', async () => {
      mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(false); // Mock user is NOT member

      const sprintName = 'WS Sprint Fail Auth DI';
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const res = await request(testApp) // Use testApp
        .post(`/api/velocity/teams/${workspaceTeamName}/sprints`)
        .set('Authorization', `Bearer ${otherAuthUserInfo.token}`) // Use other user's token
        .send({ sprintName, startDate, endDate, workspaceId: testWorkspaceId });

      // Route logic fixed, should now correctly return 403
      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('error', 'Forbidden: Access denied to this workspace');
      expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, otherAuthUserInfo.userId);
      expect(mockVelocityDb.getTeamByWorkspace).not.toHaveBeenCalled(); // Route uses getTeamByWorkspace here
      expect(mockVelocityDb.createSprint).not.toHaveBeenCalled();
    });

    it('PUT /api/velocity/sprints/:sprintId/velocity - should update workspace sprint velocity', async () => {
        const mockSprint = { id: createdWsSprintId, team_id: workspaceTeamId, workspace_id: testWorkspaceId };
        const updatedSprint = { ...mockSprint, committed_points: 30, completed_points: 28 };
        mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // Mock user is member
        mockVelocityDb.getSprintById.mockResolvedValueOnce(mockSprint); // Mock get sprint
        mockVelocityDb.updateSprintVelocity.mockResolvedValueOnce(updatedSprint); // Mock update success

        const committedPoints = 30;
        const completedPoints = 28;

        const res = await request(testApp) // Use testApp
           .put(`/api/velocity/sprints/${createdWsSprintId}/velocity`)
           .set('Authorization', `Bearer ${authUserInfo.token}`)
           .set('workspace-id', testWorkspaceId) // Add workspace context header
           .send({ committedPoints, completedPoints });

        // Route logic fixed, should now correctly return 200
        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual(updatedSprint);
        expect(mockVelocityDb.getSprintById).toHaveBeenCalledWith(createdWsSprintId);
        // Need to mock workspace check
        expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId);
        expect(mockVelocityDb.updateSprintVelocity).toHaveBeenCalledWith(createdWsSprintId, committedPoints, completedPoints);
    });

    it('PUT /api/velocity/sprints/:sprintId/velocity - should fail if user not workspace member', async () => {
      const mockSprint = { id: createdWsSprintId, team_id: workspaceTeamId, workspace_id: testWorkspaceId }; // Need to mock getSprintById
      mockVelocityDb.getSprintById.mockResolvedValueOnce(mockSprint);
      mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(false); // Mock user is NOT member

      const res = await request(testApp) // Use testApp
        .put(`/api/velocity/sprints/${createdWsSprintId}/velocity`)
        .set('Authorization', `Bearer ${otherAuthUserInfo.token}`) // Use other user's token
        .set('workspace-id', testWorkspaceId)
        .send({ committedPoints: 15, completedPoints: 10 });

      // Route logic fixed, should now correctly return 403
      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('error', 'Forbidden: Access denied to this workspace');
      expect(mockVelocityDb.getSprintById).toHaveBeenCalledWith(createdWsSprintId); // getSprintById is called before membership check
      expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, otherAuthUserInfo.userId);
      expect(mockVelocityDb.updateSprintVelocity).not.toHaveBeenCalled();
    });

    it('PUT /api/velocity/sprints/:sprintId/velocity - should fail if workspace header mismatch', async () => {
      const mockSprint = { id: createdWsSprintId, team_id: workspaceTeamId, workspace_id: testWorkspaceId }; // Belongs to testWorkspaceId
      // No need to mock isWorkspaceMember as the mismatch check happens first
      mockVelocityDb.getSprintById.mockResolvedValueOnce(mockSprint); // Mock get sprint finds it

      const res = await request(testApp) // Use testApp
        .put(`/api/velocity/sprints/${createdWsSprintId}/velocity`)
        .set('Authorization', `Bearer ${authUserInfo.token}`) // Correct user
        .set('workspace-id', otherTestWorkspaceId) // Wrong workspace header
        .send({ committedPoints: 15, completedPoints: 10 });

      // Route logic fixed, should now correctly return 403
      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('error', 'Sprint does not belong to this workspace');
      expect(mockVelocityDb.getSprintById).toHaveBeenCalledWith(createdWsSprintId); // getSprintById is called before workspace check
      // isWorkspaceMember is not called in this specific error path (mismatch check happens first)
      // expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(otherTestWorkspaceId, authUserInfo.userId);
      expect(mockVelocityDb.updateSprintVelocity).not.toHaveBeenCalled();
    });

    it('GET /api/velocity/teams/:name/velocity - should get velocity for workspace team when authenticated with header', async () => {
        const mockTeam = { id: workspaceTeamId, name: workspaceTeamName, workspace_id: testWorkspaceId };
        const mockVelocityData = {
            sprints: [{ sprint_id: createdWsSprintId, name: 'WS Sprint 1', committed_points: 30, completed_points: 28 }],
            averages: { avgCommitted: 30, avgCompleted: 28, avgVelocity: 28 }
        };
        mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // Mock user is member
        mockVelocityDb.getTeamByWorkspace.mockResolvedValueOnce(mockTeam); // Mock team found using getTeamByWorkspace
        mockVelocityDb.getTeamVelocityByWorkspace.mockResolvedValueOnce(mockVelocityData.sprints); // Mock velocity data
        mockVelocityDb.getTeamAverageVelocityByWorkspace.mockResolvedValueOnce(mockVelocityData.averages); // Mock average data

        const res = await request(testApp) // Use testApp
         .get(`/api/velocity/teams/${workspaceTeamName}/velocity`)
         .set('Authorization', `Bearer ${authUserInfo.token}`)
         .set('workspace-id', testWorkspaceId);

       // Route logic fixed, should now correctly return 200
       expect(res.statusCode).toEqual(200);
       expect(res.body).toEqual(mockVelocityData);
       expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId);
       expect(mockVelocityDb.getTeamByWorkspace).toHaveBeenCalledWith(workspaceTeamName, testWorkspaceId); // Route uses getTeamByWorkspace
       expect(mockVelocityDb.getTeamVelocityByWorkspace).toHaveBeenCalledWith(workspaceTeamName, testWorkspaceId);
       expect(mockVelocityDb.getTeamAverageVelocityByWorkspace).toHaveBeenCalledWith(workspaceTeamName, testWorkspaceId);
       // getTeamVelocity is not called in this path
       // expect(mockVelocityDb.getTeamVelocity).toHaveBeenCalledWith(workspaceTeamId);
     });

     it('GET /api/velocity/teams/:name/velocity - should return 404 if team does not exist in workspace', async () => {
        mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // Mock user is member
        mockVelocityDb.getTeamByWorkspace.mockResolvedValueOnce(null); // Mock team not found using getTeamByWorkspace

        const newTeamName = `NonExistent Team DI ${Date.now()}`;
        const res = await request(testApp) // Use testApp
         .get(`/api/velocity/teams/${newTeamName}/velocity`)
         .set('Authorization', `Bearer ${authUserInfo.token}`)
         .set('workspace-id', testWorkspaceId);

       // Route logic fixed, should now correctly return 404
       expect(res.statusCode).toEqual(404);
       expect(res.body).toHaveProperty('error', `Team '${newTeamName}' not found in this workspace.`);
       expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId);
       expect(mockVelocityDb.getTeamByWorkspace).toHaveBeenCalledWith(newTeamName, testWorkspaceId); // Route uses getTeamByWorkspace
       expect(mockVelocityDb.getTeamVelocity).not.toHaveBeenCalled();
     });

     it('GET /api/velocity/teams/:name/velocity - should fail (400) if authenticated but no workspace header', async () => {
        // No mocks needed, should fail before DB access
        const res = await request(testApp) // Use testApp
         .get(`/api/velocity/teams/${workspaceTeamName}/velocity`)
         .set('Authorization', `Bearer ${authUserInfo.token}`); // No workspace-id header

        // Route logic fixed, should now correctly return 400
        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('error', 'Workspace context required for this request.');
      });

     // --- Access Control Tests ---
     describe('Access Control', () => {
        it('GET /api/velocity/teams/:name/velocity - should fail (403) if user requests team in workspace they dont belong to', async () => {
            mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(false); // Mock user is NOT member

            const res = await request(testApp) // Use testApp
             .get(`/api/velocity/teams/${workspaceTeamName}/velocity`)
             .set('Authorization', `Bearer ${otherAuthUserInfo.token}`) // Use other user's token
             .set('workspace-id', testWorkspaceId); // Target the original workspace

           // Route logic fixed, should now correctly return 403
           expect(res.statusCode).toEqual(403);
           expect(res.body).toHaveProperty('error', 'Forbidden: Access denied to this workspace');
           expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, otherAuthUserInfo.userId);
           expect(mockVelocityDb.getTeamByWorkspace).not.toHaveBeenCalled(); // Route uses getTeamByWorkspace
         });

         it('GET /api/velocity/teams/:name/velocity - should fail (404) if team exists but not in the specified workspace', async () => {
             mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // Mock user IS member of other workspace
             mockVelocityDb.getTeamByWorkspace.mockResolvedValueOnce(null); // Mock team NOT found in other workspace

             const res = await request(testApp) // Use testApp
              .get(`/api/velocity/teams/${workspaceTeamName}/velocity`) // Use actual team name
              .set('Authorization', `Bearer ${authUserInfo.token}`) // Correct user
              .set('workspace-id', otherTestWorkspaceId); // But wrong workspace ID in header

            // Route logic fixed, should now correctly return 404
            expect(res.statusCode).toEqual(404);
            expect(res.body).toHaveProperty('error', `Team '${workspaceTeamName}' not found in this workspace.`);
            expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(otherTestWorkspaceId, authUserInfo.userId);
            expect(mockVelocityDb.getTeamByWorkspace).toHaveBeenCalledWith(workspaceTeamName, otherTestWorkspaceId); // Route uses getTeamByWorkspace
         });
     });

  }); // End Authenticated Access describe
}); // End top-level describe

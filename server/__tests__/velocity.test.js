import request from 'supertest';
import express from 'express'; // Import express for test app setup
import { app as mainApp, server, io } from '../index.js'; // Import main app for setup, io/server for teardown
import { pool } from '../db/pool.js';
import bcrypt from 'bcryptjs'; // Import bcrypt
import { v4 as uuidv4 } from 'uuid'; // Import uuid
// Import necessary functions from Jest globals for ESM
import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import setupVelocityRoutes from '../routes/velocity.js';

// --- Mock DB Objects ---
const mockVelocityDb = {
    createTeam: jest.fn(),
    getTeam: jest.fn(), // Replaced getTeamByName
    createSprint: jest.fn(),
    updateSprintVelocity: jest.fn(),
    getSprintById: jest.fn(),
    getTeamVelocity: jest.fn(),
    getTeamAverageVelocity: jest.fn(),
    getTeamByWorkspace: jest.fn(),
    getTeamVelocityByWorkspace: jest.fn(),
    getTeamAverageVelocityByWorkspace: jest.fn(),
    getTeamById: jest.fn(),
    getWorkspaceVelocityTeams: jest.fn(), // Added missing function
};
const mockWorkspaceDb = {
    // Only need isWorkspaceMember for velocity routes authorization checks
    isWorkspaceMember: jest.fn(),
};
// --- End Mock DB Objects ---

// testApp setup moved inside describe block


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
  let testApp; // Declare testApp here
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
    // Setup test-specific Express app instance *inside* describe block
    testApp = express();
    testApp.use(express.json()); // Add middleware needed by routes

    // Mock the authentication middleware for testApp requests needing req.user
    testApp.use((req, res, next) => {
        const authHeader = req.headers['authorization'];
        req.user = undefined; // Start with no user
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            // Use the actual userId from the test setup based on the token
            // Now authUserInfo and otherAuthUserInfo will be defined when this runs
            if (authUserInfo && token === authUserInfo.token) {
                 req.user = { userId: authUserInfo.userId };
            } else if (otherAuthUserInfo && token === otherAuthUserInfo.token) {
                 req.user = { userId: otherAuthUserInfo.userId };
            }
        }
        // Add workspaceId to req if header is present (used by mock middleware, not routes directly)
        const workspaceIdHeader = req.headers['workspace-id'];
        if (workspaceIdHeader) {
            req.workspaceId = workspaceIdHeader; // Set on req for potential middleware use if needed
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

    // --- Original beforeAll content starts here ---
    // --- Original beforeAll content starts here ---
    authUserInfo = await registerAndLoginUser('velocity_di_owner');
    otherAuthUserInfo = await registerAndLoginUser('velocity_di_other');

    // Assign placeholder IDs instead of creating real workspaces in DB for route tests
    testWorkspaceId = uuidv4();
    otherTestWorkspaceId = uuidv4();
  });

  // Reset mocks before each test
  beforeEach(() => {
    Object.values(mockVelocityDb).forEach(mockFn => mockFn.mockReset());
    Object.values(mockWorkspaceDb).forEach(mockFn => mockFn.mockReset());
  });

  // Close server, io, pool after all tests
  afterAll(async () => {
    // Ensure server is closed before ending the pool
    if (server && server.listening) {
      await new Promise(resolve => server.close(resolve));
    }
    if (io) {
        io.close();
    }
    await pool.end(); // Close DB pool
  });

  // --- Anonymous Access Tests ---
  describe('Anonymous Access', () => {
    it('POST /api/velocity/teams - should create a new anonymous team', async () => {
      const teamName = `Anon Create DI ${Date.now()}`;
      const password = 'createPasswordDI';
      const mockTeam = { id: 'new-anon-team-id', name: teamName, workspace_id: null };
      mockVelocityDb.getTeam.mockResolvedValueOnce(null); // Use getTeam, mock team doesn't exist
      mockVelocityDb.createTeam.mockResolvedValueOnce(mockTeam); // Mock creation success

      const res = await request(testApp) // Use testApp
        .post('/api/velocity/teams')
        .send({ name: teamName, password });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.team).toEqual(mockTeam);
      // Route calls getTeam first
      expect(mockVelocityDb.getTeam).toHaveBeenCalledWith(teamName, password); // Removed executor expectation
      // Check essential args for createTeam, ignore executor
      expect(mockVelocityDb.createTeam).toHaveBeenCalledWith(expect.any(String), teamName, password, null, null, null); // Removed executor expectation
    });

    it('POST /api/velocity/teams - should find existing anonymous team with correct password', async () => {
       const mockTeam = { id: anonymousTeamId, name: anonymousTeamName, workspace_id: null };
       mockVelocityDb.getTeam.mockResolvedValueOnce(mockTeam); // Use getTeam, mock team exists
       // Mock the functions called in this path
       mockVelocityDb.getTeamVelocity.mockResolvedValueOnce([]); // Assume empty velocity data
       mockVelocityDb.getTeamAverageVelocity.mockResolvedValueOnce({ average_velocity: '10.00' }); // Mock average data

       const res = await request(testApp) // Use testApp
        .post('/api/velocity/teams')
        .send({ name: anonymousTeamName, password: anonymousTeamPassword });

       expect(res.statusCode).toEqual(200);
       expect(res.body).toHaveProperty('success', true);
       expect(res.body.team).toEqual(mockTeam);
       // Route calls getTeam, getTeamVelocity, getTeamAverageVelocity
       expect(mockVelocityDb.getTeam).toHaveBeenCalledWith(anonymousTeamName, anonymousTeamPassword); // Removed executor expectation
       // Assert with only the arguments passed by the route (name, password, dbExecutor)
       expect(mockVelocityDb.getTeamVelocity).toHaveBeenCalledWith(anonymousTeamName, anonymousTeamPassword); // Removed executor expectation
       expect(mockVelocityDb.getTeamAverageVelocity).toHaveBeenCalledWith(anonymousTeamName, anonymousTeamPassword); // Removed executor expectation
       expect(res.body.averages).toHaveProperty('average_velocity', '10.00');
       expect(mockVelocityDb.createTeam).not.toHaveBeenCalled();
    });

    it('POST /api/velocity/teams - should fail to create anonymous team without password', async () => {
      const teamName = `Anon No Password DI ${Date.now()}`;
      mockVelocityDb.getTeam.mockResolvedValueOnce(null); // Use getTeam, mock team not found

      const res = await request(testApp) // Use testApp
        .post('/api/velocity/teams')
        .send({ name: teamName }); // No password

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', 'Password is required to create an anonymous team.');
      // Route calls getTeam first
      expect(mockVelocityDb.getTeam).toHaveBeenCalledWith(teamName, undefined); // Removed executor expectation
      expect(mockVelocityDb.createTeam).not.toHaveBeenCalled();
    });

    it('POST /api/velocity/teams - should fail with wrong password for existing anonymous team', async () => {
      const mockTeam = { id: anonymousTeamId, name: anonymousTeamName, workspace_id: null };
      // Mock getTeam itself to throw the auth error
      mockVelocityDb.getTeam.mockRejectedValueOnce(new Error("Invalid password for anonymous team"));
      // No need to mock getTeamVelocity as it won't be called if getTeam throws

      const res = await request(testApp) // Use testApp
        .post('/api/velocity/teams')
        .send({ name: anonymousTeamName, password: 'wrongPassword' });

      // Route catches the error from getTeamVelocity and returns 401
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error', 'Invalid team name or password');
      // Route calls getTeam, then getTeamVelocity
      expect(mockVelocityDb.getTeam).toHaveBeenCalledWith(anonymousTeamName, 'wrongPassword'); // Removed executor expectation
      // getTeamVelocity should NOT have been called
      expect(mockVelocityDb.getTeamVelocity).not.toHaveBeenCalled();
    });

    it('POST /api/velocity/teams - should fail without password for existing password-protected anonymous team', async () => {
      const mockTeam = { id: anonymousTeamId, name: anonymousTeamName, workspace_id: null };
      // Mock getTeam itself to throw the auth error
      mockVelocityDb.getTeam.mockRejectedValueOnce(new Error("Password required for this anonymous team"));
      // No need to mock getTeamVelocity

      const res = await request(testApp) // Use testApp
        .post('/api/velocity/teams')
        .send({ name: anonymousTeamName }); // No password

      // Route catches the error from getTeamVelocity and returns 401
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error', 'Invalid team name or password');
      expect(mockVelocityDb.getTeam).toHaveBeenCalledWith(anonymousTeamName, undefined); // Removed executor expectation
      // getTeamVelocity should NOT have been called
      expect(mockVelocityDb.getTeamVelocity).not.toHaveBeenCalled();
    });

    it('POST /api/velocity/teams/:name/sprints - should create sprint for anonymous team', async () => {
        // Mock team needs the password hash for the route logic to work correctly
        const mockTeamWithHash = { id: anonymousTeamId, name: anonymousTeamName, workspace_id: null, password: await bcrypt.hash(anonymousTeamPassword, 10) };
        const mockSprint = { id: 'new-anon-sprint-id' }; // Route only returns id
        // Route calls getTeam first to authorize
        mockVelocityDb.getTeam.mockResolvedValueOnce(mockTeamWithHash);
        // checkIfTeamRequiresPassword and verifyTeamPassword are no longer used in route
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
        // Route calls getTeam first
        expect(mockVelocityDb.getTeam).toHaveBeenCalledWith(anonymousTeamName, null); // Removed executor expectation
        // Check essential args, ignore executor placeholder
        expect(mockVelocityDb.createSprint).toHaveBeenCalledWith(expect.any(String), anonymousTeamId, sprintName, startDate, endDate); // Removed executor expectation
    });

    it('POST /api/velocity/teams/:name/sprints - should fail with wrong password', async () => {
      // Mock team needs the password hash
      const mockTeamWithHash = { id: anonymousTeamId, name: anonymousTeamName, workspace_id: null, password: await bcrypt.hash(anonymousTeamPassword, 10) };
      // Route calls getTeam first
      // Ensure the mock includes the password field for the route's check
      mockVelocityDb.getTeam.mockResolvedValueOnce({ ...mockTeamWithHash });
      // checkIfTeamRequiresPassword and verifyTeamPassword are no longer used in route

      const sprintName = 'Anon Sprint Fail DI';
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const res = await request(testApp) // Use testApp
        .post(`/api/velocity/teams/${anonymousTeamName}/sprints`)
        .query({ password: 'wrongPassword' })
        .send({ sprintName, startDate, endDate });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error', 'Invalid password.'); // Correct error message
      // Route calls getTeam first
      // Route calls getTeam with null password initially to check existence
      expect(mockVelocityDb.getTeam).toHaveBeenCalledWith(anonymousTeamName, null); // Removed executor expectation
      expect(mockVelocityDb.createSprint).not.toHaveBeenCalled();
    });

    it('POST /api/velocity/teams/:name/sprints - should fail if team not found', async () => {
      // Route calls getTeam first
      // Mock getTeam resolving null for the "not found" case
      mockVelocityDb.getTeam.mockResolvedValueOnce(null);

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
      // Route calls getTeam first
      // Route calls getTeam with null password initially
      expect(mockVelocityDb.getTeam).toHaveBeenCalledWith(nonExistentTeamName, null); // Removed executor expectation
      expect(mockVelocityDb.createSprint).not.toHaveBeenCalled();
    });

    it('PUT /api/velocity/sprints/:sprintId/velocity - should update sprint velocity anonymously', async () => {
      const mockSprint = { id: createdAnonSprintId, team_id: anonymousTeamId, workspace_id: null }; // Added workspace_id: null
      const updatedSprint = { ...mockSprint, committed_points: 25, completed_points: 22 };
      // Mock getSprintById finding the sprint
      mockVelocityDb.getSprintById.mockResolvedValueOnce(mockSprint); // Needs dbExecutor arg
      // Mock getTeamById finding the associated anonymous team with a password hash
      const mockTeamWithPasswordHash = { id: anonymousTeamId, password: await bcrypt.hash(anonymousTeamPassword, 10), workspace_id: null };
      mockVelocityDb.getTeamById.mockResolvedValueOnce(mockTeamWithPasswordHash); // Needs dbExecutor arg
      mockVelocityDb.updateSprintVelocity.mockResolvedValueOnce(updatedSprint); // Needs dbExecutor arg

      const committedPoints = 25;
      const completedPoints = 22;

      const res = await request(testApp) // Use testApp
        .put(`/api/velocity/sprints/${createdAnonSprintId}/velocity`)
        .query({ password: anonymousTeamPassword })
        .send({ committedPoints, completedPoints });

      // With corrected route logic using mocks, this should now return 200
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(updatedSprint);
      // Add expect.any(Function) for dbExecutor
      // Check essential args + executor placeholder
      // Check essential args, ignore executor placeholder
      expect(mockVelocityDb.getSprintById).toHaveBeenCalledWith(createdAnonSprintId); // Removed executor expectation
      expect(mockVelocityDb.getTeamById).toHaveBeenCalledWith(anonymousTeamId); // Removed executor expectation
      expect(mockVelocityDb.updateSprintVelocity).toHaveBeenCalledWith(createdAnonSprintId, committedPoints, completedPoints); // Removed executor expectation
    });

    it('PUT /api/velocity/sprints/:sprintId/velocity - should fail with wrong password', async () => {
      const mockSprint = { id: createdAnonSprintId, team_id: anonymousTeamId, workspace_id: null }; // Added workspace_id: null
      // Mock getSprintById finding the sprint
      mockVelocityDb.getSprintById.mockResolvedValueOnce(mockSprint); // Needs dbExecutor arg
      // Mock getTeamById finding the associated anonymous team with a password hash
      const mockTeamWithPasswordHash = { id: anonymousTeamId, password: await bcrypt.hash(anonymousTeamPassword, 10), workspace_id: null };
      mockVelocityDb.getTeamById.mockResolvedValueOnce(mockTeamWithPasswordHash); // Needs dbExecutor arg

      const res = await request(testApp) // Use testApp
        .put(`/api/velocity/sprints/${createdAnonSprintId}/velocity`)
        .query({ password: 'wrongPassword' })
        .send({ committedPoints: 10, completedPoints: 5 });

      expect(res.statusCode).toEqual(401);
      // Error message should now be 'Invalid password' from the verify step
      expect(res.body).toHaveProperty('error', 'Invalid password.'); // Error message from bcrypt compare
      // Add expect.any(Function) for dbExecutor
      // Check essential args + executor placeholder
      // Check essential args, ignore executor placeholder
      expect(mockVelocityDb.getSprintById).toHaveBeenCalledWith(createdAnonSprintId); // Removed executor expectation
      expect(mockVelocityDb.getTeamById).toHaveBeenCalledWith(anonymousTeamId); // Removed executor expectation
      expect(mockVelocityDb.updateSprintVelocity).not.toHaveBeenCalled();
    });

    it('PUT /api/velocity/sprints/:sprintId/velocity - should fail if sprint not found', async () => {
      const nonExistentSprintId = 'non-existent-sprint-id';
      mockVelocityDb.getSprintById.mockResolvedValueOnce(null); // Needs dbExecutor arg

      const res = await request(testApp) // Use testApp
        .put(`/api/velocity/sprints/${nonExistentSprintId}/velocity`)
        .query({ password: anonymousTeamPassword })
        .send({ committedPoints: 10, completedPoints: 5 });

      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error', 'Sprint not found');
      // Ensure getSprintById mock returns null for this test
      // Add expect.any(Function) for dbExecutor
      // Check essential args + executor placeholder
      // Check essential args, ignore executor placeholder
      expect(mockVelocityDb.getSprintById).toHaveBeenCalledWith(nonExistentSprintId); // Removed executor expectation
      expect(mockVelocityDb.getTeamById).not.toHaveBeenCalled();
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
      expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId); // Removed pool expectation
    });

    it('POST /api/velocity/teams - should return 404 if workspace team does not exist', async () => {
      mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // Mock user is member
      mockVelocityDb.getTeamByWorkspace.mockResolvedValueOnce(null); // Needs dbExecutor arg

      const nonExistentTeamName = `NonExistent WS Team DI ${Date.now()}`;
      const res = await request(testApp) // Use testApp
        .post('/api/velocity/teams')
        .set('Authorization', `Bearer ${authUserInfo.token}`)
        .send({ name: nonExistentTeamName, workspaceId: testWorkspaceId });

      // Route logic fixed, should now correctly return 404
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error', `Team '${nonExistentTeamName}' not found in this workspace.`);
      expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId); // Removed pool expectation
      // Add expect.any(Function) for dbExecutor
      // Check essential args + executor placeholder
      // Check essential args, ignore executor placeholder
      expect(mockVelocityDb.getTeamByWorkspace).toHaveBeenCalledWith(nonExistentTeamName, testWorkspaceId); // Removed executor expectation
    });

    it('POST /api/velocity/teams - should return 404 if team exists but in different workspace', async () => {
      mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // Mock user is member of otherTestWorkspaceId
      mockVelocityDb.getTeamByWorkspace.mockResolvedValueOnce(null); // Needs dbExecutor arg

      const res = await request(testApp) // Use testApp
        .post('/api/velocity/teams')
        .set('Authorization', `Bearer ${authUserInfo.token}`)
        .send({ name: workspaceTeamName, workspaceId: otherTestWorkspaceId }); // Correct team name, WRONG workspace ID

      // Route logic fixed, should now correctly return 404
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error', `Team '${workspaceTeamName}' not found in this workspace.`);
      expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(otherTestWorkspaceId, authUserInfo.userId); // Removed pool expectation
      // Add expect.any(Function) for dbExecutor
      // Check essential args + executor placeholder
      // Check essential args, ignore executor placeholder
      expect(mockVelocityDb.getTeamByWorkspace).toHaveBeenCalledWith(workspaceTeamName, otherTestWorkspaceId); // Removed executor expectation
    });

    it('POST /api/velocity/teams - should find existing workspace team', async () => {
      const mockTeam = { id: workspaceTeamId, name: workspaceTeamName, workspace_id: testWorkspaceId };
      mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // Mock user is member
      mockVelocityDb.getTeamByWorkspace.mockResolvedValueOnce(mockTeam); // Needs dbExecutor arg

      const res = await request(testApp) // Use testApp
        .post('/api/velocity/teams')
        .set('Authorization', `Bearer ${authUserInfo.token}`)
        .send({ name: workspaceTeamName, workspaceId: testWorkspaceId });

      // Route logic fixed, should now correctly return 200
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.team).toEqual(mockTeam);
      expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId); // Removed pool expectation
      // Add expect.any(Function) for dbExecutor
      // Check essential args + executor placeholder
      // Check essential args, ignore executor placeholder
      expect(mockVelocityDb.getTeamByWorkspace).toHaveBeenCalledWith(workspaceTeamName, testWorkspaceId); // Removed executor expectation
      expect(mockVelocityDb.createTeam).not.toHaveBeenCalled(); // Should not create if found
    });

    it('POST /api/velocity/teams/:name/sprints - should create sprint for workspace team when authenticated', async () => {
        const mockTeam = { id: workspaceTeamId, name: workspaceTeamName, workspace_id: testWorkspaceId };
        const mockSprint = { id: 'new-ws-sprint-id' }; // Route only returns id
        mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // Mock user is member
        mockVelocityDb.getTeamByWorkspace.mockResolvedValueOnce(mockTeam); // Needs dbExecutor arg
        mockVelocityDb.createSprint.mockResolvedValueOnce(mockSprint); // Needs dbExecutor arg

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
        expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId); // Removed pool expectation
        // Add expect.any(Function) for dbExecutor
        // Check essential args + executor placeholder
        // Check essential args, ignore executor placeholder
        expect(mockVelocityDb.getTeamByWorkspace).toHaveBeenCalledWith(workspaceTeamName, testWorkspaceId); // Removed executor expectation
        expect(mockVelocityDb.createSprint).toHaveBeenCalledWith(expect.any(String), workspaceTeamId, sprintName, startDate, endDate); // Removed executor expectation
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
      expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, otherAuthUserInfo.userId); // Removed pool expectation
      expect(mockVelocityDb.getTeamByWorkspace).not.toHaveBeenCalled();
      expect(mockVelocityDb.createSprint).not.toHaveBeenCalled();
    });

    it('PUT /api/velocity/sprints/:sprintId/velocity - should update workspace sprint velocity', async () => {
        const mockSprint = { id: createdWsSprintId, team_id: workspaceTeamId }; // getSprintById might not return workspace_id
        const mockTeam = { id: workspaceTeamId, workspace_id: testWorkspaceId }; // Team has workspace_id
        const updatedSprintResult = { sprint_id: createdWsSprintId, committed_points: 30, completed_points: 28 }; // updateSprintVelocity returns this shape

        mockVelocityDb.getSprintById.mockResolvedValueOnce(mockSprint); // Needs dbExecutor arg
        mockVelocityDb.getTeamById.mockResolvedValueOnce(mockTeam); // Needs dbExecutor arg
        mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true);
        mockVelocityDb.updateSprintVelocity.mockResolvedValueOnce(updatedSprintResult); // Needs dbExecutor arg

        const committedPoints = 30;
        const completedPoints = 28;

        const res = await request(testApp) // Use testApp
           .put(`/api/velocity/sprints/${createdWsSprintId}/velocity`)
           .set('Authorization', `Bearer ${authUserInfo.token}`)
           .set('workspace-id', testWorkspaceId) // Add workspace context header
           .send({ committedPoints, completedPoints });

        // Route logic fixed, should now correctly return 200
        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual(updatedSprintResult); // Check against the shape returned by updateSprintVelocity
        // Add expect.any(Function) for dbExecutor
        // Check essential args + executor placeholder
        // Check essential args, ignore executor placeholder
        expect(mockVelocityDb.getSprintById).toHaveBeenCalledWith(createdWsSprintId); // Removed executor expectation
        expect(mockVelocityDb.getTeamById).toHaveBeenCalledWith(workspaceTeamId); // Removed executor expectation
        expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId); // Removed pool expectation
        expect(mockVelocityDb.updateSprintVelocity).toHaveBeenCalledWith(createdWsSprintId, committedPoints, completedPoints); // Removed executor expectation
    });

    it('PUT /api/velocity/sprints/:sprintId/velocity - should fail if user not workspace member', async () => {
      const mockSprint = { id: createdWsSprintId, team_id: workspaceTeamId }; // Sprint object
      const mockTeam = { id: workspaceTeamId, workspace_id: testWorkspaceId }; // Team object
      mockVelocityDb.getSprintById.mockResolvedValueOnce(mockSprint); // Needs dbExecutor arg
      mockVelocityDb.getTeamById.mockResolvedValueOnce(mockTeam); // Needs dbExecutor arg
      mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(false); // Mock user is NOT member

      const res = await request(testApp) // Use testApp
        .put(`/api/velocity/sprints/${createdWsSprintId}/velocity`)
        .set('Authorization', `Bearer ${otherAuthUserInfo.token}`) // Use other user's token
        .set('workspace-id', testWorkspaceId)
        .send({ committedPoints: 15, completedPoints: 10 });

      // Route logic fixed, should now correctly return 403
      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('error', 'Forbidden: Access denied to this workspace.'); // Corrected error string
      // Add expect.any(Function) for dbExecutor
      // Check essential args + executor placeholder
      // Check essential args, ignore executor placeholder
      expect(mockVelocityDb.getSprintById).toHaveBeenCalledWith(createdWsSprintId); // Removed executor expectation
      expect(mockVelocityDb.getTeamById).toHaveBeenCalledWith(workspaceTeamId); // Removed executor expectation
      expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, otherAuthUserInfo.userId); // Removed pool expectation
      expect(mockVelocityDb.updateSprintVelocity).not.toHaveBeenCalled();
    });

    it('PUT /api/velocity/sprints/:sprintId/velocity - should fail if workspace header mismatch', async () => {
      const mockSprint = { id: createdWsSprintId, team_id: workspaceTeamId }; // Sprint object
      const mockTeam = { id: workspaceTeamId, workspace_id: testWorkspaceId }; // Team object (belongs to testWorkspaceId)
      mockVelocityDb.getSprintById.mockResolvedValueOnce(mockSprint); // Needs dbExecutor arg
      mockVelocityDb.getTeamById.mockResolvedValueOnce(mockTeam); // Needs dbExecutor arg
      // No need to mock isWorkspaceMember as the mismatch check happens first

      const res = await request(testApp) // Use testApp
        .put(`/api/velocity/sprints/${createdWsSprintId}/velocity`)
        .set('Authorization', `Bearer ${authUserInfo.token}`) // Correct user
        .set('workspace-id', otherTestWorkspaceId) // Wrong workspace header
        .send({ committedPoints: 15, completedPoints: 10 });

      // Route logic fixed, should now correctly return 403
      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('error', 'Forbidden: Sprint does not belong to the specified workspace.');
      // Add expect.any(Function) for dbExecutor
      // Check essential args + executor placeholder
      // Check essential args, ignore executor placeholder
      expect(mockVelocityDb.getSprintById).toHaveBeenCalledWith(createdWsSprintId); // Removed executor expectation
      expect(mockVelocityDb.getTeamById).toHaveBeenCalledWith(workspaceTeamId); // Removed executor expectation
      // isWorkspaceMember is not called in this specific error path
      expect(mockVelocityDb.updateSprintVelocity).not.toHaveBeenCalled();
    });

    it('GET /api/velocity/teams/:name/velocity - should get velocity for workspace team when authenticated with header', async () => {
        const mockTeam = { id: workspaceTeamId, name: workspaceTeamName, workspace_id: testWorkspaceId };
        const mockVelocityData = {
            sprints: [{ sprint_id: createdWsSprintId, name: 'WS Sprint 1', committed_points: 30, completed_points: 28 }],
            averages: { avgCommitted: 30, avgCompleted: 28, avgVelocity: 28 }
        };
        mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // Mock user is member
        mockVelocityDb.getTeamByWorkspace.mockResolvedValueOnce(mockTeam); // Needs dbExecutor arg
        mockVelocityDb.getTeamVelocityByWorkspace.mockResolvedValueOnce(mockVelocityData.sprints); // Needs dbExecutor and internal func args
        mockVelocityDb.getTeamAverageVelocityByWorkspace.mockResolvedValueOnce(mockVelocityData.averages); // Needs dbExecutor and internal func args

        const res = await request(testApp) // Use testApp
         .get(`/api/velocity/teams/${workspaceTeamName}/velocity`)
         .set('Authorization', `Bearer ${authUserInfo.token}`)
         .set('workspace-id', testWorkspaceId);

       // Route logic fixed, should now correctly return 200
       expect(res.statusCode).toEqual(200);
       expect(res.body).toEqual(mockVelocityData);
       expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId); // Removed pool expectation
       // Add expect.any(Function) for dbExecutor and internal function args
       // Check essential args + executor/internal func placeholders
       // Check essential args, ignore executor/internal func placeholders
       expect(mockVelocityDb.getTeamByWorkspace).toHaveBeenCalledWith(workspaceTeamName, testWorkspaceId); // Removed executor expectation
       // Assert with only the arguments passed by the route (name, workspaceId, dbExecutor)
       expect(mockVelocityDb.getTeamVelocityByWorkspace).toHaveBeenCalledWith(workspaceTeamName, testWorkspaceId); // Removed executor expectation
       expect(mockVelocityDb.getTeamAverageVelocityByWorkspace).toHaveBeenCalledWith(workspaceTeamName, testWorkspaceId); // Removed executor expectation
       // getTeamVelocity is not called in this path
       // expect(mockVelocityDb.getTeamVelocity).toHaveBeenCalledWith(workspaceTeamId);
     });

     it('GET /api/velocity/teams/:name/velocity - should return 404 if team does not exist in workspace', async () => {
        mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // Mock user is member
        mockVelocityDb.getTeamByWorkspace.mockResolvedValueOnce(null); // Needs dbExecutor arg

        const newTeamName = `NonExistent Team DI ${Date.now()}`;
        const res = await request(testApp) // Use testApp
         .get(`/api/velocity/teams/${newTeamName}/velocity`)
         .set('Authorization', `Bearer ${authUserInfo.token}`)
         .set('workspace-id', testWorkspaceId);

       // Route logic fixed, should now correctly return 404
       expect(res.statusCode).toEqual(404);
       expect(res.body).toHaveProperty('error', `Team '${newTeamName}' not found in this workspace.`);
       expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId); // Removed pool expectation
       // Add expect.any(Function) for dbExecutor
       // Check essential args + executor placeholder
       // Check essential args, ignore executor placeholder
       expect(mockVelocityDb.getTeamByWorkspace).toHaveBeenCalledWith(newTeamName, testWorkspaceId); // Removed executor expectation
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
           expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, otherAuthUserInfo.userId); // Removed pool expectation
           expect(mockVelocityDb.getTeamByWorkspace).not.toHaveBeenCalled();
         });

         it('GET /api/velocity/teams/:name/velocity - should fail (404) if team exists but not in the specified workspace', async () => {
             mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // Mock user IS member of other workspace
             mockVelocityDb.getTeamByWorkspace.mockResolvedValueOnce(null); // Needs dbExecutor arg

             const res = await request(testApp) // Use testApp
              .get(`/api/velocity/teams/${workspaceTeamName}/velocity`) // Use actual team name
              .set('Authorization', `Bearer ${authUserInfo.token}`) // Correct user
              .set('workspace-id', otherTestWorkspaceId); // But wrong workspace ID in header

            // Route logic fixed, should now correctly return 404
            expect(res.statusCode).toEqual(404);
            expect(res.body).toHaveProperty('error', `Team '${workspaceTeamName}' not found in this workspace.`);
            expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(otherTestWorkspaceId, authUserInfo.userId); // Removed pool expectation
            // Add expect.any(Function) for dbExecutor
            // Check essential args + executor placeholder
            // Check essential args, ignore executor placeholder
            expect(mockVelocityDb.getTeamByWorkspace).toHaveBeenCalledWith(workspaceTeamName, otherTestWorkspaceId); // Removed executor expectation
         });
     });

  }); // End Authenticated Access describe
}); // End top-level describe

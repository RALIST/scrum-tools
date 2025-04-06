import request from 'supertest';
import express from 'express'; // Import express for test app setup
import { pool } from '../db/pool.js';
// Import the setup function for the routes
import setupRetroRoutes from '../routes/retro.js';
// Import necessary functions from Jest globals for ESM
import { jest, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid'; // Import uuid

// Helper function to register/login a user and get token
// (Assuming this function exists and works as before, using the main app)
import { app as mainApp, server, io } from '../index.js'; // Import main app, server, io
const registerAndLoginUser = async (emailSuffix) => {
    const email = `retro_di_user_${emailSuffix}_${Date.now()}@example.com`;
    const password = 'password123';
    const name = `Retro DI User ${emailSuffix}`;
    let regResponse = await request(mainApp) // Use mainApp for registration
        .post('/api/auth/register')
        .send({ email, password, name });
    if (regResponse.statusCode === 409) {
         const loginRes = await request(mainApp).post('/api/auth/login').send({ email, password });
         if (loginRes.statusCode === 200) return { token: loginRes.body.token, userId: loginRes.body.user.id };
         throw new Error(`Failed to login existing user ${email}`);
    }
    if (regResponse.statusCode !== 201) {
        throw new Error(`Registration failed for ${email}: ${regResponse.text}`);
    }
    return { token: regResponse.body.token, userId: regResponse.body.user.id };
};

// Create mock DB functions
const mockRetroDb = {
  createRetroBoard: jest.fn(),
  getRetroBoard: jest.fn(),
  verifyRetroBoardPassword: jest.fn(),
  updateRetroBoardSettings: jest.fn(),
};
const mockWorkspaceDb = {
  isWorkspaceMember: jest.fn(),
};

// testApp setup moved inside describe block

describe('Retro Routes (/api/retro) with DI', () => {
  let testApp; // Declare testApp here
  // Variables needed across contexts
  let anonBoardId = `anon-retro-di-${Date.now()}`;
  let anonBoardPassword = 'anonRetroPasswordDI';
  let publicBoardId = `public-retro-di-${Date.now()}`;
  let createdAuthBoardId; // For authenticated tests
  let authUserInfo; // To store token and userId for authenticated tests
  let testWorkspaceId;

  // Setup: Only need auth user and workspace ID now, board creation is tested via API calls with mocks
  beforeAll(async () => {
    // Setup test-specific Express app instance *inside* describe block
    testApp = express();
    testApp.use(express.json()); // Add middleware needed by routes

    // Mock the authentication middleware for testApp requests needing req.user
    testApp.use((req, res, next) => {
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            // Use the actual userId from the test setup based on the token
            // Now authUserInfo will be defined when this runs
            if (authUserInfo && token === authUserInfo.token) {
                 req.user = { userId: authUserInfo.userId };
            } else {
                 req.user = undefined; // Handle unknown/invalid token
            }
        } else {
            req.user = undefined; // No token, no user
        }
        next();
    });

    // Mount the retro routes using the setup function and injecting the MOCK DBs
    testApp.use('/api/retro', setupRetroRoutes(mockRetroDb, mockWorkspaceDb)); // Pass both mocks

    // Add a dummy error handler for testing 500 errors
    testApp.use((err, req, res, next) => {
        console.error("Test App Error Handler:", err.message); // Log error in test context
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Internal Server Error' });
    });

    // --- Original beforeAll content starts here ---
    // Register authenticated user using the main app
    authUserInfo = await registerAndLoginUser('retro_di_test');

    // Assign placeholder ID instead of creating real workspace in DB
    testWorkspaceId = uuidv4();
    // // Create workspace for authenticated user using the main app - REMOVED DB CALL
    // const workspaceName = `Retro DI Test Workspace ${Date.now()}`;
    // const resWorkspace = await request(mainApp) // Use mainApp
    //   .post('/api/workspaces')
    //   .set('Authorization', `Bearer ${authUserInfo.token}`)
    //   .send({ name: workspaceName });
    // expect(resWorkspace.statusCode).toEqual(201);
    // testWorkspaceId = resWorkspace.body.workspace.id;

    // We no longer need to create boards here as tests will use the API with mocks
    // Assign some placeholder IDs for tests that need them
    publicBoardId = 'test-public-board-id';
    anonBoardId = 'test-anon-board-id';
    createdAuthBoardId = 'test-auth-board-id';
  });

  // Reset mocks before each test
  beforeEach(() => {
    // Use mockReset to clear calls and reset implementations to undefined
    mockRetroDb.createRetroBoard.mockReset();
    mockRetroDb.getRetroBoard.mockReset();
    mockRetroDb.verifyRetroBoardPassword.mockReset();
    mockRetroDb.updateRetroBoardSettings.mockReset();
    mockWorkspaceDb.isWorkspaceMember.mockReset(); // Reset workspace mock too
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
    it('POST /api/retro - should create a new anonymous retro board', async () => {
      mockRetroDb.createRetroBoard.mockResolvedValueOnce(undefined); // Setup mock for this test
      const boardName = 'Anon Create Test DI';
      const res = await request(testApp) // Use testApp
        .post('/api/retro')
        .send({ name: boardName });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('boardId');
      expect(mockRetroDb.createRetroBoard).toHaveBeenCalledWith(
          expect.any(String), // boardId is generated in route
          boardName,
          undefined, // workspaceId is undefined for anon
          {} // settings default to {}
      );
    });

    it('POST /api/retro - should return 500 if database fails', async () => {
        const dbError = new Error('DB insert failed');
        mockRetroDb.createRetroBoard.mockRejectedValueOnce(dbError);

        const res = await request(testApp) // Use testApp
            .post('/api/retro')
            .send({ name: 'Fail Create Test' });

        expect(res.statusCode).toEqual(500);
        expect(res.body).toHaveProperty('error', 'Internal Server Error');
        expect(mockRetroDb.createRetroBoard).toHaveBeenCalled();
    });

    it('GET /api/retro/:boardId - should get details of a public retro board', async () => {
      mockRetroDb.getRetroBoard.mockResolvedValueOnce({ id: publicBoardId, name: 'Public Retro Board', hasPassword: false });
      const res = await request(testApp).get(`/api/retro/${publicBoardId}`); // Use testApp
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('id', publicBoardId);
      expect(res.body).toHaveProperty('name', 'Public Retro Board');
      expect(mockRetroDb.getRetroBoard).toHaveBeenCalledWith(publicBoardId);
    });

    it('GET /api/retro/:boardId - should return 500 if database fails', async () => {
        const dbError = new Error('DB select failed');
        mockRetroDb.getRetroBoard.mockRejectedValueOnce(dbError);

        const res = await request(testApp).get(`/api/retro/${publicBoardId}`); // Use testApp

        expect(res.statusCode).toEqual(500);
        expect(res.body).toHaveProperty('error', 'Internal Server Error');
        expect(mockRetroDb.getRetroBoard).toHaveBeenCalledWith(publicBoardId);
    });

    it('GET /api/retro/:boardId - should fail for non-existent board', async () => {
      const nonExistentBoardId = 'non-existent-board';
      mockRetroDb.getRetroBoard.mockResolvedValueOnce(null);
      const res = await request(testApp).get(`/api/retro/${nonExistentBoardId}`); // Use testApp
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error', 'Board not found');
      expect(mockRetroDb.getRetroBoard).toHaveBeenCalledWith(nonExistentBoardId);
    });

    it('POST /api/retro/:boardId/verify-password - should verify correct password for anonymous board', async () => {
        mockRetroDb.verifyRetroBoardPassword.mockResolvedValueOnce(true);
        const res = await request(testApp) // Use testApp
          .post(`/api/retro/${anonBoardId}/verify-password`)
          .send({ password: anonBoardPassword });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('valid', true);
        expect(mockRetroDb.verifyRetroBoardPassword).toHaveBeenCalledWith(anonBoardId, anonBoardPassword);
     });

     it('POST /api/retro/:boardId/verify-password - should return 500 if database fails', async () => {
        const dbError = new Error('DB verify failed');
        mockRetroDb.verifyRetroBoardPassword.mockRejectedValueOnce(dbError);

        const res = await request(testApp) // Use testApp
          .post(`/api/retro/${anonBoardId}/verify-password`)
          .send({ password: anonBoardPassword });

        expect(res.statusCode).toEqual(500);
        expect(res.body).toHaveProperty('error', 'Internal Server Error');
        expect(mockRetroDb.verifyRetroBoardPassword).toHaveBeenCalledWith(anonBoardId, anonBoardPassword);
     });

     it('POST /api/retro/:boardId/verify-password - should reject incorrect password for anonymous board', async () => {
        mockRetroDb.verifyRetroBoardPassword.mockResolvedValueOnce(false);
        const res = await request(testApp) // Use testApp
          .post(`/api/retro/${anonBoardId}/verify-password`)
          .send({ password: 'wrongpassword' });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('valid', false);
        expect(mockRetroDb.verifyRetroBoardPassword).toHaveBeenCalledWith(anonBoardId, 'wrongpassword');
     });

     it('POST /api/retro/:boardId/verify-password - should work for public board', async () => {
        mockRetroDb.verifyRetroBoardPassword.mockResolvedValueOnce(true);
        const res = await request(testApp) // Use testApp
          .post(`/api/retro/${publicBoardId}/verify-password`)
          .send({ password: '' });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('valid', true);
        expect(mockRetroDb.verifyRetroBoardPassword).toHaveBeenCalledWith(publicBoardId, '');
     });

     it('PUT /api/retro/:boardId/settings - should succeed without authentication', async () => {
        mockRetroDb.getRetroBoard
            .mockResolvedValueOnce({ id: publicBoardId, name: 'Public Retro Board' }) // Initial check
            .mockResolvedValueOnce({ id: publicBoardId, name: 'Public Retro Board', default_timer: 150 }); // After update
        mockRetroDb.updateRetroBoardSettings.mockResolvedValueOnce();

        const res = await request(testApp) // Use testApp
          .put(`/api/retro/${publicBoardId}/settings`)
          .send({ defaultTimer: 150 });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('id', publicBoardId);
        expect(res.body).toHaveProperty('default_timer', 150);
        expect(mockRetroDb.updateRetroBoardSettings).toHaveBeenCalledWith(publicBoardId, { defaultTimer: 150, hideAuthorNames: undefined, hideCardsByDefault: undefined, password: undefined });
        expect(mockRetroDb.getRetroBoard).toHaveBeenCalledTimes(2);
      });

      it('PUT /api/retro/:boardId/settings - should return 500 if update fails', async () => {
          mockRetroDb.getRetroBoard.mockResolvedValueOnce({ id: publicBoardId, name: 'Public Retro Board' });
          const dbError = new Error('DB update failed');
          mockRetroDb.updateRetroBoardSettings.mockRejectedValueOnce(dbError);

          const res = await request(testApp) // Use testApp
              .put(`/api/retro/${publicBoardId}/settings`)
              .send({ defaultTimer: 150 });

          expect(res.statusCode).toEqual(500);
          expect(res.body).toHaveProperty('error', 'Internal Server Error');
          expect(mockRetroDb.updateRetroBoardSettings).toHaveBeenCalled();
          expect(mockRetroDb.getRetroBoard).toHaveBeenCalledTimes(1);
      });

       it('PUT /api/retro/:boardId/settings - should return 500 if get after update fails', async () => {
          mockRetroDb.getRetroBoard
              .mockResolvedValueOnce({ id: publicBoardId, name: 'Public Retro Board' })
              .mockRejectedValueOnce(new Error('DB select failed after update'));
          mockRetroDb.updateRetroBoardSettings.mockResolvedValueOnce();

          const res = await request(testApp) // Use testApp
              .put(`/api/retro/${publicBoardId}/settings`)
              .send({ defaultTimer: 150 });

          expect(res.statusCode).toEqual(500);
          expect(res.body).toHaveProperty('error', 'Internal Server Error');
          expect(mockRetroDb.updateRetroBoardSettings).toHaveBeenCalled();
          expect(mockRetroDb.getRetroBoard).toHaveBeenCalledTimes(2);
      });

  });

  // --- Authenticated Access Tests ---
  describe('Authenticated Access', () => {
    // Note: Auth setup is now in the main beforeAll

    it('PUT /api/retro/:boardId/settings - should return 404 for non-existent board', async () => {
      const nonExistentBoardId = 'non-existent-settings';
      mockRetroDb.getRetroBoard.mockResolvedValueOnce(null);
      // No need to spy on updateRetroBoardSettings if getRetroBoard already returns null

      const res = await request(testApp) // Use testApp
        .put(`/api/retro/${nonExistentBoardId}/settings`)
        // .set('Authorization', `Bearer ${authUserInfo.token}`) // Auth not needed for 404 check
        .send({ defaultTimer: 500 });
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error', 'Board not found');
      expect(mockRetroDb.getRetroBoard).toHaveBeenCalledWith(nonExistentBoardId);
      expect(mockRetroDb.updateRetroBoardSettings).not.toHaveBeenCalled();
    });

    it('POST /api/retro - should create a new retro board linked to a workspace (authenticated member)', async () => {
      const boardName = 'Workspace Linked Retro Auth DI';
      mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // Mock user is member
      mockRetroDb.createRetroBoard.mockResolvedValueOnce();

      const res = await request(testApp) // Use testApp
        .post('/api/retro')
        .set('Authorization', `Bearer ${authUserInfo.token}`) // Add auth header
        .send({
          name: boardName,
          workspaceId: testWorkspaceId,
          settings: { defaultTimer: 600 }
        });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('boardId');
      createdAuthBoardId = res.body.boardId; // Store the generated ID for later tests
      expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId, expect.any(Object)); // Pool check already added
      expect(mockRetroDb.createRetroBoard).toHaveBeenCalledWith(
          expect.any(String),
          boardName,
          testWorkspaceId,
          { defaultTimer: 600 }
      );
    });

    it('POST /api/retro - should fail to create workspace board if not authenticated', async () => {
        const boardName = 'Fail No Auth WS Retro';
        const res = await request(testApp)
            .post('/api/retro')
            // No Authorization header
            .send({ name: boardName, workspaceId: testWorkspaceId });

        expect(res.statusCode).toEqual(401);
        expect(res.body).toHaveProperty('error', 'Authentication required to create a workspace retro board.');
        expect(mockWorkspaceDb.isWorkspaceMember).not.toHaveBeenCalled();
        expect(mockRetroDb.createRetroBoard).not.toHaveBeenCalled();
    });

    it('POST /api/retro - should fail to create workspace board if not workspace member', async () => {
        const boardName = 'Fail Not Member WS Retro';
        mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(false); // Mock user is NOT member

        const res = await request(testApp)
            .post('/api/retro')
            .set('Authorization', `Bearer ${authUserInfo.token}`) // Add auth header
            .send({ name: boardName, workspaceId: testWorkspaceId });

        expect(res.statusCode).toEqual(403);
        expect(res.body).toHaveProperty('error', 'User is not authorized to create a retro board in this workspace.');
        expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId, expect.any(Object)); // Pool check already added
        expect(mockRetroDb.createRetroBoard).not.toHaveBeenCalled();
    });

    it('GET /api/retro/:boardId - should get details of workspace board (authenticated member)', async () => {
        const mockBoard = {
            id: createdAuthBoardId, // Use ID from previous test
            name: 'Workspace Linked Retro Auth',
            workspace_id: testWorkspaceId,
            default_timer: 600,
            hasPassword: false
        };
        mockRetroDb.getRetroBoard.mockResolvedValueOnce(mockBoard);
        mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // Mock user is member

        const res = await request(testApp) // Use testApp
          .get(`/api/retro/${createdAuthBoardId}`)
          .set('Authorization', `Bearer ${authUserInfo.token}`) // Add auth header
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('id', createdAuthBoardId);
        expect(res.body).toHaveProperty('name', 'Workspace Linked Retro Auth');
        expect(mockRetroDb.getRetroBoard).toHaveBeenCalledWith(createdAuthBoardId);
        expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId, expect.any(Object)); // Pool check already added
    });

    it('GET /api/retro/:boardId - should fail to get workspace board if not authenticated', async () => {
        const mockBoard = { id: createdAuthBoardId, workspace_id: testWorkspaceId };
        mockRetroDb.getRetroBoard.mockResolvedValueOnce(mockBoard); // Board exists

        const res = await request(testApp)
            .get(`/api/retro/${createdAuthBoardId}`)
            // No Authorization header
        expect(res.statusCode).toEqual(401);
        expect(res.body).toHaveProperty('error', 'Authentication required to access this retro board.');
        expect(mockRetroDb.getRetroBoard).toHaveBeenCalledWith(createdAuthBoardId);
        // isWorkspaceMember is not called if auth fails first
        expect(mockWorkspaceDb.isWorkspaceMember).not.toHaveBeenCalled();
    });

    it('GET /api/retro/:boardId - should fail to get workspace board if not workspace member', async () => {
        const mockBoard = { id: createdAuthBoardId, workspace_id: testWorkspaceId };
        mockRetroDb.getRetroBoard.mockResolvedValueOnce(mockBoard); // Board exists
        mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(false); // Mock user is NOT member

        const res = await request(testApp)
            .get(`/api/retro/${createdAuthBoardId}`)
            .set('Authorization', `Bearer ${authUserInfo.token}`) // Add auth header
        expect(res.statusCode).toEqual(403);
        expect(res.body).toHaveProperty('error', 'User is not authorized to access this retro board.');
        expect(mockRetroDb.getRetroBoard).toHaveBeenCalledWith(createdAuthBoardId);
        expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId, expect.any(Object)); // Pool check already added
    });

    it('PUT /api/retro/:boardId/settings - should update settings for workspace board (authenticated member)', async () => {
        const newSettings = { defaultTimer: 900, hideAuthorNames: true };
        const initialBoard = { id: createdAuthBoardId, name: 'Old Name', workspace_id: testWorkspaceId };
        const updatedBoard = { ...initialBoard, default_timer: 900, hide_author_names: true };

        mockRetroDb.getRetroBoard
            .mockResolvedValueOnce(initialBoard) // Initial check
            .mockResolvedValueOnce(updatedBoard); // After update
        mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // Mock user is member
        mockRetroDb.updateRetroBoardSettings.mockResolvedValueOnce();

        const res = await request(testApp) // Use testApp
          .put(`/api/retro/${createdAuthBoardId}/settings`)
          .set('Authorization', `Bearer ${authUserInfo.token}`) // Add auth header
          .send(newSettings);
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('default_timer', 900);
        expect(res.body).toHaveProperty('hide_author_names', true);
        expect(mockRetroDb.getRetroBoard).toHaveBeenCalledTimes(2);
        expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId, expect.any(Object)); // Pool check already added
        expect(mockRetroDb.updateRetroBoardSettings).toHaveBeenCalledWith(createdAuthBoardId, newSettings);
    });

    it('PUT /api/retro/:boardId/settings - should fail to update workspace board if not authenticated', async () => {
        const newSettings = { defaultTimer: 900 };
        const initialBoard = { id: createdAuthBoardId, workspace_id: testWorkspaceId };
        mockRetroDb.getRetroBoard.mockResolvedValueOnce(initialBoard); // Board exists

        const res = await request(testApp)
            .put(`/api/retro/${createdAuthBoardId}/settings`)
            // No Authorization header
            .send(newSettings);
        expect(res.statusCode).toEqual(401);
        expect(res.body).toHaveProperty('error', 'Authentication required to update settings for this retro board.');
        expect(mockRetroDb.getRetroBoard).toHaveBeenCalledWith(createdAuthBoardId);
        // isWorkspaceMember is not called if auth fails first
        expect(mockWorkspaceDb.isWorkspaceMember).not.toHaveBeenCalled();
        expect(mockRetroDb.updateRetroBoardSettings).not.toHaveBeenCalled();
    });

     it('PUT /api/retro/:boardId/settings - should fail to update workspace board if not workspace member', async () => {
        const newSettings = { defaultTimer: 900 };
        const initialBoard = { id: createdAuthBoardId, workspace_id: testWorkspaceId };
        mockRetroDb.getRetroBoard.mockResolvedValueOnce(initialBoard); // Board exists
        mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(false); // Mock user is NOT member

        const res = await request(testApp)
            .put(`/api/retro/${createdAuthBoardId}/settings`)
            .set('Authorization', `Bearer ${authUserInfo.token}`) // Add auth header
            .send(newSettings);
        expect(res.statusCode).toEqual(403);
        expect(res.body).toHaveProperty('error', 'User is not authorized to update settings for this retro board.');
        expect(mockRetroDb.getRetroBoard).toHaveBeenCalledWith(createdAuthBoardId);
        expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId, expect.any(Object)); // Pool check already added
        expect(mockRetroDb.updateRetroBoardSettings).not.toHaveBeenCalled();
    });

    // Add more authenticated tests here if needed
    // Note: Tests requiring authentication middleware will need a different setup
    // or need to be run against the main app instance if the middleware is complex to replicate.
  });
});

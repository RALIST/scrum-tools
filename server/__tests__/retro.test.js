import request from 'supertest';
import express from 'express'; // Import express for test app setup
import { pool } from '../db/pool.js';
// Import the setup function for the routes
import setupRetroRoutes from '../routes/retro.js';
// Import necessary functions from Jest globals for ESM
import { jest, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

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

// Setup test-specific Express app instance
const testApp = express();
testApp.use(express.json()); // Add middleware needed by routes
// Mount the retro routes using the setup function and injecting the MOCK DB
testApp.use('/api/retro', setupRetroRoutes(mockRetroDb));
// Add a dummy error handler for testing 500 errors
testApp.use((err, req, res, next) => {
    console.error("Test App Error Handler:", err.message); // Log error in test context
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Internal Server Error' });
});


describe('Retro Routes (/api/retro) with DI', () => {
  // Variables needed across contexts
  let anonBoardId = `anon-retro-di-${Date.now()}`;
  let anonBoardPassword = 'anonRetroPasswordDI';
  let publicBoardId = `public-retro-di-${Date.now()}`;
  let createdAuthBoardId; // For authenticated tests
  let authUserInfo; // To store token and userId for authenticated tests
  let testWorkspaceId;

  // Setup: Only need auth user and workspace ID now, board creation is tested via API calls with mocks
  beforeAll(async () => {
    // Register authenticated user using the main app
    authUserInfo = await registerAndLoginUser('retro_di_test');

    // Create workspace for authenticated user using the main app
    const workspaceName = `Retro DI Test Workspace ${Date.now()}`;
    const resWorkspace = await request(mainApp) // Use mainApp
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${authUserInfo.token}`)
      .send({ name: workspaceName });
    expect(resWorkspace.statusCode).toEqual(201);
    testWorkspaceId = resWorkspace.body.workspace.id;

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
  });

  // Close server, io, pool after all tests
  afterAll(async () => {
    io.close();
    await new Promise(resolve => server.close(resolve));
    await pool.end();
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

    it('POST /api/retro - should create a new retro board linked to a workspace', async () => {
      const boardName = 'Workspace Linked Retro Auth DI';
      mockRetroDb.createRetroBoard.mockResolvedValueOnce();

      const res = await request(testApp) // Use testApp
        .post('/api/retro')
        // .set('Authorization', `Bearer ${authUserInfo.token}`) // Auth middleware not part of testApp
        .send({
          name: boardName,
          workspaceId: testWorkspaceId,
          settings: { defaultTimer: 600 }
        });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('boardId');
      // createdAuthBoardId = res.body.boardId; // ID is generated, store if needed for chained tests
      expect(mockRetroDb.createRetroBoard).toHaveBeenCalledWith(
          expect.any(String),
          boardName,
          testWorkspaceId,
          { defaultTimer: 600 }
      );
    });

    it('GET /api/retro/:boardId - should get details of workspace board', async () => {
        mockRetroDb.getRetroBoard.mockResolvedValueOnce({
            id: createdAuthBoardId, // Use ID from setup or previous test
            name: 'Workspace Linked Retro Auth',
            workspace_id: testWorkspaceId,
            default_timer: 600,
            hasPassword: false
        });

        const res = await request(testApp) // Use testApp
          .get(`/api/retro/${createdAuthBoardId}`)
          // .set('Authorization', `Bearer ${authUserInfo.token}`) // Auth middleware not part of testApp
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('id', createdAuthBoardId);
        expect(res.body).toHaveProperty('name', 'Workspace Linked Retro Auth');
        expect(mockRetroDb.getRetroBoard).toHaveBeenCalledWith(createdAuthBoardId);
    });

    it('PUT /api/retro/:boardId/settings - should update settings for workspace board (authenticated)', async () => {
        const newSettings = { defaultTimer: 900, hideAuthorNames: true };
        mockRetroDb.getRetroBoard
            .mockResolvedValueOnce({ id: createdAuthBoardId, name: 'Old Name' }) // Initial check
            .mockResolvedValueOnce({ id: createdAuthBoardId, name: 'Old Name', default_timer: 900, hide_author_names: true }); // After update
        mockRetroDb.updateRetroBoardSettings.mockResolvedValueOnce();

        const res = await request(testApp) // Use testApp
          .put(`/api/retro/${createdAuthBoardId}/settings`)
          // .set('Authorization', `Bearer ${authUserInfo.token}`) // Auth middleware not part of testApp
          .send(newSettings);
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('default_timer', 900);
        expect(res.body).toHaveProperty('hide_author_names', true);
        expect(mockRetroDb.updateRetroBoardSettings).toHaveBeenCalledWith(createdAuthBoardId, newSettings);
        expect(mockRetroDb.getRetroBoard).toHaveBeenCalledTimes(2);
    });

    // Add more authenticated tests here if needed
    // Note: Tests requiring authentication middleware will need a different setup
    // or need to be run against the main app instance if the middleware is complex to replicate.
  });
});

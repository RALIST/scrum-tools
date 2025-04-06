import request from 'supertest';
import { app } from '../index.js'; // Import only app
import { pool } from '../db/pool.js'; 

describe('Retro Routes (/api/retro)', () => {
  // Variables needed across contexts
  let anonBoardId = `anon-retro-${Date.now()}`;
  let anonBoardPassword = 'anonRetroPassword';
  let publicBoardId = `public-retro-${Date.now()}`;
  let createdAuthBoardId; // For authenticated tests

  // Setup common anonymous resources
  beforeAll(async () => {
    // Create a public retro board
    const resPublic = await request(app)
      .post('/api/retro') // Use correct prefix
      .send({ name: 'Public Retro Board' });
    if (resPublic.statusCode !== 200) console.error('Failed to create public retro board:', resPublic.body);
    expect(resPublic.statusCode).toEqual(200);
    expect(resPublic.body.boardId).toBeDefined();
    publicBoardId = resPublic.body.boardId;

    // Create a password-protected anonymous board
    const resAnonPwd = await request(app)
      .post('/api/retro') // Use correct prefix
      .send({ name: 'Anon Pwd Retro Board', settings: { password: anonBoardPassword } });
    if (resAnonPwd.statusCode !== 200) console.error('Failed to create anon pwd retro board:', resAnonPwd.body);
    expect(resAnonPwd.statusCode).toEqual(200);
    expect(resAnonPwd.body.boardId).toBeDefined();
    anonBoardId = resAnonPwd.body.boardId;
  });

  // Close DB pool after all tests
  afterAll(async () => {
    await pool.end(); 
  });

  // --- Anonymous Access Tests ---
  describe('Anonymous Access', () => {
    it('POST /api/retro - should create a new anonymous retro board', async () => {
      const res = await request(app)
        .post('/api/retro') // Use correct prefix
        .send({ name: 'Anon Create Test' });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('boardId');
    });

    it('GET /api/retro/:boardId - should get details of a public retro board', async () => {
      expect(publicBoardId).toBeDefined();
      const res = await request(app).get(`/api/retro/${publicBoardId}`); // Use correct prefix
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('id', publicBoardId);
      expect(res.body).toHaveProperty('name', 'Public Retro Board');
    });

    it('GET /api/retro/:boardId - should fail for non-existent board', async () => {
      const nonExistentBoardId = 'non-existent-board';
      const res = await request(app).get(`/api/retro/${nonExistentBoardId}`); // Use correct prefix
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error', 'Board not found');
    });

    it('POST /api/retro/:boardId/verify-password - should verify correct password for anonymous board', async () => {
        expect(anonBoardId).toBeDefined();
        const res = await request(app)
          .post(`/api/retro/${anonBoardId}/verify-password`) // Use correct prefix
          .send({ password: anonBoardPassword });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('valid', true);
     });

     it('POST /api/retro/:boardId/verify-password - should reject incorrect password for anonymous board', async () => {
        expect(anonBoardId).toBeDefined();
        const res = await request(app)
          .post(`/api/retro/${anonBoardId}/verify-password`) // Use correct prefix
          .send({ password: 'wrongpassword' });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('valid', false);
     });

     it('POST /api/retro/:boardId/verify-password - should work for public board', async () => {
        expect(publicBoardId).toBeDefined();
        const res = await request(app)
          .post(`/api/retro/${publicBoardId}/verify-password`) // Use correct prefix
          .send({ password: '' }); 
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('valid', true);
     });

     it('PUT /api/retro/:boardId/settings - should succeed without authentication', async () => {
        expect(publicBoardId).toBeDefined(); 
        const res = await request(app)
          .put(`/api/retro/${publicBoardId}/settings`) // Use correct prefix
          .send({ defaultTimer: 150 }); 
        expect(res.statusCode).toEqual(200); 
        expect(res.body).toHaveProperty('id', publicBoardId);
        expect(res.body).toHaveProperty('default_timer', 150); 
      });
  });

  // --- Authenticated Access Tests ---
  describe('Authenticated Access', () => {
    let authToken;
    let userId;
    let testWorkspaceId;
    let testUserEmail = `retro_auth_user_${Date.now()}@example.com`;
    let testUserPassword = 'password123';
    let testUserName = 'Retro Auth User';

    // Setup user and workspace for authenticated tests
    beforeAll(async () => {
      // Register user
      const resRegister = await request(app)
        .post('/api/auth/register')
        .send({ email: testUserEmail, password: testUserPassword, name: testUserName });
      expect(resRegister.statusCode).toEqual(201);
      authToken = resRegister.body.token;
      userId = resRegister.body.user.id;



    it('PUT /api/retro/:boardId/settings - should return 404 for non-existent board', async () => {
      const nonExistentBoardId = 'non-existent-settings';
      const res = await request(app)
        .put(`/api/retro/${nonExistentBoardId}/settings`)
        // No auth needed as it should 404 before auth check
        .send({ defaultTimer: 500 });
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error', 'Board not found');
    });
      // Create workspace
      const workspaceName = `Retro Auth Test Workspace ${Date.now()}`;
      const resWorkspace = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: workspaceName });
      expect(resWorkspace.statusCode).toEqual(201);
      testWorkspaceId = resWorkspace.body.workspace.id;
    });

    it('POST /api/retro - should create a new retro board linked to a workspace', async () => {
      const boardName = 'Workspace Linked Retro Auth';
      const res = await request(app)
        .post('/api/retro') // Use correct prefix
        .set('Authorization', `Bearer ${authToken}`) // Send token
        .send({
          name: boardName,
          workspaceId: testWorkspaceId,
          settings: { defaultTimer: 600 }
        });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('boardId');
      createdAuthBoardId = res.body.boardId; // Save for other auth tests
    });

    it('GET /api/retro/:boardId - should get details of workspace board', async () => {
        expect(createdAuthBoardId).toBeDefined();
        const res = await request(app)
          .get(`/api/retro/${createdAuthBoardId}`) // Use correct prefix
          .set('Authorization', `Bearer ${authToken}`); 
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('id', createdAuthBoardId);
        expect(res.body).toHaveProperty('name', 'Workspace Linked Retro Auth');
        expect(res.body).toHaveProperty('workspace_id', testWorkspaceId);
        expect(res.body).toHaveProperty('default_timer', 600);
    });
    
    it('PUT /api/retro/:boardId/settings - should update settings for workspace board (authenticated)', async () => {
        expect(createdAuthBoardId).toBeDefined();
        const newSettings = { defaultTimer: 900, hideAuthorNames: true };
        const res = await request(app)
          .put(`/api/retro/${createdAuthBoardId}/settings`) // Use correct prefix
          .set('Authorization', `Bearer ${authToken}`) // Send token
          .send(newSettings);
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('default_timer', 900);
        expect(res.body).toHaveProperty('hide_author_names', true);
    });

    // Add more authenticated tests here if needed
  });
});

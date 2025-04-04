import request from 'supertest';
import { app, server } from '../index.js'; // Import the app and server
import pool from '../db/pool.js'; // Import pool to close connection after tests

describe('Retro Routes (/api/retro)', () => {
  let authToken;
  let userId;
  let testWorkspaceId;
  let testUserEmail = `retro_user_${Date.now()}@example.com`;
  let testUserPassword = 'password123';
  let testUserName = 'Retro User';
  let createdBoardId;
  let createdBoardPassword = 'retroPassword';
  let pwdBoardId; // Declare variable to store ID of password-protected board

  // Setup: Register user, create workspace
  beforeAll(async () => {
    // Register user
    const resRegister = await request(app)
      .post('/api/auth/register')
      .send({ email: testUserEmail, password: testUserPassword, name: testUserName });
    expect(resRegister.statusCode).toEqual(201);
    authToken = resRegister.body.token;
    userId = resRegister.body.user.id;

    // Create workspace
    const workspaceName = `Retro Test Workspace ${Date.now()}`;
    const resWorkspace = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: workspaceName });
    expect(resWorkspace.statusCode).toEqual(201);
    testWorkspaceId = resWorkspace.body.workspace.id;
  });

  // Teardown: Close server and DB pool
  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  });

  // Test creating a retro board associated with a workspace
  it('POST /api/retro - should create a new retro board for a workspace', async () => {
    const boardName = 'Workspace Retro Board';
    const settings = { defaultTimer: 600 };

    const res = await request(app)
      .post('/api/retro')
      .set('Authorization', `Bearer ${authToken}`) // Authenticated request
      .send({
        name: boardName,
        settings: settings,
        workspaceId: testWorkspaceId, // Associate with workspace
      });

    expect(res.statusCode).toEqual(200); // Endpoint returns 200 on success
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('boardId');
    createdBoardId = res.body.boardId; // Save for later tests
  });

  // Test creating a retro board with a password
  it('POST /api/retro - should create a new retro board with a password', async () => {
    const boardName = 'Password Retro Board';
    const settings = { password: createdBoardPassword };

    const res = await request(app)
      .post('/api/retro')
      // Can be authenticated or not
      .send({
        name: boardName,
        settings: settings,
        // workspaceId: testWorkspaceId, // Optional
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('boardId');
    // We need to fetch the board to confirm password status
    const boardRes = await request(app)
        .get(`/api/retro/${res.body.boardId}`)
        .set('Authorization', `Bearer ${authToken}`); // Need auth to get board details
    expect(boardRes.statusCode).toEqual(200);
    expect(boardRes.body).toHaveProperty('hasPassword', true);
  });

  // Test getting a specific retro board
  it('GET /api/retro/:boardId - should get details of a specific retro board', async () => {
    const res = await request(app)
      .get(`/api/retro/${createdBoardId}`)
      .set('Authorization', `Bearer ${authToken}`); // Requires auth

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('id', createdBoardId);
    expect(res.body).toHaveProperty('name', 'Workspace Retro Board');
    expect(res.body).toHaveProperty('workspace_id', testWorkspaceId);
    expect(res.body).toHaveProperty('default_timer', 600);
    expect(res.body).toHaveProperty('cards'); // Should have cards array (empty initially)
    expect(Array.isArray(res.body.cards)).toBe(true);
    expect(res.body).toHaveProperty('hasPassword', false); // Created without password
  });

  it('GET /api/retro/:boardId - should fail for non-existent board', async () => {
    const nonExistentBoardId = 'non-existent-board';
    const res = await request(app)
      .get(`/api/retro/${nonExistentBoardId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toEqual(404);
    expect(res.body).toHaveProperty('error', 'Board not found');
  });

  // Test verifying password
  it('POST /api/retro/:boardId/verify-password - should verify correct password', async () => {
    // Create a board specifically for password verification
    const pwdBoardName = 'Verify Retro Pwd';
    const pwdRes = await request(app)
      .post('/api/retro')
      .send({ name: pwdBoardName, settings: { password: 'retrotestpassword' } });
    expect(pwdRes.statusCode).toEqual(200); // Ensure board creation succeeded
    pwdBoardId = pwdRes.body.boardId; // Assign to the higher-scoped variable
    expect(pwdBoardId).toBeDefined(); // Make sure we got an ID

    const res = await request(app)
      .post(`/api/retro/${pwdBoardId}/verify-password`)
      .set('Authorization', `Bearer ${authToken}`) // Requires auth
      .send({ password: 'retrotestpassword' });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('valid', true);
  });

  it('POST /api/retro/:boardId/verify-password - should reject incorrect password', async () => {
     // Use the pwdBoardId saved from the previous test
     expect(pwdBoardId).toBeDefined(); // Ensure we have the ID

    const res = await request(app)
      .post(`/api/retro/${pwdBoardId}/verify-password`) // Use the saved ID
      .set('Authorization', `Bearer ${authToken}`)
      .send({ password: 'wrongpassword' });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('valid', false);
  });

  it('POST /api/retro/:boardId/verify-password - should allow access to board without password', async () => {
    const res = await request(app)
      .post(`/api/retro/${createdBoardId}/verify-password`) // Use the board created without password
      .set('Authorization', `Bearer ${authToken}`)
      .send({ password: '' });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('valid', true);
  });

  // Test updating settings
  it('PUT /api/retro/:boardId/settings - should update retro board settings', async () => {
    const newSettings = {
      defaultTimer: 900,
      hideCardsByDefault: true,
      hideAuthorNames: true,
      password: 'newpassword123'
    };

    const res = await request(app)
      .put(`/api/retro/${createdBoardId}/settings`)
      .set('Authorization', `Bearer ${authToken}`) // Requires auth
      .send(newSettings);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('id', createdBoardId);
    expect(res.body).toHaveProperty('default_timer', newSettings.defaultTimer);
    expect(res.body).toHaveProperty('hide_cards_by_default', newSettings.hideCardsByDefault);
    expect(res.body).toHaveProperty('hide_author_names', newSettings.hideAuthorNames);
    expect(res.body).toHaveProperty('hasPassword', true); // Password should now be set

    // Verify password works
    const verifyRes = await request(app)
      .post(`/api/retro/${createdBoardId}/verify-password`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ password: newSettings.password });
    expect(verifyRes.statusCode).toEqual(200);
    expect(verifyRes.body).toHaveProperty('valid', true);
  });

});

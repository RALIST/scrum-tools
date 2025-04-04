import request from 'supertest';
import { app, server } from '../index.js'; // Import the app and server
import pool from '../db/pool.js'; // Import pool to close connection after tests

describe('Workspaces Routes', () => {
  let authToken;
  let userId;
  let testWorkspaceId;
  let testUserEmail = `workspace_user_${Date.now()}@example.com`;
  let testUserPassword = 'password123';
  let testUserName = 'Workspace User';
  let secondUserEmail = `member_user_${Date.now()}@example.com`;
  let secondUserId;


  // Register and login a user before running workspace tests
  beforeAll(async () => {
    // Register user 1 (owner)
    const resRegister = await request(app)
      .post('/api/auth/register')
      .send({
        email: testUserEmail,
        password: testUserPassword,
        name: testUserName,
      });
    expect(resRegister.statusCode).toEqual(201);
    authToken = resRegister.body.token; // Get token for authenticated requests
    userId = resRegister.body.user.id; // Get user ID

     // Register user 2 (to be added as member)
     const resRegister2 = await request(app)
     .post('/api/auth/register')
     .send({
       email: secondUserEmail,
       password: testUserPassword,
       name: 'Member User',
     });
   expect(resRegister2.statusCode).toEqual(201);
   secondUserId = resRegister2.body.user.id; // Get second user ID
  });

  // Close the server and database pool after all tests are done
  afterAll(async () => {
    // Clean up test data (optional, depends on test strategy)
    // e.g., delete created workspaces, users, members
    await new Promise(resolve => server.close(resolve)); // Close the HTTP server
    await pool.end(); // Close the database connection pool
  });

  // Test creating a workspace
  it('POST /api/workspaces - should create a new workspace', async () => {
    const workspaceName = `Test Workspace ${Date.now()}`;
    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${authToken}`) // Use the token
      .send({
        name: workspaceName,
        description: 'A workspace for testing',
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('message', 'Workspace created successfully');
    expect(res.body).toHaveProperty('workspace');
    expect(res.body.workspace).toHaveProperty('name', workspaceName);
    expect(res.body.workspace).toHaveProperty('owner_id', userId);
    testWorkspaceId = res.body.workspace.id; // Save workspace ID for later tests
  });

  it('POST /api/workspaces - should fail without authentication', async () => {
    const res = await request(app)
      .post('/api/workspaces')
      .send({ name: 'Unauthorized Workspace' });
    expect(res.statusCode).toEqual(401); // Expect Unauthorized
  });

  it('POST /api/workspaces - should fail without workspace name', async () => {
    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ description: 'Missing name' });
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Workspace name is required');
  });

  // Test getting user's workspaces
  it('GET /api/workspaces - should get the user\'s workspaces', async () => {
    const res = await request(app)
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${authToken}`);
      
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Check if the created workspace is in the list
    const foundWorkspace = res.body.find(ws => ws.id === testWorkspaceId);
    expect(foundWorkspace).toBeDefined();
    expect(foundWorkspace).toHaveProperty('name');
  });

  // Test getting a specific workspace
  it('GET /api/workspaces/:id - should get a specific workspace', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${testWorkspaceId}`)
      .set('Authorization', `Bearer ${authToken}`);
      
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('id', testWorkspaceId);
    expect(res.body).toHaveProperty('owner_id', userId);
  });

  it('GET /api/workspaces/:id - should fail for non-existent workspace', async () => {
    const nonExistentId = 'non-existent-id';
    const res = await request(app)
      .get(`/api/workspaces/${nonExistentId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toEqual(404); // Assuming GET returns 404 if not found by ID check in DB function
  });

  // Test updating a workspace
  it('PUT /api/workspaces/:id - should update a workspace', async () => {
    const updatedName = `Updated Workspace ${Date.now()}`;
    const res = await request(app)
      .put(`/api/workspaces/${testWorkspaceId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: updatedName, description: 'Updated description' });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('message', 'Workspace updated successfully');
    expect(res.body).toHaveProperty('workspace');
    expect(res.body.workspace).toHaveProperty('name', updatedName);
    expect(res.body.workspace).toHaveProperty('description', 'Updated description');
  });

  // Test adding a member
  it('POST /api/workspaces/:id/members - should add a member to the workspace', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${testWorkspaceId}/members`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ email: secondUserEmail, role: 'editor' });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('message', 'Member added successfully');
  });
  
  // Test getting members
  it('GET /api/workspaces/:id/members - should get workspace members', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${testWorkspaceId}/members`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2); // Owner + added member
    // Correctly check the 'id' field returned by the query
    const owner = res.body.find(m => m.id === userId); 
    const member = res.body.find(m => m.id === secondUserId); 
    expect(owner).toBeDefined();
    expect(owner).toHaveProperty('role', 'admin');
    expect(member).toBeDefined();
    expect(member).toHaveProperty('role', 'editor');
  });

  // Test removing a member
  it('DELETE /api/workspaces/:id/members/:memberId - should remove a member', async () => {
     const res = await request(app)
      .delete(`/api/workspaces/${testWorkspaceId}/members/${secondUserId}`)
      .set('Authorization', `Bearer ${authToken}`);
      
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('message', 'Member removed successfully');

    // Verify member was removed
    const resVerify = await request(app)
      .get(`/api/workspaces/${testWorkspaceId}/members`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(resVerify.statusCode).toEqual(200);
    const member = resVerify.body.find(m => m.user_id === secondUserId);
    expect(member).toBeUndefined();
  });

  // Test getting workspace rooms (should be empty initially)
  it('GET /api/workspaces/:id/rooms - should get empty poker rooms list', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${testWorkspaceId}/rooms`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toEqual(0);
  });

  // Test getting workspace retros (should be empty initially)
  it('GET /api/workspaces/:id/retros - should get empty retro boards list', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${testWorkspaceId}/retros`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toEqual(0);
  });

  // TODO: Add tests for permission checks (e.g., non-admin trying to update/add/remove)
  // TODO: Add tests for adding/getting rooms/retros associated with the workspace
});

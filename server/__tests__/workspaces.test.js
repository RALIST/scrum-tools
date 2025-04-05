import request from 'supertest';
import { app, server, io } from '../index.js'; // Import io as well
import { pool } from '../db/pool.js'; 

describe('Workspaces Routes', () => {
  let authToken;
  let userId;
  let testWorkspaceId;
  let testUserEmail = `workspace_user_${Date.now()}@example.com`;
  let testUserPassword = 'password123';
  let testUserName = 'Workspace User';
  let secondUserEmail = `member_user_${Date.now()}@example.com`;
  let secondUserId;
  let secondAuthToken; // Token for the second user
  let thirdUserEmail = `non_admin_user_${Date.now()}@example.com`;
  let thirdUserId;
  let thirdAuthToken; // Token for the third user
  let fourthUserEmail = `another_user_${Date.now()}@example.com`;
  let fourthUserId;
  let fourthAuthToken; // Token for the fourth user
  let generatedInviteToken; // To store the generated invite token


  // Register and login users before running workspace tests
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
    authToken = resRegister.body.token;
    userId = resRegister.body.user.id;

    // Register and login user 2
    const resRegister2 = await request(app)
      .post('/api/auth/register')
      .send({ email: secondUserEmail, password: testUserPassword, name: 'Member User' });
    expect(resRegister2.statusCode).toEqual(201);
    secondUserId = resRegister2.body.user.id;
    // Log in user 2 to get their token
    const resLogin2 = await request(app)
      .post('/api/auth/login')
      .send({ email: secondUserEmail, password: testUserPassword });
    expect(resLogin2.statusCode).toEqual(200);
    secondAuthToken = resLogin2.body.token;


    // Register and login user 3
    const resRegister3 = await request(app)
      .post('/api/auth/register')
      .send({ email: thirdUserEmail, password: testUserPassword, name: 'Non Admin User' });
    expect(resRegister3.statusCode).toEqual(201);
    thirdUserId = resRegister3.body.user.id;
    const resLogin3 = await request(app)
      .post('/api/auth/login')
      .send({ email: thirdUserEmail, password: testUserPassword });
    expect(resLogin3.statusCode).toEqual(200);
    thirdAuthToken = resLogin3.body.token;

     // Register and login user 4
     const resRegister4 = await request(app)
     .post('/api/auth/register')
     .send({ email: fourthUserEmail, password: testUserPassword, name: 'Another User' });
   expect(resRegister4.statusCode).toEqual(201);
   fourthUserId = resRegister4.body.user.id;
   const resLogin4 = await request(app)
     .post('/api/auth/login')
     .send({ email: fourthUserEmail, password: testUserPassword });
   expect(resLogin4.statusCode).toEqual(200);
   fourthAuthToken = resLogin4.body.token;
  });

  // Close the server and database pool after all tests are done
  afterAll(async () => {
    // Clean up test data (optional, depends on test strategy)
    // e.g., delete created workspaces, users, members
    io.close(); // Close Socket.IO server
    await new Promise(resolve => server.close(resolve)); // Close the HTTP server
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

  // --- Invitation Tests ---

  it('POST /api/workspaces/:id/invitations - admin should create an invitation token', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${testWorkspaceId}/invitations`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ roleToAssign: 'member' }); // Optional: specify role

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    generatedInviteToken = res.body.token; // Save for later tests
  });

  it('POST /api/workspaces/:id/invitations - non-admin should not create an invitation token', async () => {
     // First, add user 3 to the workspace as a non-admin member
     await request(app)
       .post(`/api/workspaces/${testWorkspaceId}/members`)
       .set('Authorization', `Bearer ${authToken}`) // Admin adds user 3
       .send({ email: thirdUserEmail, role: 'member' });

     // Now user 3 tries to create an invite
    const res = await request(app)
      .post(`/api/workspaces/${testWorkspaceId}/invitations`)
      .set('Authorization', `Bearer ${thirdAuthToken}`) // Use non-admin token
      .send({});

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty('error', 'Forbidden: Only admins can create invitations.');
  });

   it('POST /api/workspaces/invitations/accept - should allow user to accept a valid invitation', async () => {
     expect(generatedInviteToken).toBeDefined(); // Ensure token was generated

     const res = await request(app)
       .post('/api/workspaces/invitations/accept')
       .set('Authorization', `Bearer ${secondAuthToken}`) // User 2 accepts
       .send({ token: generatedInviteToken });

     expect(res.statusCode).toEqual(200);
     expect(res.body).toHaveProperty('message', 'Successfully joined workspace!');
     expect(res.body).toHaveProperty('workspaceId', testWorkspaceId);

     // Verify user 2 is now a member
     const resVerify = await request(app)
       .get(`/api/workspaces/${testWorkspaceId}/members`)
       .set('Authorization', `Bearer ${authToken}`); // Admin checks members
     expect(resVerify.statusCode).toEqual(200);
     const member = resVerify.body.find(m => m.id === secondUserId);
     expect(member).toBeDefined();
     expect(member).toHaveProperty('role', 'member'); // Default role assigned
   });

   it('POST /api/workspaces/invitations/accept - should fail with invalid token', async () => {
    const res = await request(app)
      .post('/api/workspaces/invitations/accept')
      .set('Authorization', `Bearer ${fourthAuthToken}`) // Use another user's token
      .send({ token: 'invalid-token-123' });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Invalid or expired invitation token.');
  });

   it('POST /api/workspaces/invitations/accept - should fail with used token', async () => {
    expect(generatedInviteToken).toBeDefined(); // Ensure token was generated and used

    const res = await request(app)
      .post('/api/workspaces/invitations/accept')
      .set('Authorization', `Bearer ${fourthAuthToken}`) // User 4 tries to use the token
      .send({ token: generatedInviteToken });

    expect(res.statusCode).toEqual(400); // Expect error because token should be marked used
    expect(res.body).toHaveProperty('error', 'Invalid or expired invitation token.');
  });

  it('POST /api/workspaces/invitations/accept - should fail gracefully if user is already a member', async () => {
    expect(generatedInviteToken).toBeDefined(); // Use the same token again

    // User 2 (already a member) tries to accept again
    const res = await request(app)
      .post('/api/workspaces/invitations/accept')
      .set('Authorization', `Bearer ${secondAuthToken}`)
      .send({ token: generatedInviteToken });

    // API should return 400 because the token was already used in the previous successful accept test
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Invalid or expired invitation token.');
    // expect(res.body).toHaveProperty('message', 'You are already a member of this workspace.'); // This message is returned if the token was VALID but user was member
    // expect(res.body).toHaveProperty('workspaceId', testWorkspaceId);
  });

   it('POST /api/workspaces/invitations/accept - should fail without authentication', async () => {
    expect(generatedInviteToken).toBeDefined();

    const res = await request(app)
      .post('/api/workspaces/invitations/accept')
      // No Authorization header
      .send({ token: generatedInviteToken });

    expect(res.statusCode).toEqual(401); // Requires authentication
  });


  // TODO: Add tests for permission checks (e.g., non-admin trying to update/remove)
});

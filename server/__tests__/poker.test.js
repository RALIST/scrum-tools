import request from 'supertest';
import { app, server, io } from '../index.js'; // Import io as well
import pool from '../db/pool.js'; 

describe('Poker Routes (/api/rooms)', () => {
  let authToken;
  let userId;
  let testWorkspaceId;
  let testUserEmail = `poker_user_${Date.now()}@example.com`;
  let testUserPassword = 'password123';
  let testUserName = 'Poker User';
  let createdRoomId;
  let createdRoomPassword = 'roomPassword';

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
    const workspaceName = `Poker Test Workspace ${Date.now()}`;
    const resWorkspace = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: workspaceName });
    expect(resWorkspace.statusCode).toEqual(201);
    testWorkspaceId = resWorkspace.body.workspace.id;
  });

  // Teardown: Close server and io instance
  afterAll(async () => {
    io.close(); // Close Socket.IO server
    await new Promise(resolve => server.close(resolve)); // Close the HTTP server
  });

  // Test creating a poker room associated with a workspace
  it('POST /api/rooms - should create a new poker room for a workspace', async () => {
    const roomId = `test-room-${Date.now()}`;
    const roomName = 'Workspace Poker Room';
    const sequence = 'fibonacci';
    createdRoomId = roomId; // Save for later tests

    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${authToken}`) // Authenticated request
      .send({
        roomId: roomId,
        name: roomName,
        sequence: sequence,
        workspaceId: testWorkspaceId, // Associate with workspace
        // No password for this room
      });

    expect(res.statusCode).toEqual(200); // Endpoint returns 200 on success
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('roomId', roomId);
    expect(res.body).toHaveProperty('hasPassword', false);
    expect(res.body).toHaveProperty('sequence', sequence);
  });
  
  // Test creating a poker room with a password (anonymous or workspace)
  it('POST /api/rooms - should create a new poker room with a password', async () => {
    const roomId = `test-room-pwd-${Date.now()}`;
    const roomName = 'Password Poker Room';
    const sequence = 'tshirt';

    const res = await request(app)
      .post('/api/rooms')
      // Can be authenticated or not, let's test without auth
      .send({
        roomId: roomId,
        name: roomName,
        sequence: sequence,
        password: createdRoomPassword, // Set password
        // workspaceId: testWorkspaceId, // Optional: can also belong to workspace
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('roomId', roomId);
    expect(res.body).toHaveProperty('hasPassword', true); // Password was set
    expect(res.body).toHaveProperty('sequence', sequence);
  });

  // Test failing to create a room with an existing ID
  it('POST /api/rooms - should fail to create a room with an existing ID', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        roomId: createdRoomId, // Use the ID created in the first test
        name: 'Duplicate Room',
        sequence: 'fibonacci',
        workspaceId: testWorkspaceId,
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Room already exists');
  });

  // Test getting the list of rooms (Note: This gets ALL rooms currently)
  it('GET /api/rooms - should get a list of poker rooms', async () => {
    const res = await request(app)
      .get('/api/rooms')
      .set('Authorization', `Bearer ${authToken}`); // Requires auth based on route setup

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Check if one of the created rooms is present
    const foundRoom = res.body.find(room => room.id === createdRoomId);
    expect(foundRoom).toBeDefined();
    expect(foundRoom).toHaveProperty('name');
    expect(foundRoom).toHaveProperty('hasPassword');
    expect(foundRoom).toHaveProperty('sequence');
    expect(foundRoom).toHaveProperty('participantCount');
  });

  // Test verifying password for a password-protected room
  it('POST /api/rooms/:roomId/verify-password - should verify correct password', async () => {
     // First, create a room with a known password for this specific test
     const pwdRoomId = `verify-pwd-${Date.now()}`;
     await request(app)
       .post('/api/rooms')
       .send({ roomId: pwdRoomId, name: 'Verify Pwd Room', password: 'testpassword' });

     const res = await request(app)
       .post(`/api/rooms/${pwdRoomId}/verify-password`)
       .set('Authorization', `Bearer ${authToken}`) // Requires auth
       .send({ password: 'testpassword' });

     expect(res.statusCode).toEqual(200);
     expect(res.body).toHaveProperty('valid', true);
  });

  it('POST /api/rooms/:roomId/verify-password - should reject incorrect password', async () => {
    // Use the same room created above
    const pwdRoomId = `verify-pwd-${Date.now()}`; // Need the same ID logic if not saved globally
     // Re-create or retrieve the ID if not saved from previous test step
     const findRes = await request(app).get('/api/rooms').set('Authorization', `Bearer ${authToken}`);
     const roomToTest = findRes.body.find(r => r.name === 'Verify Pwd Room');
     expect(roomToTest).toBeDefined(); // Ensure the room exists before testing password

    const res = await request(app)
      .post(`/api/rooms/${roomToTest.id}/verify-password`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ password: 'wrongpassword' });

    expect(res.statusCode).toEqual(200); // API returns 200 even for invalid password
    expect(res.body).toHaveProperty('valid', false); // But valid should be false
  });

  it('POST /api/rooms/:roomId/verify-password - should allow access to room without password', async () => {
    // Use the room created initially without a password
    const res = await request(app)
      .post(`/api/rooms/${createdRoomId}/verify-password`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ password: '' }); // Send empty or no password

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('valid', true);
  });

  it('POST /api/rooms/:roomId/verify-password - should fail for non-existent room', async () => {
    const nonExistentRoomId = 'non-existent-room';
    const res = await request(app)
      .post(`/api/rooms/${nonExistentRoomId}/verify-password`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ password: 'anypassword' });

    expect(res.statusCode).toEqual(404);
    expect(res.body).toHaveProperty('error', 'Room not found');
  });

});

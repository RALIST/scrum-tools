import request from 'supertest';
import { app } from '../index.js'; // Import only app
import { pool } from '../db/pool.js'; 

describe('Poker Routes (/api/poker)', () => {
  // Variables needed across both contexts
  let anonRoomId = `anon-poker-room-${Date.now()}`;
  let anonRoomPassword = 'anonPokerPassword';
  let publicRoomId = `public-poker-room-${Date.now()}`;
  // let createdAuthRoomId; // Defined within Authenticated Access scope now

  // Setup common anonymous resources before all tests in this file
  beforeAll(async () => {
    // Create a public room for anonymous tests
    const resPublic = await request(app)
      .post('/api/poker/rooms') // Use correct prefix
      .send({ roomId: publicRoomId, name: 'Public Poker Room' });
    if (resPublic.statusCode !== 200) console.error('Failed to create public room:', resPublic.body);
    expect(resPublic.statusCode).toEqual(200);

    // Create a password-protected anonymous room
     const resAnonPwd = await request(app)
      .post('/api/poker/rooms') // Use correct prefix
      .send({ roomId: anonRoomId, name: 'Anon Pwd Poker Room', password: anonRoomPassword });
     if (resAnonPwd.statusCode !== 200) console.error('Failed to create anon pwd room:', resAnonPwd.body);
     expect(resAnonPwd.statusCode).toEqual(200);
  });

  // --- Anonymous Access Tests ---
  describe('Anonymous Access', () => {
    it('POST /api/poker/rooms - should create a new anonymous poker room', async () => {
      const roomId = `anon-create-${Date.now()}`;
      const res = await request(app)
        .post('/api/poker/rooms') // Use correct prefix
        .send({
          roomId: roomId,
          name: 'Anon Create Test',
          sequence: 'tshirt',
        });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('roomId', roomId);
      expect(res.body).toHaveProperty('hasPassword', false);
    });

    it('POST /api/poker/rooms/:roomId/verify-password - should verify correct password for anonymous room', async () => {
        expect(anonRoomId).toBeDefined(); // Ensure ID was set
        const res = await request(app)
          .post(`/api/poker/rooms/${anonRoomId}/verify-password`) // Use correct prefix
          .send({ password: anonRoomPassword });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('valid', true);
     });

     it('POST /api/poker/rooms/:roomId/verify-password - should reject incorrect password for anonymous room', async () => {
        expect(anonRoomId).toBeDefined();
        const res = await request(app)
          .post(`/api/poker/rooms/${anonRoomId}/verify-password`) // Use correct prefix
          .send({ password: 'wrongpassword' });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('valid', false);
     });

     it('POST /api/poker/rooms/:roomId/verify-password - should work for public room', async () => {
        expect(publicRoomId).toBeDefined();
        const res = await request(app)
          .post(`/api/poker/rooms/${publicRoomId}/verify-password`) // Use correct prefix
          .send({ password: '' }); 
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('valid', true);
     });
     
     it('POST /api/poker/rooms/:roomId/verify-password - should fail for non-existent room', async () => {
        const nonExistentRoomId = 'non-existent-room';
        const res = await request(app)
          .post(`/api/poker/rooms/${nonExistentRoomId}/verify-password`) // Use correct prefix
          .send({ password: 'anypassword' });
        expect(res.statusCode).toEqual(404);
        expect(res.body).toHaveProperty('error', 'Room not found');
     });

     // GET /api/poker/rooms is public now
     it('GET /api/poker/rooms - should succeed without authentication', async () => {
        const res = await request(app).get('/api/poker/rooms'); // Use correct prefix
        expect(res.statusCode).toEqual(200); 
        expect(Array.isArray(res.body)).toBe(true);
      });

      it('GET /api/poker/rooms - anonymous should get only public rooms', async () => {
        const res = await request(app).get('/api/poker/rooms');
        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body)).toBe(true);
        // Should contain public/anon rooms created in outer beforeAll
        expect(res.body.some(room => room.id === publicRoomId)).toBe(true);
        expect(res.body.some(room => room.id === anonRoomId)).toBe(true);
        // Should NOT contain workspace rooms (No need to check createdAuthRoomId here)
      });

    it('GET /api/poker/rooms/:roomId/info - should get info for a public room', async () => {
      const res = await request(app).get(`/api/poker/rooms/${publicRoomId}/info`);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('id', publicRoomId);
      expect(res.body).toHaveProperty('hasPassword', false);
    });

    it('GET /api/poker/rooms/:roomId/info - should get info for a password room', async () => {
      const res = await request(app).get(`/api/poker/rooms/${anonRoomId}/info`);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('id', anonRoomId);
      expect(res.body).toHaveProperty('hasPassword', true);
    });

    it('GET /api/poker/rooms/:roomId/info - should return 404 for non-existent room', async () => {
      const res = await request(app).get(`/api/poker/rooms/non-existent-info/info`);
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error', 'Room not found');
    });
  });

  // --- Authenticated Access Tests ---
  describe('Authenticated Access', () => {
    let createdAuthRoomId; // Define within this scope
    let authToken;
    let userId;
    let testWorkspaceId;
    let testUserEmail = `poker_auth_user_${Date.now()}@example.com`;
    let testUserPassword = 'password123';
    let testUserName = 'Poker Auth User';

    // Setup user and workspace for authenticated tests
    beforeAll(async () => {
      // Register user
      const resRegister = await request(app)
        .post('/api/auth/register')
        .send({ email: testUserEmail, password: testUserPassword, name: testUserName });
      expect(resRegister.statusCode).toEqual(201);
      authToken = resRegister.body.token;
      userId = resRegister.body.user.id;

      // Create workspace
      const workspaceName = `Poker Auth Test Workspace ${Date.now()}`;
      const resWorkspace = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: workspaceName });
      expect(resWorkspace.statusCode).toEqual(201);
      testWorkspaceId = resWorkspace.body.workspace.id;
      // Create the authenticated room needed for subsequent tests in this block
      const authRoomId = `ws-room-auth-${Date.now()}`;
      createdAuthRoomId = authRoomId; // Assign to the outer scope variable
      const resAuthRoom = await request(app)
        .post('/api/poker/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          roomId: authRoomId,
          name: 'Workspace Linked Room Auth',
          workspaceId: testWorkspaceId,
        });
      expect(resAuthRoom.statusCode).toEqual(200);
    });

    // Keep a test for the creation endpoint itself, but maybe simplified
    it('POST /api/poker/rooms - should allow creating another workspace room', async () => {
      const anotherRoomId = `ws-room-auth-another-${Date.now()}`;
      const res = await request(app)
        .post('/api/poker/rooms')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          roomId: anotherRoomId,
          name: 'Another Workspace Room',
          workspaceId: testWorkspaceId,
        });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('roomId', anotherRoomId);
    });

    it('POST /api/poker/rooms - should fail to create room with existing ID (authenticated)', async () => {
        expect(createdAuthRoomId).toBeDefined(); // Ensure room was created
        const res = await request(app)
          .post('/api/poker/rooms') // Use correct prefix
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            roomId: createdAuthRoomId, 
            name: 'Duplicate WS Room Auth',
            workspaceId: testWorkspaceId,
          });
        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('error', 'Room already exists');
    });

    // Removed redundant test case that was covered by the next one

    it('GET /api/poker/rooms - authenticated WITHOUT header should get only public rooms', async () => {
        const res = await request(app)
          .get('/api/poker/rooms')
          .set('Authorization', `Bearer ${authToken}`); // Authenticated but no workspace header
        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body)).toBe(true);
        // Should contain public/anon rooms
        expect(res.body.some(room => room.id === publicRoomId)).toBe(true);
        expect(res.body.some(room => room.id === anonRoomId)).toBe(true);
         // Should NOT contain the workspace room
        expect(res.body.some(room => room.id === createdAuthRoomId)).toBe(false);
    });

     it('GET /api/poker/rooms - authenticated WITH header should get ONLY workspace rooms', async () => {
        expect(createdAuthRoomId).toBeDefined();
        const res = await request(app)
          .get('/api/poker/rooms')
          .set('Authorization', `Bearer ${authToken}`)
          .set('workspace-id', testWorkspaceId); // Set workspace header
        expect(res.statusCode).toEqual(200);

        expect(Array.isArray(res.body)).toBe(true);
         // Should contain the workspace room
        expect(res.body.some(room => room.id === createdAuthRoomId)).toBe(true);
         // Should NOT contain public/anon rooms
        expect(res.body.some(room => room.id === publicRoomId)).toBe(false);
        expect(res.body.some(room => room.id === anonRoomId)).toBe(false);
        // Check if workspaceId matches
        expect(res.body[0]).toHaveProperty('workspaceId', testWorkspaceId);
    });

     it('POST /api/poker/rooms/:roomId/verify-password - should work for workspace room (authenticated)', async () => {
        expect(createdAuthRoomId).toBeDefined();
        const res = await request(app)
          .post(`/api/poker/rooms/${createdAuthRoomId}/verify-password`) // Use correct prefix
          .set('Authorization', `Bearer ${authToken}`) // Send auth token
          .send({ password: '' }); // Room has no password
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('valid', true);
     });


     it('GET /api/poker/rooms/:roomId/info - should get info for a workspace room', async () => {
        // createdAuthRoomId is assigned in beforeAll for this describe block
        expect(createdAuthRoomId).toBeDefined(); // Ensure the ID exists from beforeAll
        expect(authToken).toBeDefined(); // Ensure the token exists from beforeAll

        const res = await request(app)
          .get(`/api/poker/rooms/${createdAuthRoomId}/info`) // Use ID created in beforeAll
          .set('Authorization', `Bearer ${authToken}`); // Use token from beforeAll
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('id', createdAuthRoomId);
        expect(res.body).toHaveProperty('hasPassword', false); // Created without password in beforeAll
     });


     it('GET /api/poker/rooms/:roomId/info - should return 404 for non-existent workspace room', async () => {
        const res = await request(app)
          .get(`/api/poker/rooms/non-existent-ws-room/info`)
          .set('Authorization', `Bearer ${authToken}`);
        expect(res.statusCode).toEqual(404);
        expect(res.body).toHaveProperty('error', 'Room not found');
     });

     // Add more authenticated tests here if needed

  });
});




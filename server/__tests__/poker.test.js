import request from 'supertest';
import { app } from '../index.js'; // Import only app
import pool from '../db/pool.js'; 

describe('Poker Routes (/api/poker)', () => {
  // Variables needed across both contexts
  let anonRoomId = `anon-poker-room-${Date.now()}`;
  let anonRoomPassword = 'anonPokerPassword';
  let publicRoomId = `public-poker-room-${Date.now()}`;
  let createdAuthRoomId; // ID for room created in auth context

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
  });

  // --- Authenticated Access Tests ---
  describe('Authenticated Access', () => {
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
    });

    it('POST /api/poker/rooms - should create a new poker room linked to a workspace', async () => {
      const roomId = `ws-room-auth-${Date.now()}`;
      createdAuthRoomId = roomId; // Use the variable declared in the outer scope
      const res = await request(app)
        .post('/api/poker/rooms') // Use correct prefix
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          roomId: roomId,
          name: 'Workspace Linked Room Auth',
          workspaceId: testWorkspaceId,
        });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('roomId', roomId);
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

    it('GET /api/poker/rooms - should get a list including the workspace room', async () => {
        expect(createdAuthRoomId).toBeDefined();
        const res = await request(app)
          .get('/api/poker/rooms') // Use correct prefix
          .set('Authorization', `Bearer ${authToken}`); // Auth is optional, but we send it
        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body)).toBe(true);
        const foundRoom = res.body.find(room => room.id === createdAuthRoomId);
        expect(foundRoom).toBeDefined();
        expect(foundRoom).toHaveProperty('name', 'Workspace Linked Room Auth');
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

     // Add more authenticated tests here if needed
  });
});

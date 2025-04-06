import request from 'supertest';
import express from 'express'; // Import express for test app setup
import { app as mainApp, server, io } from '../index.js'; // Import main app for setup, io/server for teardown
import { pool } from '../db/pool.js'; // Ensure initializePool is not imported
import bcrypt from 'bcryptjs'; // Import bcrypt
// Import necessary functions from Jest globals for ESM
import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid'; // Import uuid

// Import the route setup function
import setupPokerRoutes from '../routes/poker.js';
// NOTE: We DO NOT import the actual DB functions here anymore

// --- Mock DB Objects ---
const mockPokerDb = {
    createRoom: jest.fn(),
    getRoom: jest.fn(),
    // verifyPassword: jest.fn(), // verify-password route uses getRoom
    getRooms: jest.fn(), // Renamed from getPublicRooms to match route code
    getWorkspaceRooms: jest.fn(),
    getPokerRoomInfo: jest.fn(), // Used by original /info route, now getRoom is used
};
const mockWorkspaceDb = {
    // Only need isWorkspaceMember for poker routes authorization checks
    isWorkspaceMember: jest.fn(),
};
// --- End Mock DB Objects ---

// testApp setup moved inside describe block


// Helper function to register/login a user and get token (uses mainApp)
const registerAndLoginUser = async (emailSuffix) => {
    const email = `poker_di_user_${emailSuffix}_${Date.now()}@example.com`;
    const password = 'password123';
    const name = `Poker DI User ${emailSuffix}`;
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


// Declare variables needed by mock middleware in a higher scope
let authUserInfo; // To store token and userId for authenticated tests
let testWorkspaceId;

describe('Poker Routes (/api/poker) with DI', () => {
  let testApp; // Declare testApp here
  // Variables needed across contexts
  let anonRoomId = 'test-anon-poker-room-id'; // Use fixed IDs for mocked tests
  let anonRoomPassword = 'anonPokerPasswordDI';
  let publicRoomId = 'test-public-poker-room-id';
  let createdAuthRoomId = 'test-auth-poker-room-id';
  // authUserInfo and testWorkspaceId are now defined globally

  // Setup: Register user and create workspace using mainApp for context
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
             req.user = undefined; // Clear user if no token
        }
        next();
    });

    // Mount the poker routes using the setup function and injecting the MOCK DBs
    testApp.use('/api/poker', setupPokerRoutes(mockPokerDb, mockWorkspaceDb));

    // Add a dummy error handler for testing 500 errors on testApp
    testApp.use((err, req, res, next) => {
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Internal Server Error' });
    });

    // --- Original beforeAll content starts here ---
    // Register authenticated user using the main app
    authUserInfo = await registerAndLoginUser('poker_di_test');

    // Assign placeholder ID instead of creating real workspace in DB
    testWorkspaceId = uuidv4();

    // No longer creating rooms here; tests will use mocks
  });

  // Reset mocks before each test
  beforeEach(() => {
    Object.values(mockPokerDb).forEach(mockFn => mockFn.mockReset());
    Object.values(mockWorkspaceDb).forEach(mockFn => mockFn.mockReset());
  });

  afterAll(async () => {
    server.close(); // Close the server
    await pool.end();
  });

  // --- Anonymous Access Tests ---
  describe('Anonymous Access', () => {
    it('POST /api/poker/rooms - should create a new anonymous poker room', async () => {
      mockPokerDb.getRoom.mockResolvedValueOnce(null); // Mock room doesn't exist
      mockPokerDb.createRoom.mockResolvedValueOnce(); // Mock creation success
      const roomId = `anon-create-${Date.now()}`;
      const name = 'Anon Create Test DI';
      const sequenceKey = 'tshirt'; // Send key

      const res = await request(testApp) // Use testApp
        .post('/api/poker/rooms')
        .send({ roomId, name, sequence: sequenceKey }); // Send key

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('roomId', roomId);
      expect(res.body).toHaveProperty('hasPassword', false);
      expect(res.body).toHaveProperty('sequence', sequenceKey); // Expect key back
      // Expect createRoom to be called with the key
      expect(mockPokerDb.createRoom).toHaveBeenCalledWith(
          roomId,
          name,
          sequenceKey, // Expect key
          null,     // passwordHash
          undefined // workspaceId
      );
    });

    it('POST /api/poker/rooms - should return 500 if createRoom fails', async () => {
        mockPokerDb.getRoom.mockResolvedValueOnce(null); // Mock room doesn't exist
        const dbError = new Error('DB create failed');
        mockPokerDb.createRoom.mockRejectedValueOnce(dbError); // Mock creation failure
        const roomId = `anon-create-fail-${Date.now()}`;

        const res = await request(testApp)
            .post('/api/poker/rooms')
            .send({ roomId, name: 'Fail Create Test', sequence: 'fibonacci' }); // Need valid sequence

        expect(res.statusCode).toEqual(500);
        expect(res.body).toHaveProperty('error', 'Internal Server Error');
        expect(mockPokerDb.getRoom).toHaveBeenCalled(); // getRoom is called first
        expect(mockPokerDb.createRoom).toHaveBeenCalled();
    });

    it('POST /api/poker/rooms/:roomId/verify-password - should verify correct password for anonymous room', async () => {
        // Mock getRoom to return a room with a matching hashed password
        const hashedPassword = await bcrypt.hash(anonRoomPassword, 10);
        mockPokerDb.getRoom.mockResolvedValueOnce({ id: anonRoomId, password: hashedPassword, sequence: 'fibonacci', participants: new Map() }); // Include other required fields

        const res = await request(testApp) // Use testApp
          .post(`/api/poker/rooms/${anonRoomId}/verify-password`)
          .send({ password: anonRoomPassword });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('valid', true);
        expect(mockPokerDb.getRoom).toHaveBeenCalledWith(anonRoomId);
     });

     it('POST /api/poker/rooms/:roomId/verify-password - should reject incorrect password for anonymous room', async () => {
        // Mock getRoom to return a room with a different hashed password
        const correctHashedPassword = await bcrypt.hash(anonRoomPassword, 10); // Hash the correct one
        mockPokerDb.getRoom.mockResolvedValueOnce({ id: anonRoomId, password: correctHashedPassword, sequence: 'fibonacci', participants: new Map() }); // Include other required fields

        const res = await request(testApp) // Use testApp
          .post(`/api/poker/rooms/${anonRoomId}/verify-password`)
          .send({ password: 'wrongpassword' }); // Send the wrong one
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('valid', false);
        expect(mockPokerDb.getRoom).toHaveBeenCalledWith(anonRoomId);
     });

     it('POST /api/poker/rooms/:roomId/verify-password - should work for public room (no password)', async () => {
        // Mock getRoom returning a room without a password property
        mockPokerDb.getRoom.mockResolvedValueOnce({ id: publicRoomId, password: null, sequence: 'fibonacci', participants: new Map() }); // Include other required fields

        const res = await request(testApp) // Use testApp
          .post(`/api/poker/rooms/${publicRoomId}/verify-password`)
          .send({ password: '' }); // Password sent is irrelevant
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('valid', true);
        expect(mockPokerDb.getRoom).toHaveBeenCalledWith(publicRoomId);
     });

     // Renamed test: Test 500 if getRoom fails during verification
     it('POST /api/poker/rooms/:roomId/verify-password - should return 500 if getRoom fails', async () => {
        const dbError = new Error('DB getRoom failed during verify');
        mockPokerDb.getRoom.mockRejectedValueOnce(dbError); // Mock getRoom failure

        const res = await request(testApp)
          .post(`/api/poker/rooms/${anonRoomId}/verify-password`)
          .send({ password: anonRoomPassword });
        expect(res.statusCode).toEqual(500);
        expect(res.body).toHaveProperty('error', 'Internal Server Error');
        expect(mockPokerDb.getRoom).toHaveBeenCalledWith(anonRoomId);
     });

     // Renamed test: Test 404 if getRoom returns null during verification
     it('POST /api/poker/rooms/:roomId/verify-password - should return 404 if room not found', async () => {
        const nonExistentRoomId = 'non-existent-room';
        mockPokerDb.getRoom.mockResolvedValueOnce(null); // Mock getRoom returning null

        const res = await request(testApp) // Use testApp
          .post(`/api/poker/rooms/${nonExistentRoomId}/verify-password`)
          .send({ password: 'anypassword' });
        expect(res.statusCode).toEqual(404);
        expect(res.body).toHaveProperty('error', 'Room not found');
        expect(mockPokerDb.getRoom).toHaveBeenCalledWith(nonExistentRoomId);
     });

     it('GET /api/poker/rooms - should get public rooms', async () => {
        // Define the mock *database* structure returned by the mock function
        const mockDbResult = [{ id: publicRoomId, name: 'Public Room 1', password: null, participant_count: 2, created_at: new Date().toISOString(), sequence: 'fibonacci', workspace_id: null }];
        // Define the expected *mapped* structure for assertion
        const expectedMappedRooms = [{ id: publicRoomId, name: 'Public Room 1', hasPassword: false, participantCount: 2, createdAt: expect.any(String), sequence: 'fibonacci', workspaceId: null }];
        mockPokerDb.getRooms.mockResolvedValueOnce(mockDbResult); // Return raw DB structure

        const res = await request(testApp).get('/api/poker/rooms'); // Use testApp
        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body)).toBe(true);
        // Assert against expected mapped structure
        expect(res.body).toHaveLength(1);
        expect(res.body[0]).toMatchObject(expectedMappedRooms[0]);
        expect(mockPokerDb.getRooms).toHaveBeenCalled();
        expect(mockPokerDb.getWorkspaceRooms).not.toHaveBeenCalled(); // Ensure workspace path not taken
      });

      it('GET /api/poker/rooms - should return 500 if getRooms fails', async () => { // Corrected test description
        const dbError = new Error('DB get public rooms failed');
        mockPokerDb.getRooms.mockRejectedValueOnce(dbError); // Corrected mock name
        const res = await request(testApp).get('/api/poker/rooms');
        expect(res.statusCode).toEqual(500);
        expect(res.body).toHaveProperty('error', 'Internal Server Error');
      });

    it('GET /api/poker/rooms/:roomId/info - should get info for a public room', async () => {
      // Mock getRoom which is now used by the /info route
      const mockRoomDetails = { id: publicRoomId, name: 'Public Room Info', password: null, sequence: 'fibonacci', participants: new Map(), created_at: new Date(), workspace_id: null };
      mockPokerDb.getRoom.mockResolvedValueOnce(mockRoomDetails);
      const res = await request(testApp).get(`/api/poker/rooms/${publicRoomId}/info`); // Use testApp
      expect(res.statusCode).toEqual(200);
      // Expect the structure returned by the route (password omitted, participants as array)
      expect(res.body).toEqual({
          id: publicRoomId,
          name: 'Public Room Info',
          sequence: 'fibonacci',
          hasPassword: false,
          participants: [], // Empty array from empty map
          created_at: expect.any(String),
          workspace_id: null
      });
      expect(mockPokerDb.getRoom).toHaveBeenCalledWith(publicRoomId);
    });

    it('GET /api/poker/rooms/:roomId/info - should get info for a password room', async () => {
      // Mock getRoom which is now used by the /info route
      const mockRoomDetails = { id: anonRoomId, name: 'Anon Room Info', password: 'hashedPassword', sequence: 'tshirt', participants: new Map(), created_at: new Date(), workspace_id: null };
      mockPokerDb.getRoom.mockResolvedValueOnce(mockRoomDetails);
      const res = await request(testApp).get(`/api/poker/rooms/${anonRoomId}/info`); // Use testApp
      expect(res.statusCode).toEqual(200);
       // Expect the structure returned by the route (password omitted, participants as array)
       expect(res.body).toEqual({
        id: anonRoomId,
        name: 'Anon Room Info',
        sequence: 'tshirt',
        hasPassword: true,
        participants: [], // Empty array from empty map
        created_at: expect.any(String),
        workspace_id: null
    });
      expect(mockPokerDb.getRoom).toHaveBeenCalledWith(anonRoomId);
    });

    it('GET /api/poker/rooms/:roomId/info - should return 404 for non-existent room', async () => {
      const nonExistentRoomId = 'non-existent-info';
      mockPokerDb.getRoom.mockResolvedValueOnce(null); // Mock getRoom returning null
      const res = await request(testApp).get(`/api/poker/rooms/${nonExistentRoomId}/info`); // Use testApp
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error', 'Room not found');
      expect(mockPokerDb.getRoom).toHaveBeenCalledWith(nonExistentRoomId);
    });

    it('GET /api/poker/rooms/:roomId/info - should return 500 if getRoom fails', async () => { // Corrected description
        const dbError = new Error('DB get room failed');
        mockPokerDb.getRoom.mockRejectedValueOnce(dbError); // Mock getRoom failure
        const res = await request(testApp).get(`/api/poker/rooms/${publicRoomId}/info`);
        expect(res.statusCode).toEqual(500);
        expect(res.body).toHaveProperty('error', 'Internal Server Error');
        expect(mockPokerDb.getRoom).toHaveBeenCalledWith(publicRoomId);
    });
  });

  // --- Authenticated Access Tests ---
  describe('Authenticated Access', () => {
    // Auth setup (user, workspace) is in the main beforeAll

    it('POST /api/poker/rooms - should allow creating a workspace room', async () => {
      mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // Mock user is member
      mockPokerDb.getRoom.mockResolvedValueOnce(null); // Mock room doesn't exist
      mockPokerDb.createRoom.mockResolvedValueOnce(); // Mock room creation success
      const roomId = `ws-create-${Date.now()}`;
      const name = 'Workspace Create Test DI';
      const sequenceKey = 'powers'; // Send key

      const res = await request(testApp) // Use testApp
        .post('/api/poker/rooms')
        .set('Authorization', `Bearer ${authUserInfo.token}`) // Mock auth middleware uses this
        .send({ roomId, name, workspaceId: testWorkspaceId, sequence: sequenceKey }); // Send key

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('roomId', roomId);
      expect(res.body).toHaveProperty('hasPassword', false); // Workspace rooms don't have passwords
      expect(res.body).toHaveProperty('sequence', sequenceKey); // Expect key back
      // Check that membership was verified
      expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId);
      // Expect createRoom to be called with the key
      expect(mockPokerDb.createRoom).toHaveBeenCalledWith(
          roomId,
          name,
          sequenceKey, // Expect key
          null,        // passwordHash
          testWorkspaceId // workspaceId
      );
    });

    it('POST /api/poker/rooms - should fail if user not workspace member', async () => {
        mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(false); // Mock user is NOT member
        const roomId = `ws-create-fail-auth-${Date.now()}`;

        const res = await request(testApp)
            .post('/api/poker/rooms')
            .set('Authorization', `Bearer ${authUserInfo.token}`)
            .send({ roomId, name: 'Fail Auth Create', workspaceId: testWorkspaceId, sequence: 'fibonacci' }); // Need sequence

        // Route now checks membership first
        expect(res.statusCode).toEqual(403);
        expect(res.body).toHaveProperty('error', 'User is not authorized to create a room in this workspace.');
        expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId);
        expect(mockPokerDb.getRoom).not.toHaveBeenCalled(); // Should not be called if not member
        expect(mockPokerDb.createRoom).not.toHaveBeenCalled(); // Should not be called if not member
    });

    it('POST /api/poker/rooms - should return 400 if room ID already exists (authenticated)', async () => {
        // Mock isWorkspaceMember check (assuming user is member for this test)
        mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true);
        // Mock getRoom finding an existing room
        mockPokerDb.getRoom.mockResolvedValueOnce({ id: createdAuthRoomId, name: 'Existing Room', sequence: 'fibonacci', participants: new Map() }); // Add required fields

        const res = await request(testApp) // Use testApp
          .post('/api/poker/rooms')
          .set('Authorization', `Bearer ${authUserInfo.token}`)
          .send({
            roomId: createdAuthRoomId, // Use the predefined ID
            name: 'Duplicate WS Room Auth DI',
            workspaceId: testWorkspaceId, // Include workspaceId if needed for membership check path
            sequence: 'fibonacci' // Need sequence
          });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('error', 'Room already exists');
        // Ensure membership was checked (if workspaceId provided)
        if (testWorkspaceId) {
            expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId);
        }
        expect(mockPokerDb.getRoom).toHaveBeenCalledWith(createdAuthRoomId);
        expect(mockPokerDb.createRoom).not.toHaveBeenCalled(); // createRoom should not be called
    });

    it('GET /api/poker/rooms - authenticated WITHOUT header should get only public rooms', async () => {
        // Define the mock *database* structure returned by the mock function
        const mockDbResult = [{ id: publicRoomId, name: 'Public Room 1', password: null, participant_count: 1, created_at: new Date().toISOString(), sequence: 'fibonacci', workspace_id: null }];
        // Define the expected *mapped* structure for assertion
        const expectedMappedRooms = [{ id: publicRoomId, name: 'Public Room 1', hasPassword: false, participantCount: 1, createdAt: expect.any(String), sequence: 'fibonacci', workspaceId: null }];
        mockPokerDb.getRooms.mockResolvedValueOnce(mockDbResult); // Return raw DB structure

        const res = await request(testApp) // Use testApp
          .get('/api/poker/rooms')
          .set('Authorization', `Bearer ${authUserInfo.token}`); // Auth header present

        expect(res.statusCode).toEqual(200);
        // Assert against expected mapped structure
        expect(res.body).toHaveLength(1);
        expect(res.body[0]).toMatchObject(expectedMappedRooms[0]);
        expect(mockPokerDb.getRooms).toHaveBeenCalled();
        expect(mockPokerDb.getWorkspaceRooms).not.toHaveBeenCalled();
    });

     it('GET /api/poker/rooms - authenticated WITH header should get ONLY workspace rooms', async () => {
        // Define the expected *mapped* structure for assertion
        const expectedMappedRooms = [{ id: createdAuthRoomId, name: 'WS Room 1', hasPassword: false, participantCount: 0, createdAt: expect.any(String), sequence: 'fibonacci', workspaceId: testWorkspaceId }];
        // Define the mock *database* structure returned by the mock function
        const mockDbResult = [{ id: createdAuthRoomId, name: 'WS Room 1', password: null, participant_count: 0, created_at: new Date().toISOString(), sequence: 'fibonacci', workspace_id: testWorkspaceId }];
        // Route now calls isWorkspaceMember, mock it
        mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(true); // Mock user is member
        mockPokerDb.getWorkspaceRooms.mockResolvedValueOnce(mockDbResult); // Return raw DB structure

        const res = await request(testApp) // Use testApp
          .get('/api/poker/rooms')
          .set('Authorization', `Bearer ${authUserInfo.token}`)
          .set('workspace-id', testWorkspaceId); // Set workspace header

        expect(res.statusCode).toEqual(200);
        // Route maps the response, compare relevant fields
        expect(res.body[0]).toMatchObject(expectedMappedRooms[0]); // Assert against expected mapped structure
        // Check membership was verified
        expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId);
        expect(mockPokerDb.getWorkspaceRooms).toHaveBeenCalledWith(testWorkspaceId);
        expect(mockPokerDb.getRooms).not.toHaveBeenCalled();
    });

    it('GET /api/poker/rooms - authenticated WITH header should fail if not workspace member', async () => {
        // Route now checks membership first
        mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(false); // Mock user is NOT member

        const res = await request(testApp)
          .get('/api/poker/rooms')
          .set('Authorization', `Bearer ${authUserInfo.token}`)
          .set('workspace-id', testWorkspaceId);

        expect(res.statusCode).toEqual(403);
        expect(res.body).toHaveProperty('error', 'User is not authorized to access rooms for this workspace.');
        expect(mockWorkspaceDb.isWorkspaceMember).toHaveBeenCalledWith(testWorkspaceId, authUserInfo.userId);
        expect(mockPokerDb.getWorkspaceRooms).not.toHaveBeenCalled(); // Should not be called if not member
    });

     it('POST /api/poker/rooms/:roomId/verify-password - should work for workspace room (authenticated)', async () => {
        // Mock getRoom returning a workspace room (no password)
        mockPokerDb.getRoom.mockResolvedValueOnce({ id: createdAuthRoomId, workspace_id: testWorkspaceId, password: null, sequence: 'fibonacci', participants: new Map() }); // Add required fields
        // The route doesn't check membership here, only getRoom

        const res = await request(testApp) // Use testApp
          .post(`/api/poker/rooms/${createdAuthRoomId}/verify-password`)
          .set('Authorization', `Bearer ${authUserInfo.token}`)
          .send({ password: '' }); // Password irrelevant

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('valid', true);
        expect(mockPokerDb.getRoom).toHaveBeenCalledWith(createdAuthRoomId);
     });

     it('POST /api/poker/rooms/:roomId/verify-password - should still return valid=true for workspace room even if user mock says not member (route logic check)', async () => {
        mockPokerDb.getRoom.mockResolvedValueOnce({ id: createdAuthRoomId, workspace_id: testWorkspaceId, password: null, sequence: 'fibonacci', participants: new Map() }); // Add required fields
        // Mock isWorkspaceMember returning false, but the route doesn't use it here
        mockWorkspaceDb.isWorkspaceMember.mockResolvedValueOnce(false);

        const res = await request(testApp)
          .post(`/api/poker/rooms/${createdAuthRoomId}/verify-password`)
          .set('Authorization', `Bearer ${authUserInfo.token}`) // Use token of user who might not be member
          .send({ password: '' });

        // Based on current route code, it only checks getRoom result.
        // If room is found and has no password, it returns valid: true.
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('valid', true);
        expect(mockPokerDb.getRoom).toHaveBeenCalledWith(createdAuthRoomId);
     });


     it('GET /api/poker/rooms/:roomId/info - should get info for a workspace room', async () => {
        // Mock getRoom which is now used by the /info route
        const mockRoomDetails = { id: createdAuthRoomId, name: 'WS Room Info', workspace_id: testWorkspaceId, password: null, sequence: 'powers', participants: new Map(), created_at: new Date() };
        mockPokerDb.getRoom.mockResolvedValueOnce(mockRoomDetails);
        // Route doesn't check membership here

        const res = await request(testApp) // Use testApp
          .get(`/api/poker/rooms/${createdAuthRoomId}/info`)
          .set('Authorization', `Bearer ${authUserInfo.token}`);

        expect(res.statusCode).toEqual(200);
        // Expect the structure returned by the route (password omitted, participants as array)
        expect(res.body).toEqual({
            id: createdAuthRoomId,
            name: 'WS Room Info',
            workspace_id: testWorkspaceId,
            hasPassword: false,
            sequence: 'powers', // Expect key
            participants: [],
            created_at: expect.any(String)
        });
        expect(mockPokerDb.getRoom).toHaveBeenCalledWith(createdAuthRoomId);
     });

     it('GET /api/poker/rooms/:roomId/info - should return 404 for non-existent workspace room', async () => {
        const nonExistentRoomId = 'non-existent-ws-room';
        mockPokerDb.getRoom.mockResolvedValueOnce(null); // Mock getRoom returning null

        const res = await request(testApp) // Use testApp
          .get(`/api/poker/rooms/${nonExistentRoomId}/info`)
          .set('Authorization', `Bearer ${authUserInfo.token}`);

        expect(res.statusCode).toEqual(404);
        expect(res.body).toHaveProperty('error', 'Room not found');
        expect(mockPokerDb.getRoom).toHaveBeenCalledWith(nonExistentRoomId);
        expect(mockWorkspaceDb.isWorkspaceMember).not.toHaveBeenCalled();
     });

  });
});

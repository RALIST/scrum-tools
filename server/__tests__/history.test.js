import request from 'supertest';
import { app } from '../index.js'; // Import app
import { pool } from '../db/pool.js';
import { createRetroBoard } from '../db/retro.js';
import { createRetroBoardSnapshot, getRetroBoardHistory, getHistorySnapshot } from '../db/history.js'; // Correct import

// Helper function to register/login a user and get token
const registerAndLoginUser = async (emailSuffix) => {
    const email = `history_user_${emailSuffix}_${Date.now()}@example.com`;
    const password = 'password123';
    const name = `History User ${emailSuffix}`;
    let regResponse = await request(app)
        .post('/api/auth/register')
        .send({ email, password, name });
    // Handle potential 409 Conflict if user already exists from previous run
    if (regResponse.statusCode === 409) {
         const loginRes = await request(app).post('/api/auth/login').send({ email, password });
         if (loginRes.statusCode === 200) return loginRes.body.token;
         throw new Error(`Failed to login existing user ${email}`);
    }
    if (regResponse.statusCode !== 201) {
        throw new Error(`Registration failed for ${email}: ${regResponse.text}`);
    }
    return regResponse.body.token;
};


describe('History Routes (/api/history)', () => {
    let authToken;
    let testBoardId;
    let testSnapshotId;

    beforeAll(async () => {
        authToken = await registerAndLoginUser('main');

        // Create a retro board to associate history with
        const boardRes = await request(app)
            .post('/api/retro') // Correct API path
            .set('Authorization', `Bearer ${authToken}`)
            .send({ name: 'History Test Board' });
        
        if (boardRes.statusCode !== 200) { // Correct expected status code
             console.error("Failed to create retro board for history tests:", boardRes.body);
             throw new Error("Setup failed: Could not create retro board.");
        }
        testBoardId = boardRes.body.boardId; // Correct extraction

        // Manually create a history snapshot using the DB function for testing GET snapshot
        const snapshotData = { columns: [{ id: 'col1', cards: [] }] };
        try {
            const snapshotResult = await createRetroBoardSnapshot(testBoardId, snapshotData); // Correct function call
            testSnapshotId = snapshotResult.id; // Get ID from result
        } catch (err) {
             console.error("Failed to save history snapshot during setup:", err);
             throw new Error("Setup failed: Could not save history snapshot.");
        }
    });

    afterAll(async () => {
        // Clean up? Delete board?
        await pool.end();
    });

    // --- GET /retro/:boardId ---

    it('GET /retro/:boardId - should get history for a valid board ID', async () => {
        const res = await request(app)
            .get(`/api/history/retro/${testBoardId}`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body)).toBe(true);
        // Check if the manually created snapshot is listed (or if list is just non-empty)
        expect(res.body.length).toBeGreaterThanOrEqual(1); 
        expect(res.body[0]).toHaveProperty('id', testSnapshotId);
        expect(res.body[0]).toHaveProperty('created_at');
    });

    it('GET /retro/:boardId - should return empty array for board with no history', async () => {
         // Create a new board with no history
         const boardRes = await request(app)
            .post('/api/retro') // Correct API path
            .set('Authorization', `Bearer ${authToken}`)
            .send({ name: 'No History Board' });
         expect(boardRes.statusCode).toEqual(200); // Correct expected status code
         const noHistoryBoardId = boardRes.body.boardId; // Correct extraction

        const res = await request(app)
            .get(`/api/history/retro/${noHistoryBoardId}`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toEqual(0);
    });
    
    it('GET /retro/:boardId - should fail without authentication', async () => {
        const res = await request(app)
            .get(`/api/history/retro/${testBoardId}`);
            // No auth token
        expect(res.statusCode).toEqual(401);
    });

    // TODO: Add test for non-existent board ID (might need DB function adjustment or route check)
    // TODO: Add test for user without permission (requires workspace integration)

    // --- GET /snapshot/:id ---

    it('GET /snapshot/:id - should get a specific snapshot', async () => {
        const res = await request(app)
            .get(`/api/history/snapshot/${testSnapshotId}`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('id', testSnapshotId);
        expect(res.body).toHaveProperty('board_id', testBoardId);
        expect(res.body).toHaveProperty('snapshot');
        expect(res.body.snapshot).toHaveProperty('columns'); // Check snapshot structure
    });

    it('GET /snapshot/:id - should return 404 for non-existent snapshot ID', async () => {
        const nonExistentId = 'non-existent-snapshot-id';
        const res = await request(app)
            .get(`/api/history/snapshot/${nonExistentId}`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.statusCode).toEqual(404);
        expect(res.body).toHaveProperty('error', 'History snapshot not found');
    });

    it('GET /snapshot/:id - should fail without authentication', async () => {
        const res = await request(app)
            .get(`/api/history/snapshot/${testSnapshotId}`);
            // No auth token
        expect(res.statusCode).toEqual(401);
    });

     // TODO: Add test for user without permission (requires workspace integration)

});
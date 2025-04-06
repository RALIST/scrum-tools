import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import bcrypt from 'bcryptjs'; // Keep import for generating real hash in test
import { v4 as uuidv4 } from 'uuid';

// Import the functions to test
import * as userDb from '../db/users.js';

// Import the actual pool and initializer
import { pool, initializePool } from '../db/pool.js';

// Initialize the pool before tests run
// Note: This might connect to a real DB if env vars are set during test run,
// which is not ideal for unit tests. Consider managing env vars for tests.
initializePool();

// Define mocks for client behavior
let mockQuery;
let mockClient;
let connectSpy; // To hold the spy

describe('User DB Functions (server/db/users.js)', () => {

    // No spies needed for bcrypt anymore

    beforeEach(() => {
        // Re-initialize mocks and set up spy before each test
        mockQuery = jest.fn();
        mockClient = {
            query: mockQuery,
            release: jest.fn(),
        };
        // Spy on the actual pool's connect method
        connectSpy = jest.spyOn(pool, 'connect').mockResolvedValue(mockClient);
    });

    afterEach(() => {
        // Restore the original implementation after each test
        connectSpy.mockRestore();
    });

    // --- createUser ---
    describe('createUser', () => {
        const email = 'test-create@example.com';
        const password = 'password123';
        const name = 'Test Create User';
        const expectedUser = { id: expect.any(String), email, name, created_at: expect.any(Date) };

        it('should create a new user successfully', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [] }) // Check user doesn't exist
                .mockResolvedValueOnce({ rows: [expectedUser] }); // Insert user

            const result = await userDb.createUser(email, password, name); // Removed mockPool argument

            expect(pool.connect).toHaveBeenCalledTimes(1); // Verify the spied connect was called
            expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE email = $1', [email]);
            // We don't check bcrypt.hash directly anymore
            expect(mockQuery).toHaveBeenCalledWith(
                'INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4) RETURNING id, email, name, created_at',
                [expect.any(String), email, expect.any(String), name] // Expect any string hash
            );
            expect(result).toEqual(expectedUser);
            expect(mockClient.release).toHaveBeenCalledTimes(1); // Verify release was called
        });

        it('should throw error if user already exists', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-id', email }] });

            await expect(userDb.createUser(email, password, name)) // Removed mockPool argument
                .rejects.toThrow('User already exists');

            expect(pool.connect).toHaveBeenCalledTimes(1);
            expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE email = $1', [email]);
            // bcrypt.hash should not have been called
            expect(mockQuery).toHaveBeenCalledTimes(1);
            expect(mockClient.release).toHaveBeenCalledTimes(1);
        });

        it('should release client on error during insert', async () => {
             mockQuery.mockResolvedValueOnce({ rows: [] });
             const insertError = new Error('DB Insert failed');
             // Make the second query (INSERT) reject
             mockQuery.mockRejectedValueOnce(insertError);

             await expect(userDb.createUser(email, password, name)) // Removed mockPool argument
                 .rejects.toThrow(insertError);

             expect(pool.connect).toHaveBeenCalledTimes(1);
             expect(mockClient.release).toHaveBeenCalledTimes(1); // Ensure release is called even on error
        });
    });

    // --- getUserByEmail ---
    describe('getUserByEmail', () => {
        const email = 'findme@example.com';
        const mockUser = { id: 'user-abc', email, name: 'Find Me', password_hash: 'some_hash' };

        it('should return user if found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [mockUser] });

            const result = await userDb.getUserByEmail(email); // Removed mockPool argument

            expect(pool.connect).toHaveBeenCalledTimes(1);
            expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE email = $1', [email]);
            expect(result).toEqual(mockUser);
            expect(mockClient.release).toHaveBeenCalledTimes(1);
        });

        it('should return null if user not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await userDb.getUserByEmail(email); // Removed mockPool argument

            expect(pool.connect).toHaveBeenCalledTimes(1);
            expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE email = $1', [email]);
            expect(result).toBeNull();
            expect(mockClient.release).toHaveBeenCalledTimes(1);
        });
    });

    // --- getUserById ---
    describe('getUserById', () => {
        const userId = 'user-get-by-id';
        const mockUser = { id: userId, email: 'getbyid@example.com', name: 'Get By ID', created_at: new Date() };

        it('should return user (without hash) if found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [mockUser] });

            const result = await userDb.getUserById(userId); // Removed mockPool argument

            expect(pool.connect).toHaveBeenCalledTimes(1);
            expect(mockQuery).toHaveBeenCalledWith('SELECT id, email, name, created_at FROM users WHERE id = $1', [userId]);
            expect(result).toEqual(mockUser);
            expect(mockClient.release).toHaveBeenCalledTimes(1);
        });

        it('should return null if user not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await userDb.getUserById(userId); // Removed mockPool argument

            expect(pool.connect).toHaveBeenCalledTimes(1);
            expect(mockQuery).toHaveBeenCalledWith('SELECT id, email, name, created_at FROM users WHERE id = $1', [userId]);
            expect(result).toBeNull();
            expect(mockClient.release).toHaveBeenCalledTimes(1);
        });
    });

    // --- updateLastLogin ---
    describe('updateLastLogin', () => {
        const userId = 'user-login-update';

        it('should execute update query', async () => {
            mockQuery.mockResolvedValueOnce(undefined); // UPDATE returns no rows

            await userDb.updateLastLogin(userId); // Removed mockPool argument

            expect(pool.connect).toHaveBeenCalledTimes(1);
            expect(mockQuery).toHaveBeenCalledWith(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
                [userId]
            );
            expect(mockClient.release).toHaveBeenCalledTimes(1);
        });
    });

    // --- verifyPassword ---
    describe('verifyPassword', () => {
        const password = 'password123';
        const hash = 'mocked_hash_from_db';

        it('should return true for correct password', async () => {
            // Generate a real hash for this test block
            const realHash = await bcrypt.hash(password, 10);
            const result = await userDb.verifyPassword(password, realHash);
            expect(result).toBe(true);
        });

        it('should call bcrypt.compare and return false for incorrect password', async () => {
            // Generate a real hash again for clarity, though could reuse
            const realHash = await bcrypt.hash(password, 10);
            const result = await userDb.verifyPassword('wrongpassword', realHash);
            expect(result).toBe(false);
        });
    });
});
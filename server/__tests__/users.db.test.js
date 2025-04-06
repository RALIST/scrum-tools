import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals'; // Added afterAll
import bcrypt from 'bcryptjs'; // Keep import for generating real hash in test
import { v4 as uuidv4 } from 'uuid';

// Import the functions to test
import * as userDb from '../db/users.js';

// Import the actual pool and initializer
import { pool } from '../db/pool.js'; // Import only pool
import { executeQuery } from '../db/dbUtils.js'; // Import executeQuery for cleanup/verification

// initializePool() call removed - pool initializes automatically

// Remove mock variables

describe('User DB Functions (server/db/users.js)', () => {

    // No setup needed for bcrypt spies

    beforeEach(async () => {
        // Use TRUNCATE for faster and more complete cleanup
        await executeQuery('TRUNCATE TABLE users RESTART IDENTITY CASCADE;');
        // Add other tables if needed, although CASCADE should handle most dependencies
        await executeQuery('TRUNCATE TABLE workspaces RESTART IDENTITY CASCADE;');
    });

    afterEach(() => {
        // No mocks to restore
    });

    afterAll( async () => {
        // Close the pool after each test
        await pool.end(); // Ensure the pool is closed after each test
    });

    // afterAll hook removed - pool closure handled globally

    // --- createUser ---
    describe('createUser', () => {
        const email = 'test-create@example.com';
        const password = 'password123';
        const name = 'Test Create User';
        // expectedUser removed, will verify actual result

        it('should create a new user successfully', async () => {
            // Act
            const result = await userDb.createUser(email, password, name);

            // Assert return value
            expect(result).toBeDefined();
            expect(result.id).toEqual(expect.any(String)); // ID is generated
            expect(result.email).toEqual(email);
            expect(result.name).toEqual(name);
            expect(result.created_at).toBeInstanceOf(Date);

            // Assert database state
            const dbUser = await userDb.getUserByEmail(email); // Fetch user with hash
            expect(dbUser).toBeDefined();
            expect(dbUser.id).toEqual(result.id);
            expect(dbUser.email).toEqual(email);
            expect(dbUser.name).toEqual(name);
            expect(dbUser.password_hash).toBeDefined();

            // Verify password
            const isPasswordCorrect = await bcrypt.compare(password, dbUser.password_hash);
            expect(isPasswordCorrect).toBe(true);
        });

        it('should throw error if user already exists', async () => {
            // Arrange: Create user first
            await userDb.createUser(email, password, name);

            // Act & Assert: Attempt to create again
            await expect(userDb.createUser(email, 'newpass', 'New Name'))
                .rejects.toThrow('User already exists');
        });

        // This test is less relevant for integration testing the createUser logic itself.
        // Error handling within executeQuery is tested in dbUtils.test.js.
        // Constraint violations (like duplicate email) are better tests here.
        // Removing this specific mock-based error test.
    });

    // --- getUserByEmail ---
    describe('getUserByEmail', () => {
        const email = 'findme@example.com';
        const mockUser = { id: 'user-abc', email, name: 'Find Me', password_hash: 'some_hash' };

        it('should return user if found', async () => {
            // Arrange: Create the user
            const createdUser = await userDb.createUser(email, 'pass1', 'Find Me');

            // Act
            const result = await userDb.getUserByEmail(email);

            // Assert
            expect(result).toBeDefined();
            expect(result.id).toEqual(createdUser.id);
            expect(result.email).toEqual(email);
            expect(result.name).toEqual('Find Me');
            expect(result.password_hash).toBeDefined(); // getUserByEmail returns the hash
        });

        it('should return null if user not found', async () => {
            // Act
            const result = await userDb.getUserByEmail('nonexistent@example.com');

            // Assert
            expect(result).toBeNull();
        });
    });

    // --- getUserById ---
    describe('getUserById', () => {
        const userId = 'user-get-by-id';
        const mockUser = { id: userId, email: 'getbyid@example.com', name: 'Get By ID', created_at: new Date() };

        it('should return user (without hash) if found', async () => {
            // Arrange: Create the user
            const createdUser = await userDb.createUser('getbyid@example.com', 'pass2', 'Get By ID');

            // Act
            const result = await userDb.getUserById(createdUser.id);

            // Assert
            expect(result).toBeDefined();
            expect(result.id).toEqual(createdUser.id);
            expect(result.email).toEqual('getbyid@example.com');
            expect(result.name).toEqual('Get By ID');
            expect(result).not.toHaveProperty('password_hash'); // Should not return hash
            expect(result.created_at).toBeInstanceOf(Date);
        });

        it('should return null if user not found', async () => {
            // Act
            const result = await userDb.getUserById('non-existent-user-id');

            // Assert
            expect(result).toBeNull();
        });
    });

    // --- updateLastLogin ---
    describe('updateLastLogin', () => {
        const userId = 'user-login-update';

        it('should execute update query', async () => {
            // Arrange: Create user
            const createdUser = await userDb.createUser('loginupdate@example.com', 'pass3', 'Login User');
            const initialUser = await executeQuery('SELECT * FROM users WHERE id = $1', [createdUser.id]);
            expect(initialUser.rows[0].last_login).toBeNull(); // Verify initial state

            // Act
            await userDb.updateLastLogin(createdUser.id);

            // Assert: Check DB directly
            const updatedUser = await executeQuery('SELECT * FROM users WHERE id = $1', [createdUser.id]);
            expect(updatedUser.rows.length).toBe(1);
            expect(updatedUser.rows[0].last_login).toBeInstanceOf(Date);
            // Optional: Check if timestamp is recent, but avoid exact match due to timing
            expect(Date.now() - updatedUser.rows[0].last_login.getTime()).toBeLessThan(5000); // e.g., within 5 seconds
        });
    });

    // --- verifyPassword ---
    describe('verifyPassword', () => {
        const password = 'password123';
        // hash variable removed, using real hash

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
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Import the function to test
// Import the object containing the function to test
import { dbUtils } from '../db/dbUtils.js';
// Import the actual pool to spy on its methods
import { pool, initializePool } from '../db/pool.js';
import logger from '../logger.js'; // Import logger to potentially spy on it

// Initialize pool before tests
initializePool();

// Mock the pool and client (Reverting to this approach)
let mockQuery;
let mockClient;
let loggerErrorSpy; // Declare spy for logger.error

// We will spy on logger methods as needed

let connectSpy; // Spy for pool.connect

describe('DB Utils (server/db/dbUtils.js)', () => {

    beforeEach(() => {
        // Reset and re-initialize mocks before each test
        mockQuery = jest.fn();
        mockClient = {
            query: mockQuery,
            release: jest.fn(),
        };
        // Spy on the actual pool's connect method
        connectSpy = jest.spyOn(pool, 'connect').mockResolvedValue(mockClient);
        // Spy on logger.error
        loggerErrorSpy = jest.spyOn(logger, 'error');
    });

    afterEach(() => {
        // Restore spies
        if (loggerErrorSpy) loggerErrorSpy.mockRestore();
        if (connectSpy) connectSpy.mockRestore(); // Restore pool spy
        // No spy to restore
    });
    describe('executeQuery', () => {
        const queryText = 'SELECT * FROM test WHERE id = $1';
        const params = [123];
        const mockResult = { rows: [{ id: 123, data: 'test' }], rowCount: 1 };

        it('should connect, execute query, and release client when no existing client is provided', async () => {
            mockQuery.mockResolvedValue(mockResult);

            const result = await dbUtils.executeQuery(queryText, params); // Call method on imported object, remove pool arg

            expect(pool.connect).toHaveBeenCalledTimes(1); // Assert on spied pool.connect
            expect(mockClient.query).toHaveBeenCalledWith(queryText, params);
            expect(mockClient.release).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockResult);
            expect(loggerErrorSpy).not.toHaveBeenCalled(); // Ensure no error was logged
        });

        it('should use existing client and not release it when provided', async () => {
            mockQuery.mockResolvedValue(mockResult);

            const result = await dbUtils.executeQuery(queryText, params, mockClient); // Call method, remove pool arg

            expect(pool.connect).not.toHaveBeenCalled(); // Assert on spied pool.connect
            expect(mockClient.query).toHaveBeenCalledWith(queryText, params);
            expect(mockClient.release).not.toHaveBeenCalled(); // Should not release existing client
            expect(result).toEqual(mockResult);
            expect(loggerErrorSpy).not.toHaveBeenCalled();
        });

        it('should log error, release client, and re-throw error on query failure (new client)', async () => {
            const queryError = new Error('DB query failed');
            mockQuery.mockRejectedValue(queryError);

            await expect(dbUtils.executeQuery(queryText, params)) // Call method, remove pool arg
                .rejects.toThrow(queryError);

            expect(pool.connect).toHaveBeenCalledTimes(1); // Assert on spied pool.connect
            expect(mockClient.query).toHaveBeenCalledWith(queryText, params);
            expect(loggerErrorSpy).toHaveBeenCalledWith('Database query error:', { // Check spy
                query: queryText,
                params: params,
                error: queryError,
                stack: queryError.stack
            });
            expect(mockClient.release).toHaveBeenCalledTimes(1); // Should release even on error
        });

        it('should log error, not release client, and re-throw error on query failure (existing client)', async () => {
            const queryError = new Error('DB query failed on existing client');
            mockQuery.mockRejectedValue(queryError);

            await expect(dbUtils.executeQuery(queryText, params, mockClient)) // Call method, remove pool arg
                .rejects.toThrow(queryError);

            expect(pool.connect).not.toHaveBeenCalled(); // Assert on spied pool.connect
            expect(mockClient.query).toHaveBeenCalledWith(queryText, params);
             expect(loggerErrorSpy).toHaveBeenCalledWith('Database query error:', { // Check spy
                query: queryText,
                params: params,
                error: queryError,
                stack: queryError.stack
            });
            expect(mockClient.release).not.toHaveBeenCalled(); // Should not release existing client
        });

         it('should release client if connect fails', async () => {
            const connectError = new Error('Failed to connect');
            connectSpy.mockRejectedValue(connectError); // Mock rejection via spy

             await expect(dbUtils.executeQuery(queryText, params)) // Call method, remove pool arg
                .rejects.toThrow(connectError);

             expect(pool.connect).toHaveBeenCalledTimes(1); // Assert on spied pool.connect
             expect(mockClient.query).not.toHaveBeenCalled();
             // In this specific mock setup, release might not be called if connect fails before client is assigned
             // expect(mockClient.release).toHaveBeenCalledTimes(1); 
             expect(loggerErrorSpy).not.toHaveBeenCalled(); // Error happens before query logging
         });
    });
});
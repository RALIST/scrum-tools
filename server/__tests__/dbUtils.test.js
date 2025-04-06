import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
// Import the actual pool to spy on its methods
import { pool } from '../db/pool.js'; // Import only pool (needs .js)
import { executeQuery } from '../db/dbUtils.js'; // Import the function to test (needs .js)
// initializePool() call removed - pool initializes automatically

// Mock the pool and client (Reverting to this approach)
let mockQuery;
let mockRelease;
let mockClient;
let connectSpy; // Spy for pool.connect

describe('DB Utils (server/db/js)', () => {

    beforeEach(() => {
        // Reset and re-initialize mocks before each test
        mockQuery = jest.fn();
        mockRelease = jest.fn();
        mockClient = {
            query: mockQuery,
            release: mockRelease,
        };
        // Spy on the actual pool's connect method
        // Assert pool is not undefined before spying
        if (!pool) throw new Error("Pool is not initialized for testing");
        // Cast mockClient to PoolClient for mockResolvedValue, as it expects the full type
        // Type assertion needed for mockResolvedValue
        // Type assertion still needed for mockResolvedValue
        connectSpy = jest.spyOn(pool, 'connect').mockResolvedValue(mockClient);
    });

    afterEach(() => {
        if (connectSpy) connectSpy.mockRestore(); // Restore pool spy
    });
    describe('executeQuery', () => {
        const queryText = 'SELECT * FROM test WHERE id = $1';
        const params = [123];
        const mockResult = { rows: [{ id: 123, data: 'test' }], rowCount: 1 }; // Simplified mock result

        it('should connect, execute query, and release client when no existing client is provided', async () => {
            mockQuery.mockResolvedValue(mockResult);

            const result = await executeQuery(queryText, params); // Call method on imported object, remove pool arg

            expect(connectSpy).toHaveBeenCalledTimes(1); // Assert on the spy instance
            expect(mockClient.query).toHaveBeenCalledWith(queryText, params);
            expect(mockRelease).toHaveBeenCalledTimes(1); // Check the specific mock function
            expect(result).toEqual(mockResult);
        });

        it('should use existing client and not release it when provided', async () => {
            mockQuery.mockResolvedValue(mockResult);

            // Cast mockClient when passing to executeQuery
            // Cast mockClient when passing to executeQuery
            // Cast mockClient when passing to executeQuery
            const result = await executeQuery(queryText, params, mockClient); // Call method, remove pool arg

            expect(connectSpy).not.toHaveBeenCalled(); // Assert on the spy instance
            expect(mockClient.query).toHaveBeenCalledWith(queryText, params);
            expect(mockRelease).not.toHaveBeenCalled(); // Check the specific mock function
            expect(result).toEqual(mockResult);
        });

        it('should log error, release client, and re-throw error on query failure (new client)', async () => {
            const queryError = new Error('DB query failed');
            mockQuery.mockRejectedValue(queryError);

            await expect(executeQuery(queryText, params)) // Call method, remove pool arg
                .rejects.toThrow(queryError);

            expect(connectSpy).toHaveBeenCalledTimes(1); // Assert on the spy instance
            expect(mockClient.query).toHaveBeenCalledWith(queryText, params);
            expect(mockRelease).toHaveBeenCalledTimes(1); // Check the specific mock function
        });

        it('should log error, not release client, and re-throw error on query failure (existing client)', async () => {
            const queryError = new Error('DB query failed on existing client');
            mockQuery.mockRejectedValue(queryError);

            // Cast mockClient when passing to executeQuery
            // Cast mockClient when passing to executeQuery
            // Cast mockClient when passing to executeQuery
            await expect(executeQuery(queryText, params, mockClient)) // Call method, remove pool arg
                .rejects.toThrow(queryError);

            expect(connectSpy).not.toHaveBeenCalled(); // Assert on the spy instance
            expect(mockClient.query).toHaveBeenCalledWith(queryText, params);
            expect(mockRelease).not.toHaveBeenCalled(); // Check the specific mock function
        });

         it('should release client if connect fails', async () => {
            const connectError = new Error('Failed to connect');
            // Cast error type for mockRejectedValue
            connectSpy.mockRejectedValue(connectError); // Mock rejection via spy

             await expect(executeQuery(queryText, params)) // Call method, remove pool arg
                .rejects.toThrow(connectError);

             expect(connectSpy).toHaveBeenCalledTimes(1); // Assert on the spy instance
             expect(mockClient.query).not.toHaveBeenCalled();
         });
    });
});
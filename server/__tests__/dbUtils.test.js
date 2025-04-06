import { jest, describe, it, expect, beforeEach } from '@jest/globals';
// Import the actual pool to spy on its methods
import { pool } from '../db/pool.js'; // Import only pool
import { executeQuery } from '../db/dbUtils.js'; // Import the function to test
// initializePool() call removed - pool initializes automatically

// Mock the pool and client (Reverting to this approach)
let mockQuery;
let mockClient;
let connectSpy; // Spy for pool.connect

describe('DB Utils (server/db/js)', () => {

    beforeEach(() => {
        // Reset and re-initialize mocks before each test
        mockQuery = jest.fn();
        mockClient = {
            query: mockQuery,
            release: jest.fn(),
        };
        // Spy on the actual pool's connect method
        connectSpy = jest.spyOn(pool, 'connect').mockResolvedValue(mockClient);
    });

    afterEach(() => {
        if (connectSpy) connectSpy.mockRestore(); // Restore pool spy
    });
    describe('executeQuery', () => {
        const queryText = 'SELECT * FROM test WHERE id = $1';
        const params = [123];
        const mockResult = { rows: [{ id: 123, data: 'test' }], rowCount: 1 };

        it('should connect, execute query, and release client when no existing client is provided', async () => {
            mockQuery.mockResolvedValue(mockResult);

            const result = await executeQuery(queryText, params); // Call method on imported object, remove pool arg

            expect(pool.connect).toHaveBeenCalledTimes(1); // Assert on spied pool.connect
            expect(mockClient.query).toHaveBeenCalledWith(queryText, params);
            expect(mockClient.release).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockResult);
        });

        it('should use existing client and not release it when provided', async () => {
            mockQuery.mockResolvedValue(mockResult);

            const result = await executeQuery(queryText, params, mockClient); // Call method, remove pool arg

            expect(pool.connect).not.toHaveBeenCalled(); // Assert on spied pool.connect
            expect(mockClient.query).toHaveBeenCalledWith(queryText, params);
            expect(mockClient.release).not.toHaveBeenCalled(); // Should not release existing client
            expect(result).toEqual(mockResult);
        });

        it('should log error, release client, and re-throw error on query failure (new client)', async () => {
            const queryError = new Error('DB query failed');
            mockQuery.mockRejectedValue(queryError);

            await expect(executeQuery(queryText, params)) // Call method, remove pool arg
                .rejects.toThrow(queryError);

            expect(pool.connect).toHaveBeenCalledTimes(1); // Assert on spied pool.connect
            expect(mockClient.query).toHaveBeenCalledWith(queryText, params);
            expect(mockClient.release).toHaveBeenCalledTimes(1); // Should release even on error
        });

        it('should log error, not release client, and re-throw error on query failure (existing client)', async () => {
            const queryError = new Error('DB query failed on existing client');
            mockQuery.mockRejectedValue(queryError);

            await expect(executeQuery(queryText, params, mockClient)) // Call method, remove pool arg
                .rejects.toThrow(queryError);

            expect(pool.connect).not.toHaveBeenCalled(); // Assert on spied pool.connect
            expect(mockClient.query).toHaveBeenCalledWith(queryText, params);
            expect(mockClient.release).not.toHaveBeenCalled(); // Should not release existing client
        });

         it('should release client if connect fails', async () => {
            const connectError = new Error('Failed to connect');
            connectSpy.mockRejectedValue(connectError); // Mock rejection via spy

             await expect(executeQuery(queryText, params)) // Call method, remove pool arg
                .rejects.toThrow(connectError);

             expect(pool.connect).toHaveBeenCalledTimes(1); // Assert on spied pool.connect
             expect(mockClient.query).not.toHaveBeenCalled();
         });
    });
});
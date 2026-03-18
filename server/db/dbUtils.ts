import type {PoolClient, QueryResult, QueryResultRow} from 'pg';
import type pg from 'pg'; // Import necessary types
import { pool } from './pool.js'; // Import pool internally (needs .js extension)

/**
 * Executes a database query using a client from the pool.
 * Handles client acquisition and release automatically.
 *
 * @param queryText - The SQL query string.
 * @param params - Optional array of query parameters.
 * @param existingClient - Optional existing client to use for the query (e.g., within a transaction).
 * @returns A promise that resolves with the query result.
 * @throws Throws an error if the query fails.
 */
export const executeQuery = async <R extends QueryResultRow = QueryResultRow>(
    queryText: string,
    params: unknown[] = [],
    existingClient: PoolClient | null = null
): Promise<QueryResult<R>> => {
    const isNewClient = !existingClient;
    const client: PoolClient = existingClient || await (pool as pg.Pool).connect(); // Type client and assert pool type

    try {
        const result = await client.query<R>(queryText, params);
        return result;
    } finally {
        // Only release the client if it was acquired within this function
        if (isNewClient) {
            client.release();
        }
    }
};

import { pool } from './pool.js'; // Import pool internally

/**
 * Executes a database query using a client from the pool.
 * Handles client acquisition and release automatically.
 *
 * @param {string} queryText - The SQL query string.
 * @param {Array} [params=[]] - Optional array of query parameters.
 * @returns {Promise<QueryResult>} A promise that resolves with the query result.
 * @param {pg.Client | null} [existingClient=null] - Optional existing client to use for the query (e.g., within a transaction).
 * @returns {Promise<QueryResult>} A promise that resolves with the query result.
 * @throws {Error} Throws an error if the query fails.
 */
export const executeQuery = async (queryText, params = [], existingClient = null) => { // Export directly, remove pool param
    const isNewClient = !existingClient;
    const client = existingClient || await pool.connect(); // Use internal pool

    try {
        const result = await client.query(queryText, params);
        return result;
    } catch (error) {
        throw error; // Re-throw the original error
    } finally {
        // Only release the client if it was acquired within this function
        if (isNewClient && client) {
            client.release();
        } else if (client) {
        }
    }
};

import { pool } from './pool.js'; // Import pool directly
import logger from '../logger.js'; // Import the logger

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
const executeQueryInternal = async (queryText, params = [], existingClient = null) => { // Remove pool argument
    const isNewClient = !existingClient;
    const client = existingClient || await pool.connect(); // Use internal pool
    // logger.info(`Executing query (new client: ${isNewClient}): ${queryText.substring(0, 100)}...`, { params: params }); // Log start // REMOVED VERBOSE LOG

    try {
        const result = await client.query(queryText, params);
        // logger.info(`Query executed successfully. Row count: ${result?.rowCount}`); // Log success // REMOVED VERBOSE LOG
        return result;
    } catch (error) {
        // Log the error internally using logger, but re-throw
        // Log the full error object
        logger.error('Database query error:', {
            query: queryText,
            params: params,
            error: error, // Log the full error object
            stack: error.stack // Ensure stack trace is logged
        });
        throw error; // Re-throw the original error
    } finally {
        // Only release the client if it was acquired within this function
        if (isNewClient && client) {
            // logger.info('Releasing acquired DB client.'); // Log release // REMOVED VERBOSE LOG
            client.release();
        } else if (client) {
             // logger.info('Not releasing DB client (was passed in).'); // REMOVED VERBOSE LOG
        }
    }
};

// Export an object containing the function
export const dbUtils = {
    executeQuery: executeQueryInternal
};

// Example of a function that might need multiple operations within a transaction
// Note: This simple executeQuery doesn't handle transactions automatically.
// For transactions, you'd still need to manage the client manually.
// export const performTransaction = async (callback) => {
//     const client = await pool.connect();
//     try {
//         await client.query('BEGIN');
//         const result = await callback(client); // Pass client to the callback
//         await client.query('COMMIT');
//         return result;
//     } catch (error) {
//         await client.query('ROLLBACK');
//         console.error('Database transaction error:', error);
//         throw error;
//     } finally {
//         client.release();
//     }
// };

import pool from './pool.js';
import logger from '../logger.js'; // Import the logger

/**
 * Executes a database query using a client from the pool.
 * Handles client acquisition and release automatically.
 *
 * @param {string} queryText - The SQL query string.
 * @param {Array} [params=[]] - Optional array of query parameters.
 * @returns {Promise<QueryResult>} A promise that resolves with the query result.
 * @throws {Error} Throws an error if the query fails.
 */
export const executeQuery = async (queryText, params = []) => {
    const client = await pool.connect();
    try {
        const result = await client.query(queryText, params);
        return result;
    } catch (error) {
        // Log the error internally using logger, but re-throw
        logger.error('Database query error:', {
            query: queryText,
            params: params, // Be cautious logging parameters in production if they contain sensitive data
            error: error.message,
            // stack: error.stack // Optionally log stack trace
        });
        throw error; // Re-throw the original error
    } finally {
        client.release();
    }
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

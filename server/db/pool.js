import pg from 'pg'
import logger from '../logger.js'; // Import the logger
const { Pool } = pg;
let pool;

// Initialize pool immediately when the module loads
export const initializePool = () => {
    pool = new Pool({
        user: process.env.DB_USER || '',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || '',
        password: String(process.env.DB_PASSWORD || ''),
        port: parseInt(process.env.DB_PORT || '5432'),
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });

    // Test connection using promises
    pool.connect()
        .then(client => {
            logger.info('Successfully connected to database');
            client.release();
        })
        .catch(err => {
            logger.error('Error connecting to the database:', { stack: err.stack });
        });
};

// Call initialize immediately
initializePool();

// SIGINT handler removed - Jest global teardown handles pool closure for tests.
// For regular application shutdown, a more robust mechanism might be needed
// depending on the deployment strategy (e.g., in server shutdown logic).

// Export only the initialized pool
export { pool };

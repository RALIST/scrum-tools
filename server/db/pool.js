import pg from 'pg'
import logger from '../logger.js'; // Import the logger

const { Pool } = pg;
let pool;

// Initialize function that you can call after environment variables are loaded
function initializePool() {
    logger.info("Connecting to production database", process.env.DB_HOST);
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
}

// Add event listener for process termination
process.on('SIGINT', async () => {
    // Use logger.info
    logger.info('Closing database pool...');
    await pool.end();
    process.exit(0);
});

export { pool, initializePool };

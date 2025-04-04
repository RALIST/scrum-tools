import pg from 'pg'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from '../logger.js'; // Import the logger

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables - prioritize .env.local
try {
  dotenv.config({ path: join(__dirname, '../.env.local') });
  logger.info('Loaded environment variables from .env.local');
} catch (e) {
  try {
    dotenv.config({ path: join(__dirname, '../.env') });
    logger.info('Loaded environment variables from .env');
  } catch (e2) {
    logger.warn('Could not load .env.local or .env file for database pool. Using default environment variables if available.');
  }
}


const { Pool } = pg;

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    // Add some reasonable defaults for production
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
})

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        // Use logger.error
        logger.error('Error connecting to the database:', { stack: err.stack });
    } else {
        // Use logger.info
        logger.info('Successfully connected to database');
        release();
    }
});

// Add event listener for process termination
process.on('SIGINT', async () => {
    // Use logger.info
    logger.info('Closing database pool...');
    await pool.end();
    process.exit(0);
});

export default pool

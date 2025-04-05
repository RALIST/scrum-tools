import pg from 'pg'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import logger from '../logger.js'; // Import the logger
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const env = process.env.NODE_ENV || 'development'; // Default to development if not set
console.log(`Current environment: ${env}`);

if (env == "development") {
   dotenv.config({ path: path.join(__dirname, '.env.development') });
   console.log('Development environment variables loaded from .env.development');
} else if (env == "production") {
   dotenv.config({ path: path.join(__dirname, '.env') });
   console.log('Production environment variables loaded from .env');
   console.log("Connecting to production database", process.env.DB_HOST);
} else {
   console.warn('No environment variables loaded. Using default environment variables if available.');
}

const { Pool } = pg;

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
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

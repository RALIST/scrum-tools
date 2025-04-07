import pg from 'pg'; // Use default import for pg
import logger from '../logger.js'; // Import the logger (now .ts, but need .js extension for NodeNext)

let pool: pg.Pool | undefined; // Type the pool variable using pg.Pool

const prodLogger = logger.child({ module: 'db/pool' }); // Create a child logger for this module

// Initialize pool immediately when the module loads
export const initializePool = (): void => {
    if (process.env.NODE_ENV !== 'production') {
      prodLogger.info('PostgreSQL connection pool initializing...', {
          user: process.env.DB_USER,
          host: process.env.DB_HOST,
          database: process.env.DB_NAME,
          port: process.env.DB_PORT,
      });
    }

    pool = new pg.Pool({ // Use pg.Pool constructor
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
      .then((client: pg.PoolClient) => {// Type the client using pg.PoolClient
          if (process.env.NODE_ENV !== 'production') {
            prodLogger.info('PostgreSQL connection pool initialized successfully.');
          }
          client.release();
      })
      .catch((err: Error) => { // Type the error
          logger.error('Error connecting to the database:', { stack: err.stack });
      });
};

// Call initialize immediately
if (!pool) initializePool();

// SIGINT handler removed - Jest global teardown handles pool closure for tests.
// For regular application shutdown, a more robust mechanism might be needed
// depending on the deployment strategy (e.g., in server shutdown logic).

// Export only the initialized pool
export { pool };

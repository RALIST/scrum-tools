import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load test env vars BEFORE any db module reads process.env
dotenv.config({ path: join(__dirname, '.env.test') });
process.env.NODE_ENV = 'test';

// Now initialize the pool with the test env vars
const { initializePool } = await import('./db/pool.js');
initializePool();

// Use CommonJS require for dotenv within this .cjs file
const dotenv = require('dotenv');
const path = require('path');

// Load appropriate .env file (e.g., .env.local or .env)
// Prioritize .env.local if it exists
try {
  dotenv.config({ path: path.join(__dirname, '.env.local') });
} catch (e) {
  // If .env.local doesn't exist or fails, try .env
  try {
    dotenv.config({ path: path.join(__dirname, '.env') });
  } catch (e2) {
    console.warn('Could not load .env.local or .env file for migrations. Using default environment variables if available.');
  }
}

module.exports = {
  // Connection details loaded from environment variables
  databaseUrl: process.env.DATABASE_URL, // Or construct from PGHOST, PGUSER, etc.
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,

  // Directory where migration files will be stored
  dir: 'migrations', // We'll create this directory

  // Name of the table to track applied migrations
  migrationsTable: 'pgmigrations',

  // Ensure transactions are used for each migration
  decamelize: true, // Converts camelCase function names to snake_case table/column names if needed
  createSchema: true, // Creates the schema if it doesn't exist (usually 'public')
  createMigrationsTable: true, // Creates the migrations tracking table if it doesn't exist
};

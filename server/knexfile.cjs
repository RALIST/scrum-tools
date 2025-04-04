// Use CommonJS require for dotenv within this .js file (Knex typically uses CommonJS for config)
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables - prioritize .env.local
try {
  dotenv.config({ path: path.join(__dirname, '.env.local') });
  console.log('Knex config loaded environment variables from .env.local');
} catch (e) {
  try {
    dotenv.config({ path: path.join(__dirname, '.env') });
    console.log('Knex config loaded environment variables from .env');
  } catch (e2) {
    console.warn('Knex config could not load .env.local or .env file. Using default environment variables if available.');
  }
}

// Knex configuration object
module.exports = {
  development: {
    client: 'pg', // Specify the PostgreSQL client
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    migrations: {
      directory: './data/migrations', // New directory for Knex migrations
      tableName: 'knex_migrations' // Default Knex migrations table
    },
    // seeds: { // Optional: configure seeds if needed later
    //   directory: './data/seeds'
    // }
  },

  // Add other environments like production if needed
  // production: {
  //   client: 'pg',
  //   connection: {
  //     host: process.env.DB_HOST,
  //     port: parseInt(process.env.DB_PORT || '5432', 10),
  //     user: process.env.DB_USER,
  //     password: process.env.DB_PASSWORD,
  //     database: process.env.DB_NAME,
  //     ssl: { rejectUnauthorized: false } // Example for production SSL
  //   },
  //   migrations: {
  //     directory: './data/migrations',
  //     tableName: 'knex_migrations'
  //   }
  // }
};

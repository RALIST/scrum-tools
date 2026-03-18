import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import knex from 'knex';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function setup(): Promise<void> {
  dotenv.config({ path: join(__dirname, '.env.test') });

  const dbName = process.env.DB_NAME ?? 'scrum_tools_test';
  const connectionBase = {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };

  // Connect to default 'postgres' database to create the test DB
  const adminPool = new pg.Pool({ ...connectionBase, database: 'postgres' });
  try {
    const result = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (result.rowCount === 0) {
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Created test database: ${dbName}`);
    }
  } finally {
    await adminPool.end();
  }

  // Run migrations against the test database
  const db = knex({
    client: 'pg',
    connection: { ...connectionBase, database: dbName },
    migrations: {
      directory: join(__dirname, 'data/migrations'),
    },
  });

  await db.migrate.latest();
  console.log('Test database migrations complete');
  await db.destroy();
}

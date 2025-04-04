-- User 'scrum_user' is expected to exist in PostgreSQL.
-- This script will create the database and grant privileges to 'scrum_user'.

-- Create database if not exists
SELECT 'CREATE DATABASE scrum_tools'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'scrum_tools')\gexec

-- Connect to the database
\c scrum_tools;

-- Grant privileges to user 'scrum_user' (from .env.local)
GRANT ALL PRIVILEGES ON DATABASE scrum_tools TO scrum_user;
GRANT ALL ON SCHEMA public TO scrum_user;

-- NOTE: Table creation is handled by migrations (npm run db:migrate:up).
-- The CREATE TABLE statements below are removed to avoid conflicts and keep
-- schema definition centralized in migrations.

-- Grant table privileges (will apply to tables created by migrations)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO scrum_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO scrum_user;

-- Add default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO scrum_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO scrum_user;

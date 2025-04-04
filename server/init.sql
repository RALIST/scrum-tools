-- Create user if not exists
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'scrum_user') THEN
      CREATE USER scrum_user WITH PASSWORD 'your_password';
   END IF;
END
$do$;

-- Create database if not exists
SELECT 'CREATE DATABASE scrum_tools'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'scrum_tools')\gexec

-- Connect to the database
\c scrum_tools;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE scrum_tools TO scrum_user;
GRANT ALL ON SCHEMA public TO scrum_user;

-- NOTE: Table creation is now handled by server/db/schema.js on server start.
-- The CREATE TABLE statements below are removed to avoid conflicts and keep
-- schema definition centralized in schema.js.

-- Grant table privileges (will apply to tables created by schema.js)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO scrum_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO scrum_user;

-- Add default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO scrum_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO scrum_user;

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

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    sequence VARCHAR(50) DEFAULT 'fibonacci',
    password VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create participants table
CREATE TABLE IF NOT EXISTS participants (
    id VARCHAR(255),
    room_id VARCHAR(255) REFERENCES rooms(id) ON DELETE CASCADE,
    name VARCHAR(255),
    vote VARCHAR(50),
    PRIMARY KEY (id, room_id)
);

-- Grant table privileges
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO scrum_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO scrum_user;

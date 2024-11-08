-- Create database if it doesn't exist
CREATE DATABASE scrum_tools;

-- Connect to the database
\c scrum_tools;

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

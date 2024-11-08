# Server Setup

## Database Setup

1. Install PostgreSQL if not already installed:
   ```bash
   # macOS (using Homebrew)
   brew install postgresql@14
   brew services start postgresql@14
   ```

2. Create the database and initialize schema:
   ```bash
   # Create database and tables
   psql postgres -f init.sql
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update the values if your PostgreSQL configuration is different

## Running the Server

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

The server will run on port 3001 by default.

## Database Schema

### Rooms Table
```sql
CREATE TABLE rooms (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    sequence VARCHAR(50) DEFAULT 'fibonacci',
    password VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Participants Table
```sql
CREATE TABLE participants (
    id VARCHAR(255),
    room_id VARCHAR(255) REFERENCES rooms(id) ON DELETE CASCADE,
    name VARCHAR(255),
    vote VARCHAR(50),
    PRIMARY KEY (id, room_id)
);
```

## Environment Variables

- `DB_USER`: PostgreSQL username (default: postgres)
- `DB_HOST`: Database host (default: localhost)
- `DB_NAME`: Database name (default: scrum_tools)
- `DB_PASSWORD`: Database password
- `DB_PORT`: Database port (default: 5432)

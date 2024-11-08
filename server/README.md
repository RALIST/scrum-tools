# Server Setup

## Database Setup

1. Install PostgreSQL if not already installed:
   ```bash
   # macOS (using Homebrew)
   brew install postgresql@14
   brew services start postgresql@14
   ```

2. Create PostgreSQL user and database:
   ```bash
   # Connect to PostgreSQL as superuser
   sudo -u postgres psql

   # Create user and database (in psql)
   CREATE USER scrum_user WITH PASSWORD 'your_password';
   CREATE DATABASE scrum_tools;
   GRANT ALL PRIVILEGES ON DATABASE scrum_tools TO scrum_user;
   \c scrum_tools
   GRANT ALL ON SCHEMA public TO scrum_user;
   \q
   ```

3. Update PostgreSQL authentication (if needed):
   ```bash
   # Edit pg_hba.conf
   sudo nano /etc/postgresql/14/main/pg_hba.conf

   # Add or modify this line:
   # local   all   scrum_user   md5
   
   # Restart PostgreSQL
   sudo service postgresql restart
   ```

4. Initialize schema:
   ```bash
   # Run as scrum_user
   psql -U scrum_user -d scrum_tools -f init.sql
   ```

5. Configure environment variables:
   ```bash
   # Copy example env file
   cp .env.example .env
   
   # Update .env with your credentials:
   DB_USER=scrum_user
   DB_HOST=localhost
   DB_NAME=scrum_tools
   DB_PASSWORD=your_password
   DB_PORT=5432
   ```

## Running the Server

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   # Development mode with auto-reload
   npm run dev

   # Production mode
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

- `DB_USER`: PostgreSQL username (default: scrum_user)
- `DB_HOST`: Database host (default: localhost)
- `DB_NAME`: Database name (default: scrum_tools)
- `DB_PASSWORD`: Database password
- `DB_PORT`: Database port (default: 5432)

## Troubleshooting

### Peer Authentication Failed
If you see "Peer authentication failed", it means PostgreSQL is using peer authentication instead of password authentication. Follow these steps:

1. Edit pg_hba.conf:
   ```bash
   sudo nano /etc/postgresql/14/main/pg_hba.conf
   ```

2. Find the line for local connections and change the authentication method:
   ```
   # TYPE  DATABASE        USER            ADDRESS                 METHOD
   local   all            all                                     md5
   ```

3. Restart PostgreSQL:
   ```bash
   sudo service postgresql restart
   ```

### Permission Denied
If you see permission errors when accessing the database:

1. Connect to PostgreSQL as superuser:
   ```bash
   sudo -u postgres psql
   ```

2. Grant necessary permissions:
   ```sql
   GRANT ALL PRIVILEGES ON DATABASE scrum_tools TO scrum_user;
   \c scrum_tools
   GRANT ALL ON SCHEMA public TO scrum_user;

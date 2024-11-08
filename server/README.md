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

   # Run the initialization script
   \i init.sql
   ```

3. Configure environment variables:
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

### Planning Poker Tables

#### Rooms Table
```sql
CREATE TABLE rooms (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    sequence VARCHAR(50) DEFAULT 'fibonacci',
    password VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### Participants Table
```sql
CREATE TABLE participants (
    id VARCHAR(255),
    room_id VARCHAR(255) REFERENCES rooms(id) ON DELETE CASCADE,
    name VARCHAR(255),
    vote VARCHAR(50),
    PRIMARY KEY (id, room_id)
);
```

### Retro Board Tables

#### Retro Boards Table
```sql
CREATE TABLE retro_boards (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### Retro Cards Table
```sql
CREATE TABLE retro_cards (
    id VARCHAR(255) PRIMARY KEY,
    board_id VARCHAR(255) REFERENCES retro_boards(id) ON DELETE CASCADE,
    column_id VARCHAR(50),
    text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Planning Poker

- `GET /api/rooms` - List all planning poker rooms
- `POST /api/rooms` - Create a new planning poker room
- `POST /api/rooms/:roomId/verify-password` - Verify room password

### Retro Board

- `GET /api/retro/:boardId` - Get retro board data
- `POST /api/retro` - Create a new retro board

## Socket.IO Events

### Planning Poker Events

- `joinRoom` - Join a planning poker room
- `vote` - Submit a vote
- `revealVotes` - Reveal all votes
- `resetVotes` - Start a new round

### Retro Board Events

- `joinRetroBoard` - Join a retro board
- `addRetroCard` - Add a new card
- `deleteRetroCard` - Delete a card

## Troubleshooting

### Database Connection Issues

1. Check PostgreSQL service status:
   ```bash
   brew services list
   ```

2. Verify database user permissions:
   ```sql
   \du scrum_user
   ```

3. Test connection:
   ```bash
   psql -U scrum_user -d scrum_tools -h localhost
   ```

### Common Errors

- "Peer authentication failed": Update pg_hba.conf to use md5 authentication
- "Permission denied": Grant necessary privileges to scrum_user
- "Database does not exist": Run init.sql as superuser

import pool from './pool.js'

const createTables = async () => {
    const client = await pool.connect()
    try {
        // Create users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP WITH TIME ZONE
            )
        `)

        // Create workspaces table
        await client.query(`
            CREATE TABLE IF NOT EXISTS workspaces (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                owner_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `)

        // Create workspace_members table
        await client.query(`
            CREATE TABLE IF NOT EXISTS workspace_members (
                workspace_id VARCHAR(255) REFERENCES workspaces(id) ON DELETE CASCADE,
                user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
                role VARCHAR(50) DEFAULT 'member',
                joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (workspace_id, user_id)
            )
        `)

        // Create retro_boards table
        await client.query(`
            CREATE TABLE IF NOT EXISTS retro_boards (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                timer_running BOOLEAN DEFAULT false,
                time_left INTEGER DEFAULT 300,
                default_timer INTEGER DEFAULT 300,
                hide_cards_by_default BOOLEAN DEFAULT false,
                hide_author_names BOOLEAN DEFAULT false,
                password VARCHAR(255),
                workspace_id VARCHAR(255) REFERENCES workspaces(id) NULL,
                created_by VARCHAR(255) REFERENCES users(id) NULL
            )
        `)

        // Create retro_cards table
        await client.query(`
            CREATE TABLE IF NOT EXISTS retro_cards (
                id VARCHAR(255) PRIMARY KEY,
                board_id VARCHAR(255) REFERENCES retro_boards(id) ON DELETE CASCADE,
                column_id VARCHAR(50),
                text TEXT,
                author_name VARCHAR(255),
                author_id VARCHAR(255) REFERENCES users(id) NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `)

        // Create retro_card_votes table
        await client.query(`
            CREATE TABLE IF NOT EXISTS retro_card_votes (
                card_id VARCHAR(255) REFERENCES retro_cards(id) ON DELETE CASCADE,
                user_name VARCHAR(255),
                user_id VARCHAR(255) REFERENCES users(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (card_id, user_id)
            )
        `)

        // Create retro_board_history table
        await client.query(`
            CREATE TABLE IF NOT EXISTS retro_board_history (
                id VARCHAR(255) PRIMARY KEY,
                board_id VARCHAR(255) REFERENCES retro_boards(id) ON DELETE CASCADE,
                snapshot JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `)

        // Create rooms table (for planning poker)
        await client.query(`
            CREATE TABLE IF NOT EXISTS rooms (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255),
                sequence VARCHAR(50) DEFAULT 'fibonacci',
                password VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                workspace_id VARCHAR(255) REFERENCES workspaces(id) NULL,
                created_by VARCHAR(255) REFERENCES users(id) NULL
            )
        `)

        // Create participants table (for planning poker)
        await client.query(`
            CREATE TABLE IF NOT EXISTS participants (
                id VARCHAR(255),
                room_id VARCHAR(255) REFERENCES rooms(id) ON DELETE CASCADE,
                name VARCHAR(255),
                vote VARCHAR(50),
                user_id VARCHAR(255) REFERENCES users(id) NULL,
                PRIMARY KEY (id, room_id)
            )
        `)

        // Create teams table (for velocity tracking)
        await client.query(`
            CREATE TABLE IF NOT EXISTS teams (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                password VARCHAR(255),
                workspace_id VARCHAR(255) REFERENCES workspaces(id) NULL,
                created_by VARCHAR(255) REFERENCES users(id) NULL
            )
        `)

        // Create sprints table
        await client.query(`
            CREATE TABLE IF NOT EXISTS sprints (
                id VARCHAR(255) PRIMARY KEY,
                team_id VARCHAR(255) REFERENCES teams(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `)

        // Create sprint_velocity table
        await client.query(`
            CREATE TABLE IF NOT EXISTS sprint_velocity (
                sprint_id VARCHAR(255) REFERENCES sprints(id) ON DELETE CASCADE,
                committed_points INTEGER NOT NULL,
                completed_points INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (sprint_id)
            )
        `)

        console.log('Tables created successfully')
    } catch (error) {
        console.error('Error creating tables:', error)
        throw error
    } finally {
        client.release()
    }
}

createTables().catch(console.error)

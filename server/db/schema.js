import pool from './pool.js'

// Initialize database schema
export const initSchema = async () => {
    const client = await pool.connect()
    try {
        // Planning Poker tables
        await client.query(`
            CREATE TABLE IF NOT EXISTS rooms (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255),
                sequence VARCHAR(50) DEFAULT 'fibonacci',
                password VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `)

        await client.query(`
            CREATE TABLE IF NOT EXISTS participants (
                id VARCHAR(255),
                room_id VARCHAR(255) REFERENCES rooms(id) ON DELETE CASCADE,
                name VARCHAR(255),
                vote VARCHAR(50),
                PRIMARY KEY (id, room_id)
            )
        `)

        // Retro Board tables
        await client.query(`
            CREATE TABLE IF NOT EXISTS retro_boards (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255),
                timer_running BOOLEAN DEFAULT false,
                time_left INTEGER DEFAULT 300,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `)

        await client.query(`
            CREATE TABLE IF NOT EXISTS retro_cards (
                id VARCHAR(255) PRIMARY KEY,
                board_id VARCHAR(255) REFERENCES retro_boards(id) ON DELETE CASCADE,
                column_id VARCHAR(50),
                text TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `)

        // Add timer_running and time_left columns if they don't exist
        await client.query(`
            DO $$ 
            BEGIN
                BEGIN
                    ALTER TABLE retro_boards ADD COLUMN timer_running BOOLEAN DEFAULT false;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;

                BEGIN
                    ALTER TABLE retro_boards ADD COLUMN time_left INTEGER DEFAULT 300;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;
            END $$;
        `)

        console.log('Database schema initialized successfully')
    } catch (error) {
        console.error('Error initializing database schema:', error)
        throw error
    } finally {
        client.release()
    }
}

// Initialize schema when module is loaded
initSchema().catch(console.error)

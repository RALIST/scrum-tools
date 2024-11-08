import pool from './pool.js'

const createTables = async () => {
    const client = await pool.connect()
    try {
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
                password VARCHAR(255)
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
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `)

        // Create retro_card_votes table
        await client.query(`
            CREATE TABLE IF NOT EXISTS retro_card_votes (
                card_id VARCHAR(255) REFERENCES retro_cards(id) ON DELETE CASCADE,
                user_name VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (card_id, user_name)
            )
        `)

        // Create rooms table (for planning poker)
        await client.query(`
            CREATE TABLE IF NOT EXISTS rooms (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255),
                sequence VARCHAR(50) DEFAULT 'fibonacci',
                password VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `)

        // Create participants table (for planning poker)
        await client.query(`
            CREATE TABLE IF NOT EXISTS participants (
                id VARCHAR(255),
                room_id VARCHAR(255) REFERENCES rooms(id) ON DELETE CASCADE,
                name VARCHAR(255),
                vote VARCHAR(50),
                PRIMARY KEY (id, room_id)
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

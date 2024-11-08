import pg from 'pg'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') })

const { Pool } = pg

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    // Add some reasonable defaults for production
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
})

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to the database:', err.stack)
    } else {
        console.log('Successfully connected to database')
        release()
    }
})

// Initialize database schema
const initSchema = async () => {
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

        console.log('Database schema initialized successfully')
    } catch (error) {
        console.error('Error initializing database schema:', error)
        throw error
    } finally {
        client.release()
    }
}

// Room operations
export const createRoom = async (roomId, name, sequence, password) => {
    const client = await pool.connect()
    try {
        await client.query(
            'INSERT INTO rooms (id, name, sequence, password) VALUES ($1, $2, $3, $4)',
            [roomId, name || roomId, sequence, password]
        )
    } catch (error) {
        console.error('Error creating room:', error)
        throw error
    } finally {
        client.release()
    }
}

export const getRooms = async () => {
    const client = await pool.connect()
    try {
        const roomsResult = await client.query(`
            SELECT r.*, COUNT(p.id) as participant_count
            FROM rooms r
            LEFT JOIN participants p ON r.id = p.room_id
            GROUP BY r.id
        `)
        return roomsResult.rows
    } catch (error) {
        console.error('Error getting rooms:', error)
        throw error
    } finally {
        client.release()
    }
}

export const getRoom = async (roomId) => {
    const client = await pool.connect()
    try {
        const roomResult = await client.query('SELECT * FROM rooms WHERE id = $1', [roomId])
        if (roomResult.rows.length === 0) {
            return null
        }

        const participantsResult = await client.query(
            'SELECT * FROM participants WHERE room_id = $1',
            [roomId]
        )

        return {
            ...roomResult.rows[0],
            participants: new Map(participantsResult.rows.map(p => [p.id, {
                id: p.id,
                name: p.name,
                vote: p.vote
            }]))
        }
    } catch (error) {
        console.error('Error getting room:', error)
        throw error
    } finally {
        client.release()
    }
}

// Participant operations
export const addParticipant = async (roomId, participantId, name) => {
    const client = await pool.connect()
    try {
        await client.query(
            'INSERT INTO participants (id, room_id, name) VALUES ($1, $2, $3)',
            [participantId, roomId, name]
        )
    } catch (error) {
        console.error('Error adding participant:', error)
        throw error
    } finally {
        client.release()
    }
}

export const updateParticipantName = async (roomId, participantId, name) => {
    const client = await pool.connect()
    try {
        await client.query(
            'UPDATE participants SET name = $1 WHERE room_id = $2 AND id = $3',
            [name, roomId, participantId]
        )
    } catch (error) {
        console.error('Error updating participant name:', error)
        throw error
    } finally {
        client.release()
    }
}

export const updateParticipantVote = async (roomId, participantId, vote) => {
    const client = await pool.connect()
    try {
        await client.query(
            'UPDATE participants SET vote = $1 WHERE room_id = $2 AND id = $3',
            [vote, roomId, participantId]
        )
    } catch (error) {
        console.error('Error updating participant vote:', error)
        throw error
    } finally {
        client.release()
    }
}

export const removeParticipant = async (roomId, participantId) => {
    const client = await pool.connect()
    try {
        await client.query(
            'DELETE FROM participants WHERE room_id = $1 AND id = $2',
            [roomId, participantId]
        )
    } catch (error) {
        console.error('Error removing participant:', error)
        throw error
    } finally {
        client.release()
    }
}

export const resetVotes = async (roomId) => {
    const client = await pool.connect()
    try {
        await client.query(
            'UPDATE participants SET vote = NULL WHERE room_id = $1',
            [roomId]
        )
    } catch (error) {
        console.error('Error resetting votes:', error)
        throw error
    } finally {
        client.release()
    }
}

export const updateRoomSettings = async (roomId, sequence, password) => {
    const client = await pool.connect()
    try {
        const updates = []
        const values = []
        let paramCount = 1

        if (sequence !== undefined) {
            updates.push(`sequence = $${paramCount}`)
            values.push(sequence)
            paramCount++
        }

        if (password !== undefined) {
            updates.push(`password = $${paramCount}`)
            values.push(password)
            paramCount++
        }

        if (updates.length > 0) {
            values.push(roomId)
            await client.query(
                `UPDATE rooms SET ${updates.join(', ')} WHERE id = $${paramCount}`,
                values
            )
        }
    } catch (error) {
        console.error('Error updating room settings:', error)
        throw error
    } finally {
        client.release()
    }
}

// Retro Board operations
export const createRetroBoard = async (boardId, name) => {
    const client = await pool.connect()
    try {
        await client.query(
            'INSERT INTO retro_boards (id, name) VALUES ($1, $2)',
            [boardId, name || boardId]
        )
    } catch (error) {
        console.error('Error creating retro board:', error)
        throw error
    } finally {
        client.release()
    }
}

export const getRetroBoard = async (boardId) => {
    const client = await pool.connect()
    try {
        const boardResult = await client.query(
            'SELECT * FROM retro_boards WHERE id = $1',
            [boardId]
        )
        if (boardResult.rows.length === 0) {
            return null
        }

        const cardsResult = await client.query(
            'SELECT * FROM retro_cards WHERE board_id = $1 ORDER BY created_at ASC',
            [boardId]
        )

        return {
            ...boardResult.rows[0],
            cards: cardsResult.rows
        }
    } catch (error) {
        console.error('Error getting retro board:', error)
        throw error
    } finally {
        client.release()
    }
}

export const addRetroCard = async (boardId, cardId, columnId, text) => {
    const client = await pool.connect()
    try {
        await client.query(
            'INSERT INTO retro_cards (id, board_id, column_id, text) VALUES ($1, $2, $3, $4)',
            [cardId, boardId, columnId, text]
        )
    } catch (error) {
        console.error('Error adding retro card:', error)
        throw error
    } finally {
        client.release()
    }
}

export const deleteRetroCard = async (cardId) => {
    const client = await pool.connect()
    try {
        await client.query('DELETE FROM retro_cards WHERE id = $1', [cardId])
    } catch (error) {
        console.error('Error deleting retro card:', error)
        throw error
    } finally {
        client.release()
    }
}

// Initialize schema when module is loaded
initSchema().catch(console.error)

// Add event listener for process termination
process.on('SIGINT', async () => {
    console.log('Closing database pool...')
    await pool.end()
    process.exit(0)
})

export default pool

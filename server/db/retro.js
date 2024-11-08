import pool from './pool.js'

export const createRetroBoard = async (boardId, name) => {
    const client = await pool.connect()
    try {
        await client.query(
            'INSERT INTO retro_boards (id, name, timer_running, time_left) VALUES ($1, $2, false, 300)',
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

export const startRetroTimer = async (boardId) => {
    const client = await pool.connect()
    try {
        await client.query(
            'UPDATE retro_boards SET timer_running = true, time_left = 300 WHERE id = $1',
            [boardId]
        )
    } catch (error) {
        console.error('Error starting retro timer:', error)
        throw error
    } finally {
        client.release()
    }
}

export const stopRetroTimer = async (boardId) => {
    const client = await pool.connect()
    try {
        await client.query(
            'UPDATE retro_boards SET timer_running = false WHERE id = $1',
            [boardId]
        )
    } catch (error) {
        console.error('Error stopping retro timer:', error)
        throw error
    } finally {
        client.release()
    }
}

export const updateRetroTimer = async (boardId, timeLeft) => {
    const client = await pool.connect()
    try {
        await client.query(
            'UPDATE retro_boards SET time_left = $2 WHERE id = $1',
            [boardId, timeLeft]
        )
    } catch (error) {
        console.error('Error updating retro timer:', error)
        throw error
    } finally {
        client.release()
    }
}

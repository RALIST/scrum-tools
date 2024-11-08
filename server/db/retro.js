import pool from './pool.js'
import bcrypt from 'bcryptjs'

export const createRetroBoard = async (boardId, name, settings = {}) => {
    const client = await pool.connect()
    try {
        const {
            defaultTimer = 300,
            hideCardsByDefault = false,
            hideAuthorNames = false,
            password
        } = settings

        const hashedPassword = password ? await bcrypt.hash(password, 10) : null

        await client.query(
            `INSERT INTO retro_boards (
                id, name, timer_running, time_left, default_timer, 
                hide_cards_by_default, hide_author_names, password
            ) VALUES ($1, $2, false, $3, $4, $5, $6, $7)`,
            [boardId, name || boardId, defaultTimer, defaultTimer, hideCardsByDefault, hideAuthorNames, hashedPassword]
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
            `SELECT c.*, COALESCE(json_agg(v.user_name) FILTER (WHERE v.user_name IS NOT NULL), '[]') as votes
             FROM retro_cards c
             LEFT JOIN retro_card_votes v ON c.id = v.card_id
             WHERE c.board_id = $1
             GROUP BY c.id
             ORDER BY c.created_at ASC`,
            [boardId]
        )

        const board = boardResult.rows[0]
        return {
            ...board,
            hasPassword: !!board.password,
            password: undefined, // Don't send password hash to client
            cards: cardsResult.rows.map(card => ({
                ...card,
                votes: card.votes || []
            }))
        }
    } catch (error) {
        console.error('Error getting retro board:', error)
        throw error
    } finally {
        client.release()
    }
}

export const addRetroCard = async (boardId, cardId, columnId, text, authorName) => {
    const client = await pool.connect()
    try {
        await client.query(
            'INSERT INTO retro_cards (id, board_id, column_id, text, author_name) VALUES ($1, $2, $3, $4, $5)',
            [cardId, boardId, columnId, text, authorName]
        )
    } catch (error) {
        console.error('Error adding retro card:', error)
        throw error
    } finally {
        client.release()
    }
}

export const updateRetroCardAuthor = async (cardId, authorName) => {
    const client = await pool.connect()
    try {
        await client.query(
            'UPDATE retro_cards SET author_name = $2 WHERE id = $1',
            [cardId, authorName]
        )
    } catch (error) {
        console.error('Error updating retro card author:', error)
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

export const toggleRetroCardVote = async (cardId, userName) => {
    const client = await pool.connect()
    try {
        // Check if vote exists
        const voteResult = await client.query(
            'SELECT * FROM retro_card_votes WHERE card_id = $1 AND user_name = $2',
            [cardId, userName]
        )

        if (voteResult.rows.length > 0) {
            // Remove vote
            await client.query(
                'DELETE FROM retro_card_votes WHERE card_id = $1 AND user_name = $2',
                [cardId, userName]
            )
        } else {
            // Add vote
            await client.query(
                'INSERT INTO retro_card_votes (card_id, user_name) VALUES ($1, $2)',
                [cardId, userName]
            )
        }
    } catch (error) {
        console.error('Error toggling retro card vote:', error)
        throw error
    } finally {
        client.release()
    }
}

export const verifyRetroBoardPassword = async (boardId, password) => {
    const client = await pool.connect()
    try {
        const result = await client.query(
            'SELECT password FROM retro_boards WHERE id = $1',
            [boardId]
        )

        if (result.rows.length === 0) {
            return false
        }

        const board = result.rows[0]
        if (!board.password) {
            return true
        }

        return await bcrypt.compare(password, board.password)
    } catch (error) {
        console.error('Error verifying retro board password:', error)
        throw error
    } finally {
        client.release()
    }
}

export const updateRetroBoardSettings = async (boardId, settings) => {
    const client = await pool.connect()
    try {
        const updates = []
        const values = []
        let paramCount = 1

        if (settings.defaultTimer !== undefined) {
            updates.push(`default_timer = $${paramCount}`)
            values.push(settings.defaultTimer)
            paramCount++
        }

        if (settings.hideCardsByDefault !== undefined) {
            updates.push(`hide_cards_by_default = $${paramCount}`)
            values.push(settings.hideCardsByDefault)
            paramCount++
        }

        if (settings.hideAuthorNames !== undefined) {
            updates.push(`hide_author_names = $${paramCount}`)
            values.push(settings.hideAuthorNames)
            paramCount++
        }

        if (settings.password !== undefined) {
            const hashedPassword = settings.password ? await bcrypt.hash(settings.password, 10) : null
            updates.push(`password = $${paramCount}`)
            values.push(hashedPassword)
            paramCount++
        }

        if (updates.length > 0) {
            values.push(boardId)
            await client.query(
                `UPDATE retro_boards SET ${updates.join(', ')} WHERE id = $${paramCount}`,
                values
            )
        }
    } catch (error) {
        console.error('Error updating retro board settings:', error)
        throw error
    } finally {
        client.release()
    }
}

export const startRetroTimer = async (boardId) => {
    const client = await pool.connect()
    try {
        // Get default timer value
        const result = await client.query(
            'SELECT default_timer FROM retro_boards WHERE id = $1',
            [boardId]
        )
        const defaultTimer = result.rows[0]?.default_timer || 300

        await client.query(
            'UPDATE retro_boards SET timer_running = true, time_left = $2 WHERE id = $1',
            [boardId, defaultTimer]
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

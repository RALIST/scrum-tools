import pool from './pool.js'

export const createRoom = async (roomId, name, sequence, password, workspaceId) => {
    const client = await pool.connect()
    try {
        await client.query(
            'INSERT INTO rooms (id, name, sequence, password, workspace_id) VALUES ($1, $2, $3, $4, $5)',
            [roomId, name || roomId, sequence, password, workspaceId || null]
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

export const getWorkspaceRooms = async (workspaceId) => {
    const client = await pool.connect()
    try {
        // First check if workspace_id column exists
        const checkColumn = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'rooms' AND column_name = 'workspace_id'
        `)
        
        if (checkColumn.rows.length === 0) {
            // Workspace column doesn't exist yet, return empty array
            console.log('workspace_id column does not exist in rooms table')
            return []
        }
        
        const roomsResult = await client.query(`
            SELECT r.*, COUNT(p.id) as participant_count
            FROM rooms r
            LEFT JOIN participants p ON r.id = p.room_id
            WHERE r.workspace_id = $1
            GROUP BY r.id
            ORDER BY r.created_at DESC
        `, [workspaceId])
        return roomsResult.rows
    } catch (error) {
        console.error('Error getting workspace rooms:', error)
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

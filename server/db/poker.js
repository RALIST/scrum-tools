import { executeQuery } from './dbUtils.js';
import logger from '../logger.js'; // Import the logger

export const createRoom = async (roomId, name, sequence, password, workspaceId) => {
    const queryText = 'INSERT INTO rooms (id, name, sequence, password, workspace_id) VALUES ($1, $2, $3, $4, $5)';
    const params = [roomId, name || roomId, sequence, password, workspaceId || null];
    await executeQuery(queryText, params);
};

export const getRooms = async () => {
    const queryText = `
        SELECT r.*, COUNT(p.id) as participant_count
        FROM rooms r
        LEFT JOIN participants p ON r.id = p.room_id
        WHERE r.workspace_id IS NULL -- Only select rooms not associated with a workspace
        GROUP BY r.id
        ORDER BY r.created_at DESC -- Optional: order public rooms
    `;
    const result = await executeQuery(queryText);
    return result.rows;
};

export const getWorkspaceRooms = async (workspaceId) => {
    // Assuming 'workspace_id' column exists after migration.
    const queryText = `
        SELECT r.*, COUNT(p.id) as participant_count
        FROM rooms r
        LEFT JOIN participants p ON r.id = p.room_id
        WHERE r.workspace_id = $1
        GROUP BY r.id
        ORDER BY r.created_at DESC
    `;
    const params = [workspaceId];
    const result = await executeQuery(queryText, params);
    return result.rows;
};

// New function to get basic room info (existence and password status)
export const getPokerRoomInfo = async (roomId) => {
    // Select only necessary fields: id and whether a password exists
    const queryText = 'SELECT id, password IS NOT NULL as "hasPassword" FROM rooms WHERE id = $1';
    const params = [roomId];
    const result = await executeQuery(queryText, params);
    // Return the first row found, or null if no room matches the ID
    return result.rows.length > 0 ? result.rows[0] : null;
};


export const getRoom = async (roomId) => {
    const roomQuery = 'SELECT * FROM rooms WHERE id = $1';
    const roomResult = await executeQuery(roomQuery, [roomId]);

    if (roomResult.rows.length === 0) {
        return null;
    }

    const participantsQuery = 'SELECT * FROM participants WHERE room_id = $1';
    const participantsResult = await executeQuery(participantsQuery, [roomId]);

    const roomData = roomResult.rows[0];
    let parsedSequence = roomData.sequence; // Default to raw value

    // Attempt to parse if it looks like a non-empty Postgres array string: "{...}"
    if (typeof parsedSequence === 'string' && parsedSequence.startsWith('{') && parsedSequence.endsWith('}') && parsedSequence.length > 2) {
        try {
            // Remove braces, split by comma, and remove surrounding quotes from each element
            parsedSequence = parsedSequence.substring(1, parsedSequence.length - 1)
                .split(',')
                .map(item => item.trim().replace(/^"|"$/g, '')); // Remove leading/trailing quotes
        } catch (e) {
            logger.error(`Failed to parse poker room sequence string: ${roomData.sequence}`, e);
            parsedSequence = null; // Fallback on error
        }
    } else if (parsedSequence === '{}') { // Handle empty array string
         parsedSequence = [];
    } else if (parsedSequence === null || parsedSequence === undefined) {
         parsedSequence = null; // Or default to an empty array: []
    }
    // If it's already an array (e.g., if DB driver handles it), or not a string, keep as is unless null/undefined

    return {
        ...roomData,
        sequence: parsedSequence, // Use the parsed sequence
        participants: new Map(participantsResult.rows.map(p => [p.id, {
            id: p.id,
            name: p.name,
            vote: p.vote
        }]))
    };
};

export const addParticipant = async (roomId, participantId, name) => {
    const queryText = 'INSERT INTO participants (id, room_id, name) VALUES ($1, $2, $3)';
    const params = [participantId, roomId, name];
    await executeQuery(queryText, params);
};

export const updateParticipantName = async (roomId, participantId, name) => {
    const queryText = 'UPDATE participants SET name = $1 WHERE room_id = $2 AND id = $3';
    const params = [name, roomId, participantId];
    await executeQuery(queryText, params);
};

export const updateParticipantVote = async (roomId, participantId, vote) => {
    const queryText = 'UPDATE participants SET vote = $1 WHERE room_id = $2 AND id = $3';
    const params = [vote, roomId, participantId];
    await executeQuery(queryText, params);
};

export const removeParticipant = async (roomId, participantId) => {
    const queryText = 'DELETE FROM participants WHERE room_id = $1 AND id = $2';
    const params = [roomId, participantId];
    await executeQuery(queryText, params);
};

export const resetVotes = async (roomId) => {
    const queryText = 'UPDATE participants SET vote = NULL WHERE room_id = $1';
    const params = [roomId];
    await executeQuery(queryText, params);
};

export const updateRoomSettings = async (roomId, sequence, password) => {
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (sequence !== undefined) {
        updates.push(`sequence = $${paramCount}`);
        values.push(sequence);
        paramCount++;
    }

    if (password !== undefined) {
        updates.push(`password = $${paramCount}`);
        values.push(password);
        paramCount++;
    }

    if (updates.length > 0) {
        values.push(roomId);
        const queryText = `UPDATE rooms SET ${updates.join(', ')} WHERE id = $${paramCount}`;
        await executeQuery(queryText, values);
    }
};

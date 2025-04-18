import { QueryResult } from 'pg'; // Import QueryResult type
import { executeQuery } from './dbUtils.js'; // Import executeQuery directly (needs .js extension)
import { PokerRoom, PokerParticipant, PokerRoomDetails } from '../types/db.js'; // Import types (needs .js extension)

export const createRoom = async (
    roomId: string,
    name: string | undefined,
    sequence: string, // Changed back to string (key)
    password?: string | null,
    workspaceId?: string | null
): Promise<void> => {
    const queryText = 'INSERT INTO rooms (id, name, sequence, password, workspace_id) VALUES ($1, $2, $3, $4, $5)';
    // Pass sequence string directly
    const params = [roomId, name || roomId, sequence, password, workspaceId || null];
    await executeQuery(queryText, params); // Use imported executeQuery
};

export const getRooms = async (): Promise<PokerRoom[]> => {
    const queryText = `
        SELECT r.*, COUNT(p.id) as participant_count
        FROM rooms r
        LEFT JOIN participants p ON r.id = p.room_id
        WHERE r.workspace_id IS NULL -- Only select rooms not associated with a workspace
        GROUP BY r.id
        ORDER BY r.created_at DESC -- Optional: order public rooms
    `;
    const result: QueryResult<PokerRoom> = await executeQuery(queryText); // Use imported executeQuery
    // Assuming PokerRoom type expects sequence as string from DB
    return result.rows;
};

export const getWorkspaceRooms = async (workspaceId: string): Promise<PokerRoom[]> => {
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
    const result: QueryResult<PokerRoom> = await executeQuery(queryText, params); // Use imported executeQuery
    // Assuming PokerRoom type expects sequence as string from DB
    return result.rows;
};

// New function to get basic room info (existence and password status)
export const getPokerRoomInfo = async (roomId: string): Promise<{ id: string; hasPassword: boolean } | null> => {
    // Select only necessary fields: id and whether a password exists
    const queryText = 'SELECT id, password IS NOT NULL as "hasPassword" FROM rooms WHERE id = $1';
    const params = [roomId];
    const result: QueryResult<{ id: string; hasPassword: boolean }> = await executeQuery(queryText, params); // Use imported executeQuery
    // Return the first row found, or null if no room matches the ID
    return result.rows.length > 0 ? result.rows[0] : null;
};


export const getRoom = async (roomId: string): Promise<PokerRoomDetails | null> => {
    const roomQuery = 'SELECT * FROM rooms WHERE id = $1';
    const roomResult: QueryResult<PokerRoom> = await executeQuery(roomQuery, [roomId]); // Use imported executeQuery

    if (roomResult.rows.length === 0) {
        return null;
    }

    const participantsQuery = 'SELECT * FROM participants WHERE room_id = $1';
    const participantsResult: QueryResult<PokerParticipant> = await executeQuery(participantsQuery, [roomId]); // Use imported executeQuery

    const roomData: PokerRoom = roomResult.rows[0];

    // Removed parsing logic. Assume roomData.sequence is the string key.
    // The PokerRoomDetails type will need adjustment in types/db.ts

    return {
        ...roomData,
        // sequence: roomData.sequence, // sequence is already part of roomData
        participants: new Map(participantsResult.rows.map((p: PokerParticipant) => [p.id, {
            id: p.id,
            name: p.name,
            vote: p.vote
        }]))
    };
};

export const addParticipant = async (roomId: string, participantId: string, name: string): Promise<void> => {
    const queryText = 'INSERT INTO participants (id, room_id, name) VALUES ($1, $2, $3)';
    const params = [participantId, roomId, name];
    await executeQuery(queryText, params); // Use imported executeQuery
};

export const updateParticipantName = async (roomId: string, participantId: string, name: string): Promise<void> => {
    const queryText = 'UPDATE participants SET name = $1 WHERE room_id = $2 AND id = $3';
    const params = [name, roomId, participantId];
    const result = await executeQuery(queryText, params); // Use imported executeQuery
    if ((result.rowCount ?? 0) === 0) {
        // Optionally, you could check if the room exists first for a more specific error
        throw new Error(`Participant ${participantId} not found in room ${roomId} or name unchanged.`);
    }
};

export const updateParticipantVote = async (roomId: string, participantId: string, vote: string | null): Promise<void> => {
    const queryText = 'UPDATE participants SET vote = $1 WHERE room_id = $2 AND id = $3';
    const params = [vote, roomId, participantId];
    const result = await executeQuery(queryText, params); // Use imported executeQuery
    if ((result.rowCount ?? 0) === 0) {
        throw new Error(`Participant ${participantId} not found in room ${roomId} or vote unchanged.`);
    }
};

export const removeParticipant = async (roomId: string, participantId: string): Promise<void> => {
    const queryText = 'DELETE FROM participants WHERE room_id = $1 AND id = $2';
    const params = [roomId, participantId];
    await executeQuery(queryText, params); // Use imported executeQuery
};

export const resetVotes = async (roomId: string): Promise<void> => {
    const queryText = 'UPDATE participants SET vote = NULL WHERE room_id = $1';
    const params = [roomId];
    const result = await executeQuery(queryText, params); // Use imported executeQuery
    // Note: This will throw even if the room exists but has no participants,
    // which might be desired or might need adjustment depending on exact requirements.
    if ((result.rowCount ?? 0) === 0) {
        throw new Error(`Room ${roomId} not found or no votes to reset.`);
    }
};

export const updateRoomSettings = async (
    roomId: string,
    sequence?: string, // Changed back to string (key)
    password?: string | null // Password is optional
): Promise<void> => {

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (sequence !== undefined) {
        updates.push(`sequence = $${paramCount}`);
        values.push(sequence); // Push the string key
        paramCount++;
    }

    if (password !== undefined) {
        updates.push(`password = $${paramCount}`);
        values.push(password); // Password should be hashed *before* calling this function
        paramCount++;
    }

    if (updates.length > 0) {
        values.push(roomId);
        const queryText = `UPDATE rooms SET ${updates.join(', ')} WHERE id = $${paramCount}`;
        await executeQuery(queryText, values); // Use imported executeQuery
    }
};

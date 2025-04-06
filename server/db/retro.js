import { dbUtils } from './dbUtils.js'; // Import the dbUtils object
import bcrypt from 'bcryptjs';
import logger from '../logger.js'; // Import the logger

export const createRetroBoard = async (boardId, name, workspaceId, settings = {}) => {
    const {
        defaultTimer = 300,
        hideCardsByDefault = false,
        hideAuthorNames = false,
        password
    } = settings;

    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    const queryText = `
        INSERT INTO retro_boards (
            id, name, timer_running, time_left, default_timer, 
            hide_cards_by_default, hide_author_names, password, workspace_id
        ) VALUES ($1, $2, false, $3, $4, $5, $6, $7, $8)
    `;
    // Use defaultTimer for time_left ($3) and the actual value from settings for default_timer ($4)
    const timerValueToInsert = settings.defaultTimer !== undefined ? settings.defaultTimer : 300;
    const params = [
        boardId, name || boardId, timerValueToInsert, timerValueToInsert, 
        hideCardsByDefault, hideAuthorNames, hashedPassword, workspaceId || null
    ];
    await dbUtils.executeQuery(queryText, params); // Use dbUtils.executeQuery
};

export const getRetroBoard = async (boardId) => {
    const boardQuery = 'SELECT * FROM retro_boards WHERE id = $1';
    const boardResult = await dbUtils.executeQuery(boardQuery, [boardId]); // Use dbUtils.executeQuery

    if (boardResult.rows.length === 0) {
        return null;
    }

    const cardsQuery = `
        SELECT c.*, COALESCE(json_agg(v.user_name) FILTER (WHERE v.user_name IS NOT NULL), '[]') as votes
        FROM retro_cards c
        LEFT JOIN retro_card_votes v ON c.id = v.card_id
        WHERE c.board_id = $1
        GROUP BY c.id
        ORDER BY c.created_at ASC
    `;
    const cardsResult = await dbUtils.executeQuery(cardsQuery, [boardId]); // Use dbUtils.executeQuery

    const board = boardResult.rows[0];
    // Ensure hasPassword reflects the presence of a password hash
    const hasPassword = !!board.password; 
    return {
        ...board,
        // Explicitly remove the password hash before returning
        password: undefined, 
        hasPassword: hasPassword, // Use the calculated value
        cards: cardsResult.rows.map(card => ({
            ...card,
            votes: card.votes || []
        }))
    };
};

export const getWorkspaceRetroBoards = async (workspaceId) => {
    // Assuming 'workspace_id' column exists after migration.
    const boardsQuery = `
        SELECT rb.*, 
            COUNT(rc.id) as card_count 
        FROM retro_boards rb
        LEFT JOIN retro_cards rc ON rb.id = rc.board_id
        WHERE rb.workspace_id = $1
        GROUP BY rb.id
        ORDER BY rb.created_at DESC
    `;
    const boardsResult = await dbUtils.executeQuery(boardsQuery, [workspaceId]); // Use dbUtils.executeQuery

    return boardsResult.rows.map(board => ({
        ...board,
        hasPassword: !!board.password,
        password: undefined // Don't send password hash to client
    }));
};

export const addRetroCard = async (boardId, cardId, columnId, text, authorName) => {
    const queryText = 'INSERT INTO retro_cards (id, board_id, column_id, text, author_name) VALUES ($1, $2, $3, $4, $5)';
    const params = [cardId, boardId, columnId, text, authorName];
    await dbUtils.executeQuery(queryText, params); // Use dbUtils.executeQuery
};

export const updateRetroCardText = async (cardId, text) => {
    const queryText = 'UPDATE retro_cards SET text = $2 WHERE id = $1';
    const params = [cardId, text];
    await dbUtils.executeQuery(queryText, params); // Use dbUtils.executeQuery
};

export const updateRetroCardAuthor = async (cardId, authorName) => {
    const queryText = 'UPDATE retro_cards SET author_name = $2 WHERE id = $1';
    const params = [cardId, authorName];
    await dbUtils.executeQuery(queryText, params); // Use dbUtils.executeQuery
};

export const deleteRetroCard = async (cardId) => {
    const queryText = 'DELETE FROM retro_cards WHERE id = $1';
    const params = [cardId];
    await dbUtils.executeQuery(queryText, params); // Use dbUtils.executeQuery
};

export const toggleRetroCardVote = async (cardId, userName) => {
    // Check if vote exists using the new primary key (card_id, user_name)
    const checkVoteQuery = 'SELECT 1 FROM retro_card_votes WHERE card_id = $1 AND user_name = $2';
    const voteResult = await dbUtils.executeQuery(checkVoteQuery, [cardId, userName]); // Use dbUtils.executeQuery

    if (voteResult.rows.length > 0) {
        // Remove vote using the new primary key
        const deleteVoteQuery = 'DELETE FROM retro_card_votes WHERE card_id = $1 AND user_name = $2';
        await dbUtils.executeQuery(deleteVoteQuery, [cardId, userName]); // Use dbUtils.executeQuery
    } else {
        // Add vote using only card_id and user_name
        const addVoteQuery = 'INSERT INTO retro_card_votes (card_id, user_name) VALUES ($1, $2)';
        await dbUtils.executeQuery(addVoteQuery, [cardId, userName]); // Use dbUtils.executeQuery
    }
};

export const verifyRetroBoardPassword = async (boardId, password) => {
    const queryText = 'SELECT password FROM retro_boards WHERE id = $1';
    const result = await dbUtils.executeQuery(queryText, [boardId]); // Use dbUtils.executeQuery

    if (result.rows.length === 0) {
        return false; // Board not found
    }

    const board = result.rows[0];
    if (!board.password) {
        return true; // No password set
    }

    return await bcrypt.compare(password, board.password);
};

export const updateRetroBoardSettings = async (boardId, settings) => {
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (settings.defaultTimer !== undefined) {
        updates.push(`default_timer = $${paramCount}`);
        values.push(settings.defaultTimer);
        paramCount++;
    }

    if (settings.hideCardsByDefault !== undefined) {
        updates.push(`hide_cards_by_default = $${paramCount}`);
        values.push(settings.hideCardsByDefault);
        paramCount++;
    }

    if (settings.hideAuthorNames !== undefined) {
        updates.push(`hide_author_names = $${paramCount}`);
        values.push(settings.hideAuthorNames);
        paramCount++;
    }

    if (settings.password !== undefined) {
        const hashedPassword = settings.password ? await bcrypt.hash(settings.password, 10) : null;
        updates.push(`password = $${paramCount}`);
        values.push(hashedPassword);
        paramCount++;
    }

    if (updates.length > 0) {
        values.push(boardId);
        const queryText = `UPDATE retro_boards SET ${updates.join(', ')} WHERE id = $${paramCount}`;
        await dbUtils.executeQuery(queryText, values); // Use dbUtils.executeQuery
    }
};

export const startRetroTimer = async (boardId) => {
    // Consider passing defaultTimer if already available in the calling context
    const getTimerQuery = 'SELECT default_timer FROM retro_boards WHERE id = $1';
    const result = await dbUtils.executeQuery(getTimerQuery, [boardId]); // Use dbUtils.executeQuery
    const defaultTimer = result.rows[0]?.default_timer || 300;

    const updateQuery = 'UPDATE retro_boards SET timer_running = true, time_left = $2 WHERE id = $1';
    await dbUtils.executeQuery(updateQuery, [boardId, defaultTimer]); // Use dbUtils.executeQuery
};

export const stopRetroTimer = async (boardId) => {
    const queryText = 'UPDATE retro_boards SET timer_running = false WHERE id = $1';
    await dbUtils.executeQuery(queryText, [boardId]); // Use dbUtils.executeQuery
};

export const updateRetroTimer = async (boardId, timeLeft) => {
    const queryText = 'UPDATE retro_boards SET time_left = $2 WHERE id = $1';
    await dbUtils.executeQuery(queryText, [boardId, timeLeft]); // Use dbUtils.executeQuery
};

import bcrypt from 'bcryptjs';
import { QueryResult } from 'pg'; // Import QueryResult type
import { executeQuery } from './dbUtils.js'; // Needs .js extension
import { RetroBoard, RetroCard, RetroBoardDetails, RetroBoardSettings } from '../types/db.js'; // Needs .js extension

export const createRetroBoard = async (
    boardId: string,
    name: string | undefined,
    workspaceId: string | null | undefined,
    settings: RetroBoardSettings = {}
): Promise<void> => {
    const {
        defaultTimer = 300,
        hideCardsByDefault = false,
        hideAuthorNames = false,
        password
    } = settings; // Types for these are inferred from RetroBoardSettings

    const hashedPassword: string | null = password ? await bcrypt.hash(password, 10) : null;

    const queryText = `
        INSERT INTO retro_boards (
            id, name, timer_running, time_left, default_timer, 
            hide_cards_by_default, hide_author_names, password, workspace_id
        ) VALUES ($1, $2, false, $3, $4, $5, $6, $7, $8)
    `;
    // Use defaultTimer for time_left ($3) and the actual value from settings for default_timer ($4)
    const timerValueToInsert: number = settings.defaultTimer !== undefined ? settings.defaultTimer : 300;
    const params = [
        boardId, name || boardId, timerValueToInsert, timerValueToInsert, 
        hideCardsByDefault, hideAuthorNames, hashedPassword, workspaceId || null
    ];
    await executeQuery(queryText, params); // Use executeQuery
};

export const getRetroBoard = async (boardId: string): Promise<RetroBoardDetails | null> => {
    const boardQuery = 'SELECT * FROM retro_boards WHERE id = $1';
    const boardResult: QueryResult<RetroBoard> = await executeQuery(boardQuery, [boardId]); // Use executeQuery

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
    // Type for cardsResult needs to account for the aggregated 'votes' column
    const cardsResult: QueryResult<RetroCard & { votes: string[] }> = await executeQuery(cardsQuery, [boardId]); // Use executeQuery

    const board: RetroBoard = boardResult.rows[0];
    // Ensure hasPassword reflects the presence of a password hash
    const hasPassword = !!board.password;
    // Destructure to exclude password from the returned object
    const { password: _password, ...boardDetails } = board;

    return {
        ...boardDetails, // Spread properties except password
        hasPassword: hasPassword, // Add the calculated hasPassword flag
        // Map cards, ensuring votes is always an array
        cards: cardsResult.rows.map((card: RetroCard & { votes: string[] }) => ({
            ...card,
            votes: Array.isArray(card.votes) ? card.votes : [] // Ensure votes is an array
        })) as RetroCard[] // Assert final type after mapping
    };
};

export const getWorkspaceRetroBoards = async (workspaceId: string): Promise<RetroBoard[]> => {
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
    // Type needs to account for aggregated 'card_count'
    const boardsResult: QueryResult<RetroBoard & { card_count: string | number }> = await executeQuery(boardsQuery, [workspaceId]); // Use executeQuery

    return boardsResult.rows.map((board: RetroBoard & { card_count: string | number }) => ({
        ...board,
        card_count: typeof board.card_count === 'string' ? parseInt(board.card_count, 10) : board.card_count, // Ensure count is number
        hasPassword: !!board.password,
        password: undefined // Don't send password hash to client
    }));
};

export const addRetroCard = async (
    boardId: string,
    cardId: string,
    columnId: string,
    text: string,
    authorName: string
): Promise<void> => {
    const queryText = 'INSERT INTO retro_cards (id, board_id, column_id, text, author_name) VALUES ($1, $2, $3, $4, $5)';
    const params = [cardId, boardId, columnId, text, authorName];
    await executeQuery(queryText, params); // Use executeQuery
};

export const updateRetroCardText = async (cardId: string, text: string): Promise<void> => {
    const queryText = 'UPDATE retro_cards SET text = $2 WHERE id = $1';
    const params = [cardId, text];
    await executeQuery(queryText, params); // Use executeQuery
};

export const updateRetroCardAuthor = async (cardId: string, authorName: string): Promise<void> => {
    const queryText = 'UPDATE retro_cards SET author_name = $2 WHERE id = $1';
    const params = [cardId, authorName];
    await executeQuery(queryText, params); // Use executeQuery
};

export const deleteRetroCard = async (cardId: string): Promise<void> => {
    const queryText = 'DELETE FROM retro_cards WHERE id = $1';
    const params = [cardId];
    await executeQuery(queryText, params); // Use executeQuery
};

export const toggleRetroCardVote = async (cardId: string, userName: string): Promise<void> => {
    // Check if vote exists using the new primary key (card_id, user_name)
    const checkVoteQuery = 'SELECT 1 FROM retro_card_votes WHERE card_id = $1 AND user_name = $2';
    const voteResult: QueryResult<{ '1': number }> = await executeQuery(checkVoteQuery, [cardId, userName]); // Use executeQuery

    if (voteResult.rows.length > 0) {
        // Remove vote using the new primary key
        const deleteVoteQuery = 'DELETE FROM retro_card_votes WHERE card_id = $1 AND user_name = $2';
        await executeQuery(deleteVoteQuery, [cardId, userName]); // Use executeQuery
    } else {
        // Add vote using only card_id and user_name
        const addVoteQuery = 'INSERT INTO retro_card_votes (card_id, user_name) VALUES ($1, $2)';
        await executeQuery(addVoteQuery, [cardId, userName]); // Use executeQuery
    }
};

export const verifyRetroBoardPassword = async (boardId: string, password?: string | null): Promise<boolean> => {
    const queryText = 'SELECT password FROM retro_boards WHERE id = $1';
    const result: QueryResult<{ password?: string | null }> = await executeQuery(queryText, [boardId]); // Use executeQuery

    if (result.rows.length === 0) {
        return false; // Board not found
    }

    const board = result.rows[0]; // Type inferred
    if (!board.password) {
        // If no password is set on board, allow access only if no password was provided for verification
        return !password;
    }

    // If a password was provided for verification, compare it
    return password ? await bcrypt.compare(password, board.password) : false;
};

export const updateRetroBoardSettings = async (boardId: string, settings: RetroBoardSettings): Promise<void> => {
    const updates: string[] = [];
    const values: any[] = [];
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
        const hashedPassword: string | null = settings.password ? await bcrypt.hash(settings.password, 10) : null;
        updates.push(`password = $${paramCount}`);
        values.push(hashedPassword);
        paramCount++;
    }

    if (updates.length > 0) {
        values.push(boardId);
        const queryText = `UPDATE retro_boards SET ${updates.join(', ')} WHERE id = $${paramCount}`;
        await executeQuery(queryText, values); // Use executeQuery
    }
};

export const startRetroTimer = async (boardId: string): Promise<void> => {
    // Consider passing defaultTimer if already available in the calling context
    const getTimerQuery = 'SELECT default_timer FROM retro_boards WHERE id = $1';
    const result: QueryResult<{ default_timer: number }> = await executeQuery(getTimerQuery, [boardId]); // Use executeQuery
    const defaultTimer: number = result.rows[0]?.default_timer || 300;

    const updateQuery = 'UPDATE retro_boards SET timer_running = true, time_left = $2 WHERE id = $1';
    await executeQuery(updateQuery, [boardId, defaultTimer]); // Use executeQuery
};

export const stopRetroTimer = async (boardId: string): Promise<void> => {
    const queryText = 'UPDATE retro_boards SET timer_running = false WHERE id = $1';
    await executeQuery(queryText, [boardId]); // Use executeQuery
};

export const updateRetroTimer = async (boardId: string, timeLeft: number): Promise<void> => {
    const queryText = 'UPDATE retro_boards SET time_left = $2 WHERE id = $1';
    await executeQuery(queryText, [boardId, timeLeft]); // Use executeQuery
};

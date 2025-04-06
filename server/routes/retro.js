import express from 'express'
import {
    createRetroBoard,
    getRetroBoard,
    verifyRetroBoardPassword,
    updateRetroBoardSettings
} from '../db/retro.js'

const router = express.Router()

const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
};

// Add 'next'
router.post('/', async (req, res, next) => {
    const boardId = Math.random().toString(36).substring(2, 8);
    // Correctly extract settings from req.body.settings
    const { name, settings = {}, workspaceId } = req.body;
    // const { // Destructure from settings object
    //     defaultTimer,
    //     hideCardsByDefault,
    //     hideAuthorNames,
    //     password
    // } = settings;

    const defaultName = `Retro ${formatDate(new Date())}`;

    try {
        // Pass the whole settings object directly to createRetroBoard
        await createRetroBoard(boardId, name || defaultName, workspaceId, settings);

        res.json({ success: true, boardId });
    } catch (error) {
        console.error('Error creating retro board:', error);
        // Pass error to the centralized handler
        next(error);
    }
});

// Add 'next'
router.get('/:boardId', async (req, res, next) => {
    const { boardId } = req.params;

    try {
        const board = await getRetroBoard(boardId);
        if (!board) {
            // Keep specific client error handling here
            return res.status(404).json({ error: 'Board not found' });
        }
        res.json(board);
    } catch (error) {
        console.error('Error getting retro board:', error);
        // Pass error to the centralized handler
        next(error);
    }
});

// Add 'next'
router.post('/:boardId/verify-password', async (req, res, next) => {
    const { boardId } = req.params;
    const { password } = req.body;

    try {
        // Note: verifyRetroBoardPassword itself doesn't throw for invalid password,
        // it returns false. The catch block here is for unexpected errors (e.g., DB connection).
        const isValid = await verifyRetroBoardPassword(boardId, password);
        res.json({ valid: isValid });
    } catch (error) {
        console.error('Error verifying retro board password:', error);
        // Pass error to the centralized handler
        next(error);
    }
});

// Add 'next'
router.put('/:boardId/settings', async (req, res, next) => {
    const { boardId } = req.params;
    const {
        defaultTimer,
        hideCardsByDefault,
        hideAuthorNames,
        password
    } = req.body

    try {
        // --- FIX START: Check if board exists first ---
        const existingBoard = await getRetroBoard(boardId);
        if (!existingBoard) {
            return res.status(404).json({ error: 'Board not found' });
        }
        // --- FIX END ---

        await updateRetroBoardSettings(boardId, {
            defaultTimer,
            hideCardsByDefault,
            hideAuthorNames,
            password
        })
        // Fetch the updated board to return the latest state
        const updatedBoard = await getRetroBoard(boardId)
        res.json(updatedBoard); // Return the updated board
    } catch (error) {
        console.error('Error updating retro board settings:', error);
        // Pass error to the centralized handler
        next(error);
    }
});

export default router

import express from 'express';
// Removed direct DB imports:
// import {
//     createRetroBoard,
//     getRetroBoard,
//     verifyRetroBoardPassword,
//     updateRetroBoardSettings
// } from '../db/retro.js';

const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
};

// Wrap routes in a setup function that accepts db dependency
export default function setupRetroRoutes(retroDb, workspaceDb) { // Add workspaceDb dependency
    const router = express.Router();

    // POST /
    router.post('/', async (req, res, next) => {
        const boardId = Math.random().toString(36).substring(2, 8);
        const { name, settings = {}, workspaceId } = req.body;
        const defaultName = `Retro ${formatDate(new Date())}`;

        const userId = req.user?.userId; // Get userId from auth middleware
        try {
            // If workspaceId is provided, ensure the user is authenticated and a member
            if (workspaceId) {
                if (!userId) {
                    // console.error(`Anonymous user attempted to create a retro board in workspace ${workspaceId}.`);
                    return res.status(401).json({ error: 'Authentication required to create a workspace retro board.' });
                }
                const isMember = await workspaceDb.isWorkspaceMember(workspaceId, userId);
                if (!isMember) {
                    // console.error(`User ${userId} attempted to create a retro board in workspace ${workspaceId} without membership.`);
                    return res.status(403).json({ error: 'User is not authorized to create a retro board in this workspace.' });
                }
            }
            // Use injected dependency
            await retroDb.createRetroBoard(boardId, name || defaultName, workspaceId, settings);
            res.json({ success: true, boardId });
        } catch (error) {
            console.error('Error creating retro board:', error);
            next(error);
        }
    });

    // GET /:boardId
    router.get('/:boardId', async (req, res, next) => {
        const { boardId } = req.params;

        const userId = req.user?.userId; // Get userId from auth middleware
        try {
            // Use injected dependency
            const board = await retroDb.getRetroBoard(boardId);
            if (!board) {
                return res.status(404).json({ error: 'Board not found' });
            }

            // If the board belongs to a workspace, verify membership
            if (board.workspace_id) {
                if (!userId) {
                    // console.error(`Anonymous user attempted to access retro board ${boardId} in workspace ${board.workspace_id}.`);
                    return res.status(401).json({ error: 'Authentication required to access this retro board.' });
                }
                const isMember = await workspaceDb.isWorkspaceMember(board.workspace_id, userId);
                if (!isMember) {
                    // console.error(`User ${userId} attempted to access retro board ${boardId} in workspace ${board.workspace_id} without membership.`);
                    return res.status(403).json({ error: 'User is not authorized to access this retro board.' });
                }
            }
            // Allow access if board is public or user is a member
            res.json(board);
        } catch (error) {
            console.error('Error getting retro board:', error);
            next(error);
        }
    });

    // POST /:boardId/verify-password
    router.post('/:boardId/verify-password', async (req, res, next) => {
        const { boardId } = req.params;
        const { password } = req.body;

        try {
            // Use injected dependency
            const isValid = await retroDb.verifyRetroBoardPassword(boardId, password);
            res.json({ valid: isValid });
        } catch (error) {
            console.error('Error verifying retro board password:', error);
            next(error);
        }
    });

    // PUT /:boardId/settings
    router.put('/:boardId/settings', async (req, res, next) => {
        const { boardId } = req.params;
        const {
            defaultTimer,
            hideCardsByDefault,
            hideAuthorNames,
            password
        } = req.body;

        const userId = req.user?.userId; // Get userId from auth middleware
        try {
            // Use injected dependency for both checks and updates
            const existingBoard = await retroDb.getRetroBoard(boardId);
            if (!existingBoard) {
                return res.status(404).json({ error: 'Board not found' });
            }

            // If the board belongs to a workspace, verify membership before allowing settings update
            if (existingBoard.workspace_id) {
                 if (!userId) {
                    // console.error(`Anonymous user attempted to update settings for retro board ${boardId} in workspace ${existingBoard.workspace_id}.`);
                    return res.status(401).json({ error: 'Authentication required to update settings for this retro board.' });
                }
                const isMember = await workspaceDb.isWorkspaceMember(existingBoard.workspace_id, userId);
                if (!isMember) {
                    // console.error(`User ${userId} attempted to update settings for retro board ${boardId} in workspace ${existingBoard.workspace_id} without membership.`);
                    return res.status(403).json({ error: 'User is not authorized to update settings for this retro board.' });
                }
            }

            await retroDb.updateRetroBoardSettings(boardId, {
                defaultTimer,
                hideCardsByDefault,
                hideAuthorNames,
                password
            });
            // Fetch the updated board to return the latest state
            const updatedBoard = await retroDb.getRetroBoard(boardId);
            res.json(updatedBoard);
        } catch (error) {
            console.error('Error updating retro board settings:', error);
            next(error);
        }
    });

    return router; // Return the configured router
}

// Removed default export of router instance

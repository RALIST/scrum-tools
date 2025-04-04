import express from 'express';
import bcrypt from 'bcryptjs';
import { createRoom, getRooms, getRoom, getWorkspaceRooms } from '../db/poker.js'; // Import getWorkspaceRooms
import logger from '../logger.js'; // Import logger

const router = express.Router();

// Get rooms - Filtered by workspace if authenticated and header provided, otherwise public rooms
// optionalAuthenticateToken is applied globally in server/index.js
router.get('/rooms', async (req, res, next) => { // Removed redundant authenticateToken(true)
    try {
        // req.user might be populated by the global optionalAuthenticateToken middleware
        const userId = req.user?.userId;
        const workspaceId = req.headers['workspace-id'];
        let rooms = [];

        // Workspace Mode
        if (userId && workspaceId) {
            logger.info(`Fetching poker rooms for workspace: ${workspaceId}, user: ${userId}`);
            // Optional: Verify user access to workspace if needed, though usually listing might be allowed if they know the ID
            // const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
            // if (!hasAccess) {
            //     logger.warn(`User ${userId} attempted to list rooms for workspace ${workspaceId} without permission.`);
            //     return res.status(403).json({ error: 'Forbidden: Access denied to this workspace' });
            // }
            rooms = await getWorkspaceRooms(workspaceId);
            logger.info(`Found ${rooms.length} rooms for workspace ${workspaceId}`);
        }
        // Public/Anonymous Mode
        else {
            logger.info('Fetching public poker rooms');
            rooms = await getRooms(); // getRooms should ideally filter out workspace-specific rooms
            // TODO: Modify getRooms in db/poker.js to select only rooms WHERE workspace_id IS NULL
            logger.info(`Found ${rooms.length} public rooms`);
        }

        const roomList = rooms.map(room => ({
            id: room.id,
            name: room.name,
            // Ensure participant_count is treated as a number
            participantCount: parseInt(room.participant_count || '0', 10),
            createdAt: room.created_at,
            hasPassword: !!room.password,
            sequence: room.sequence,
            workspaceId: room.workspace_id // Include workspaceId if needed by client
        }));
        res.json(roomList);
    } catch (error) {
        logger.error('Error getting rooms:', { error: error.message, stack: error.stack, userId: req.user?.userId, workspaceId: req.headers['workspace-id'] });
        // Pass error to the centralized handler
        next(error);
    }
});

// Add 'next' to the parameters
router.post('/rooms', async (req, res, next) => {
    const { roomId, name, password, sequence, workspaceId } = req.body;
    try {
        const room = await getRoom(roomId);
        if (room) {
            // Keep specific client error handling here
            return res.status(400).json({ error: 'Room already exists' });
        }

        const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
        await createRoom(roomId, name, sequence, hashedPassword, workspaceId);

        res.json({
            success: true,
            roomId,
            hasPassword: !!hashedPassword,
            sequence: sequence || 'fibonacci',
        });
    } catch (error) {
        console.error('Error creating room:', error);
        // Pass error to the centralized handler
        next(error);
    }
});

// Add 'next' to the parameters
router.post('/rooms/:roomId/verify-password', async (req, res, next) => {
    const { roomId } = req.params;
    const { password } = req.body;

    try {
        const room = await getRoom(roomId);
        if (!room) {
            // Keep specific client error handling here
            return res.status(404).json({ error: 'Room not found' });
        }

        if (!room.password) {
            // This is a normal flow, not an error
            return res.json({ valid: true });
        }

        const isValid = await bcrypt.compare(password, room.password);
        res.json({ valid: isValid });
    } catch (error) {
        console.error('Error verifying password:', error);
        // Pass error to the centralized handler
        next(error);
    }
});

export default router

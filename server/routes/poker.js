import express from 'express';
import bcrypt from 'bcryptjs';
// Removed direct DB imports
// import { createRoom, getRooms, getRoom, getWorkspaceRooms, getPokerRoomInfo } from '../db/poker.js';
import logger from '../logger.js'; // Import logger

// Wrap routes in a setup function that accepts db dependency
export default function setupPokerRoutes(pokerDb) {
    const router = express.Router();

    // Get rooms - Filtered by workspace if authenticated and header provided, otherwise public rooms
    // optionalAuthenticateToken is applied globally in server/index.js
    router.get('/rooms', async (req, res, next) => {
        try {
            // req.user might be populated by the global optionalAuthenticateToken middleware
            const userId = req.user?.userId;
            const workspaceId = req.headers['workspace-id'];
            let rooms = [];

            // Workspace Mode
            if (userId && workspaceId) {
                logger.info(`Fetching poker rooms for workspace: ${workspaceId}, user: ${userId}`);
                // Use injected dependency
                rooms = await pokerDb.getWorkspaceRooms(workspaceId);
                logger.info(`Found ${rooms.length} rooms for workspace ${workspaceId}`);
            }
            // Public/Anonymous Mode
            else {
                logger.info('Fetching public poker rooms');
                // Use injected dependency
                rooms = await pokerDb.getRooms();
                logger.info(`Found ${rooms.length} public rooms`);
            }

            const roomList = rooms.map(room => ({
                id: room.id,
                name: room.name,
                participantCount: parseInt(room.participant_count || '0', 10),
                createdAt: room.created_at,
                hasPassword: !!room.password,
                sequence: room.sequence,
                workspaceId: room.workspace_id
            }));
            res.json(roomList);
        } catch (error) {
            logger.error('Error getting rooms:', { error: error.message, stack: error.stack, userId: req.user?.userId, workspaceId: req.headers['workspace-id'] });
            next(error);
        }
    });

    // Add 'next' to the parameters
    router.post('/rooms', async (req, res, next) => {
        const { roomId, name, password, sequence, workspaceId } = req.body;
        try {
            // Use injected dependency
            const room = await pokerDb.getRoom(roomId);
            if (room) {
                return res.status(400).json({ error: 'Room already exists' });
            }

            const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
            // Use injected dependency
            await pokerDb.createRoom(roomId, name, sequence, hashedPassword, workspaceId);

            res.json({
                success: true,
                roomId,
                hasPassword: !!hashedPassword,
                sequence: sequence || 'fibonacci',
            });
        } catch (error) {
            console.error('Error creating room:', error);
            next(error);
        }
    });

    // Add 'next' to the parameters
    router.post('/rooms/:roomId/verify-password', async (req, res, next) => {
        const { roomId } = req.params;
        const { password } = req.body;

        try {
            // Use injected dependency
            const room = await pokerDb.getRoom(roomId);
            if (!room) {
                return res.status(404).json({ error: 'Room not found' });
            }

            if (!room.password) {
                return res.json({ valid: true });
            }

            const isValid = await bcrypt.compare(password, room.password);
            res.json({ valid: isValid });
        } catch (error) {
            console.error('Error verifying password:', error);
            next(error);
        }
    });

    // New endpoint to get basic info for a specific room
    router.get('/rooms/:roomId/info', async (req, res, next) => {
        const { roomId } = req.params;
        logger.info(`Fetching info for poker room: ${roomId}`);
        try {
            // Use injected dependency
            const roomInfo = await pokerDb.getPokerRoomInfo(roomId);
            if (!roomInfo) {
                logger.warn(`Room info request failed: Room ${roomId} not found.`);
                return res.status(404).json({ error: 'Room not found' });
            }
            logger.info(`Found info for room ${roomId}:`, roomInfo);
            res.json(roomInfo);
        } catch (error) {
            logger.error(`Error fetching info for room ${roomId}:`, { error: error.message, stack: error.stack });
            next(error);
        }
    });

    return router; // Return the configured router
}

// Removed default export of router instance

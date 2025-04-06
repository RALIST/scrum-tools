import express from 'express';
import bcrypt from 'bcryptjs';

// Wrap routes in a setup function that accepts db dependency
export default function setupPokerRoutes(pokerDb, workspaceDb) { // Add workspaceDb dependency
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
                // Check if user is a member of the workspace
                const isMember = await workspaceDb.isWorkspaceMember(workspaceId, userId); // Removed pool
                if (!isMember) {
                    return res.status(403).json({ error: 'User is not authorized to access rooms for this workspace.' });
                }
                // Use injected dependency
                rooms = await pokerDb.getWorkspaceRooms(workspaceId);
            }
            // Public/Anonymous Mode
            else {
                // Use injected dependency
                rooms = await pokerDb.getRooms();
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
            next(error);
        }
    });

    // Add 'next' to the parameters
    router.post('/rooms', async (req, res, next) => {
        const { roomId, name, password, sequence, workspaceId } = req.body;
        const userId = req.user?.userId; // Get userId for workspace check
        try {
            // If workspaceId is provided, ensure the user is authenticated and a member
            if (workspaceId) {
                if (!userId) {
                    return res.status(401).json({ error: 'Authentication required to create a workspace room.' });
                }
                const isMember = await workspaceDb.isWorkspaceMember(workspaceId, userId); // Removed pool
                if (!isMember) {
                    return res.status(403).json({ error: 'User is not authorized to create a room in this workspace.' });
                }
            }

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
            next(error);
        }
    });

    // New endpoint to get basic info for a specific room
    router.get('/rooms/:roomId/info', async (req, res, next) => {
        const { roomId } = req.params;
        try {
            // Use injected dependency
            const roomInfo = await pokerDb.getPokerRoomInfo(roomId);
            if (!roomInfo) {
                return res.status(404).json({ error: 'Room not found' });
            }
            res.json(roomInfo);
        } catch (error) {
            next(error);
        }
    });

    return router; // Return the configured router
}

// Removed default export of router instance

import express from 'express'
import bcrypt from 'bcryptjs'
import { createRoom, getRooms, getRoom } from '../db/poker.js'

const router = express.Router();

// Add 'next' to the parameters
router.get('/rooms', async (req, res, next) => {
    try {
        const rooms = await getRooms();
        const roomList = rooms.map(room => ({
            id: room.id,
            name: room.name,
            participantCount: parseInt(room.participant_count),
            createdAt: room.created_at,
            hasPassword: !!room.password,
            sequence: room.sequence
        }))
        res.json(roomList);
    } catch (error) {
        console.error('Error getting rooms:', error);
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

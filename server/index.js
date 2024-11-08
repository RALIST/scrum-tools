import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import {
    createRoom,
    getRooms,
    getRoom,
    addParticipant,
    updateParticipantName,
    updateParticipantVote,
    removeParticipant,
    resetVotes,
    updateRoomSettings,
    createRetroBoard,
    getRetroBoard,
    addRetroCard,
    deleteRetroCard
} from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

// Planning Poker REST endpoints
app.get('/api/rooms', async (req, res) => {
    try {
        const rooms = await getRooms()
        const roomList = rooms.map(room => ({
            id: room.id,
            name: room.name,
            participantCount: parseInt(room.participant_count),
            createdAt: room.created_at,
            hasPassword: !!room.password,
            sequence: room.sequence
        }))
        res.json(roomList)
    } catch (error) {
        console.error('Error getting rooms:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

app.post('/api/rooms', async (req, res) => {
    const { roomId, name, password, sequence } = req.body
    try {
        const room = await getRoom(roomId)
        if (room) {
            return res.status(400).json({ error: 'Room already exists' })
        }

        const hashedPassword = password ? await bcrypt.hash(password, 10) : null
        await createRoom(roomId, name, sequence, hashedPassword)

        res.json({
            success: true,
            roomId,
            hasPassword: !!hashedPassword,
            sequence: sequence || 'fibonacci'
        })
    } catch (error) {
        console.error('Error creating room:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

app.post('/api/rooms/:roomId/verify-password', async (req, res) => {
    const { roomId } = req.params
    const { password } = req.body

    try {
        const room = await getRoom(roomId)
        if (!room) {
            return res.status(404).json({ error: 'Room not found' })
        }

        if (!room.password) {
            return res.json({ valid: true })
        }

        const isValid = await bcrypt.compare(password, room.password)
        res.json({ valid: isValid })
    } catch (error) {
        console.error('Error verifying password:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

// Retro Board REST endpoints
app.post('/api/retro', async (req, res) => {
    const boardId = Math.random().toString(36).substring(2, 8)
    const { name } = req.body

    try {
        await createRetroBoard(boardId, name)
        res.json({ success: true, boardId })
    } catch (error) {
        console.error('Error creating retro board:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

app.get('/api/retro/:boardId', async (req, res) => {
    const { boardId } = req.params

    try {
        const board = await getRetroBoard(boardId)
        if (!board) {
            return res.status(404).json({ error: 'Board not found' })
        }
        res.json(board)
    } catch (error) {
        console.error('Error getting retro board:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

// Socket.IO events
io.on('connection', (socket) => {
    console.log('User connected:', socket.id)

    // Planning Poker events
    socket.on('joinRoom', async ({ roomId, userName, password }) => {
        try {
            const room = await getRoom(roomId)
            if (!room) {
                socket.emit('error', { message: 'Room not found' })
                return
            }

            if (room.password) {
                const isValid = await bcrypt.compare(password, room.password)
                if (!isValid) {
                    socket.emit('error', { message: 'Invalid password' })
                    return
                }
            }

            await addParticipant(roomId, socket.id, userName)
            const updatedRoom = await getRoom(roomId)

            socket.join(roomId)

            io.to(roomId).emit('roomJoined', {
                participants: Array.from(updatedRoom.participants.values()),
                settings: {
                    sequence: updatedRoom.sequence,
                    hasPassword: !!updatedRoom.password
                }
            })

            console.log(`${userName} joined room ${roomId}`)
        } catch (error) {
            console.error('Error joining room:', error)
            socket.emit('error', { message: 'Failed to join room' })
        }
    })

    socket.on('updateSettings', async ({ roomId, settings }) => {
        try {
            let hashedPassword = undefined
            if (settings.password) {
                hashedPassword = await bcrypt.hash(settings.password, 10)
            }

            await updateRoomSettings(roomId, settings.sequence, hashedPassword)
            const updatedRoom = await getRoom(roomId)

            io.to(roomId).emit('settingsUpdated', {
                settings: {
                    sequence: updatedRoom.sequence,
                    hasPassword: !!updatedRoom.password
                }
            })
        } catch (error) {
            console.error('Error updating settings:', error)
            socket.emit('error', { message: 'Failed to update settings' })
        }
    })

    socket.on('changeName', async ({ roomId, newName }) => {
        try {
            await updateParticipantName(roomId, socket.id, newName)
            const room = await getRoom(roomId)

            io.to(roomId).emit('participantUpdate', {
                participants: Array.from(room.participants.values())
            })

            console.log(`User ${socket.id} changed name to ${newName} in room ${roomId}`)
        } catch (error) {
            console.error('Error changing name:', error)
            socket.emit('error', { message: 'Failed to change name' })
        }
    })

    socket.on('vote', async ({ roomId, vote }) => {
        try {
            await updateParticipantVote(roomId, socket.id, vote)
            const room = await getRoom(roomId)

            io.to(roomId).emit('participantUpdate', {
                participants: Array.from(room.participants.values())
            })
        } catch (error) {
            console.error('Error voting:', error)
            socket.emit('error', { message: 'Failed to record vote' })
        }
    })

    socket.on('revealVotes', ({ roomId }) => {
        io.to(roomId).emit('votesRevealed')
    })

    socket.on('resetVotes', async ({ roomId }) => {
        try {
            await resetVotes(roomId)
            const room = await getRoom(roomId)

            io.to(roomId).emit('votesReset')
            io.to(roomId).emit('participantUpdate', {
                participants: Array.from(room.participants.values())
            })
        } catch (error) {
            console.error('Error resetting votes:', error)
            socket.emit('error', { message: 'Failed to reset votes' })
        }
    })

    // Retro Board events
    socket.on('joinRetroBoard', async ({ boardId }) => {
        try {
            const board = await getRetroBoard(boardId)
            if (!board) {
                socket.emit('error', { message: 'Board not found' })
                return
            }

            socket.join(`retro:${boardId}`)
            socket.emit('retroBoardJoined', board)
        } catch (error) {
            console.error('Error joining retro board:', error)
            socket.emit('error', { message: 'Failed to join retro board' })
        }
    })

    socket.on('addRetroCard', async ({ boardId, cardId, columnId, text }) => {
        try {
            await addRetroCard(boardId, cardId, columnId, text)
            const board = await getRetroBoard(boardId)
            io.to(`retro:${boardId}`).emit('retroBoardUpdated', board)
        } catch (error) {
            console.error('Error adding retro card:', error)
            socket.emit('error', { message: 'Failed to add card' })
        }
    })

    socket.on('deleteRetroCard', async ({ boardId, cardId }) => {
        try {
            await deleteRetroCard(cardId)
            const board = await getRetroBoard(boardId)
            io.to(`retro:${boardId}`).emit('retroBoardUpdated', board)
        } catch (error) {
            console.error('Error deleting retro card:', error)
            socket.emit('error', { message: 'Failed to delete card' })
        }
    })

    socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.id)

        try {
            // Find the room this participant was in
            const rooms = await getRooms()
            for (const room of rooms) {
                const fullRoom = await getRoom(room.id)
                if (fullRoom.participants.has(socket.id)) {
                    await removeParticipant(room.id, socket.id)
                    const updatedRoom = await getRoom(room.id)

                    io.to(room.id).emit('participantUpdate', {
                        participants: Array.from(updatedRoom.participants.values())
                    })
                    break
                }
            }
        } catch (error) {
            console.error('Error handling disconnect:', error)
        }
    })
})

const PORT = 3001
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})

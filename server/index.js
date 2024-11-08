import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { loadRooms, saveRooms, createRoom } from './rooms.js';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Initialize rooms Map
let rooms = new Map();

// Ensure rooms.json exists
const ROOMS_FILE = join(__dirname, 'rooms.json');
try {
    await fs.access(ROOMS_FILE);
} catch {
    await fs.writeFile(ROOMS_FILE, '{}');
}

// Load persisted rooms
try {
    rooms = await loadRooms();
} catch (error) {
    console.error('Error loading rooms:', error);
    rooms = new Map();
}

// REST endpoints for room management
app.get('/api/rooms', async (req, res) => {
    const roomList = Array.from(rooms.entries()).map(([id, room]) => ({
        id,
        name: room.name || id,
        participantCount: room.participants.size,
        createdAt: room.createdAt,
        hasPassword: !!room.password,
        sequence: room.sequence || 'fibonacci'
    }));
    res.json(roomList);
});

app.post('/api/rooms', async (req, res) => {
    const { roomId, name, password, sequence } = req.body;
    if (!rooms.has(roomId)) {
        const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
        const room = createRoom(roomId, name, sequence, hashedPassword);
        rooms.set(roomId, room);
        await saveRooms(rooms);
        res.json({
            success: true,
            roomId,
            hasPassword: !!hashedPassword,
            sequence: room.sequence
        });
    } else {
        res.status(400).json({ error: 'Room already exists' });
    }
});

app.post('/api/rooms/:roomId/verify-password', async (req, res) => {
    const { roomId } = req.params;
    const { password } = req.body;
    const room = rooms.get(roomId);

    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }

    if (!room.password) {
        return res.json({ valid: true });
    }

    const isValid = await bcrypt.compare(password, room.password);
    res.json({ valid: isValid });
});

// Socket.IO events
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinRoom', async ({ roomId, userName, password }) => {
        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        if (room.password) {
            const isValid = await bcrypt.compare(password, room.password);
            if (!isValid) {
                socket.emit('error', { message: 'Invalid password' });
                return;
            }
        }

        // Add participant to room
        room.participants.set(socket.id, {
            id: socket.id,
            name: userName,
            vote: null
        });

        // Join socket.io room
        socket.join(roomId);

        // Send current participants and room settings to all room members
        io.to(roomId).emit('roomJoined', {
            participants: Array.from(room.participants.values()),
            settings: {
                sequence: room.sequence,
                hasPassword: !!room.password
            }
        });

        await saveRooms(rooms);
        console.log(`${userName} joined room ${roomId}`);
    });

    socket.on('updateSettings', async ({ roomId, settings }) => {
        const room = rooms.get(roomId);
        if (room) {
            if (settings.password) {
                room.password = await bcrypt.hash(settings.password, 10);
            }
            if (settings.sequence) {
                room.sequence = settings.sequence;
            }

            io.to(roomId).emit('settingsUpdated', {
                settings: {
                    sequence: room.sequence,
                    hasPassword: !!room.password
                }
            });

            await saveRooms(rooms);
        }
    });

    socket.on('changeName', async ({ roomId, newName }) => {
        const room = rooms.get(roomId);
        if (room && room.participants.has(socket.id)) {
            const participant = room.participants.get(socket.id);
            participant.name = newName;
            room.participants.set(socket.id, participant);

            io.to(roomId).emit('participantUpdate', {
                participants: Array.from(room.participants.values())
            });

            await saveRooms(rooms);
            console.log(`User ${socket.id} changed name to ${newName} in room ${roomId}`);
        }
    });

    socket.on('vote', async ({ roomId, vote }) => {
        const room = rooms.get(roomId);
        if (room && room.participants.has(socket.id)) {
            const participant = room.participants.get(socket.id);
            participant.vote = vote;
            room.participants.set(socket.id, participant);

            io.to(roomId).emit('participantUpdate', {
                participants: Array.from(room.participants.values())
            });

            await saveRooms(rooms);
        }
    });

    socket.on('revealVotes', ({ roomId }) => {
        io.to(roomId).emit('votesRevealed');
    });

    socket.on('resetVotes', async ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room) {
            // Reset all votes in the room
            for (const [id, participant] of room.participants.entries()) {
                participant.vote = null;
                room.participants.set(id, participant);
            }

            // Notify all participants
            io.to(roomId).emit('votesReset');
            io.to(roomId).emit('participantUpdate', {
                participants: Array.from(room.participants.values())
            });

            await saveRooms(rooms);
        }
    });

    socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.id);

        // Remove participant from their room
        for (const [roomId, room] of rooms.entries()) {
            if (room.participants.has(socket.id)) {
                room.participants.delete(socket.id);
                io.to(roomId).emit('participantUpdate', {
                    participants: Array.from(room.participants.values())
                });

                await saveRooms(rooms);
                break;
            }
        }
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

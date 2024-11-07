import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { loadRooms, saveRooms, createRoom } from './rooms.js';

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
        participantCount: room.size,
        createdAt: room.createdAt
    }));
    res.json(roomList);
});

app.post('/api/rooms', async (req, res) => {
    const { roomId, name } = req.body;
    if (!rooms.has(roomId)) {
        rooms.set(roomId, createRoom(roomId, name));
        await saveRooms(rooms);
        res.json({ success: true, roomId });
    } else {
        res.status(400).json({ error: 'Room already exists' });
    }
});

// Socket.IO events
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinRoom', async ({ roomId, userName }) => {
        // Create room if it doesn't exist
        if (!rooms.has(roomId)) {
            rooms.set(roomId, createRoom(roomId));
        }

        // Add participant to room
        const room = rooms.get(roomId);
        room.set(socket.id, {
            id: socket.id,
            name: userName,
            vote: null
        });

        // Join socket.io room
        socket.join(roomId);

        // Send current participants to all room members
        io.to(roomId).emit('roomJoined', {
            participants: Array.from(room.values())
        });

        await saveRooms(rooms);
        console.log(`${userName} joined room ${roomId}`);
    });

    socket.on('changeName', async ({ roomId, newName }) => {
        const room = rooms.get(roomId);
        if (room && room.has(socket.id)) {
            const participant = room.get(socket.id);
            participant.name = newName;
            room.set(socket.id, participant);

            // Update all participants
            io.to(roomId).emit('participantUpdate', {
                participants: Array.from(room.values())
            });

            await saveRooms(rooms);
            console.log(`User ${socket.id} changed name to ${newName} in room ${roomId}`);
        }
    });

    socket.on('vote', async ({ roomId, vote }) => {
        const room = rooms.get(roomId);
        if (room && room.has(socket.id)) {
            const participant = room.get(socket.id);
            participant.vote = vote;
            room.set(socket.id, participant);

            // Update all participants
            io.to(roomId).emit('participantUpdate', {
                participants: Array.from(room.values())
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
            for (const [id, participant] of room.entries()) {
                participant.vote = null;
                room.set(id, participant);
            }

            // Notify all participants
            io.to(roomId).emit('votesReset');
            io.to(roomId).emit('participantUpdate', {
                participants: Array.from(room.values())
            });

            await saveRooms(rooms);
        }
    });

    socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.id);

        // Remove participant from their room
        for (const [roomId, room] of rooms.entries()) {
            if (room.has(socket.id)) {
                room.delete(socket.id);
                io.to(roomId).emit('participantUpdate', {
                    participants: Array.from(room.values())
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

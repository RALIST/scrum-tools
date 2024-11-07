import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // Vite's default port
        methods: ["GET", "POST"]
    }
});

// Store rooms and their participants
const rooms = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinRoom', ({ roomId, userName }) => {
        // Create room if it doesn't exist
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
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

        console.log(`${userName} joined room ${roomId}`);
    });

    socket.on('vote', ({ roomId, vote }) => {
        const room = rooms.get(roomId);
        if (room && room.has(socket.id)) {
            const participant = room.get(socket.id);
            participant.vote = vote;
            room.set(socket.id, participant);

            // Update all participants
            io.to(roomId).emit('participantUpdate', {
                participants: Array.from(room.values())
            });
        }
    });

    socket.on('revealVotes', ({ roomId }) => {
        io.to(roomId).emit('votesRevealed');
    });

    socket.on('resetVotes', ({ roomId }) => {
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
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Remove participant from their room
        for (const [roomId, room] of rooms.entries()) {
            if (room.has(socket.id)) {
                room.delete(socket.id);

                // If room is empty, remove it
                if (room.size === 0) {
                    rooms.delete(roomId);
                } else {
                    // Update remaining participants
                    io.to(roomId).emit('participantUpdate', {
                        participants: Array.from(room.values())
                    });
                }
                break;
            }
        }
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

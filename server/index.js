import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import './db/schema.js';
import pokerRoutes from './routes/poker.js';
import retroRoutes from './routes/retro.js';
import velocityRoutes from './routes/velocity.js';
import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspaces.js';
import historyRoutes from './routes/history.js';
import { handlePlanningPokerEvents } from './sockets/poker.js';
import { handleRetroBoardEvents } from './sockets/retro.js';
import { getRooms, getRoom, removeParticipant } from './db/poker.js';
import { optionalAuthenticateToken } from './middleware/auth.js';

const app = express();
app.use(cors());
app.use(express.json());

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/history', historyRoutes);
app.use('/api', optionalAuthenticateToken, pokerRoutes);
app.use('/api', optionalAuthenticateToken, retroRoutes);
app.use('/api', optionalAuthenticateToken, velocityRoutes);

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

// Create namespaces for different features
const pokerIo = io.of('/poker');
const retroIo = io.of('/retro');

// Planning Poker events
pokerIo.on('connection', (socket) => {
    console.log('User connected to poker:', socket.id)

    handlePlanningPokerEvents(pokerIo, socket);

    socket.on('disconnect', async () => {
        console.log('User disconnected from poker:', socket.id)

        try {
            // Find the room this participant was in
            const rooms = await getRooms()
            for (const room of rooms) {
                const fullRoom = await getRoom(room.id)
                if (fullRoom.participants.has(socket.id)) {
                    await removeParticipant(room.id, socket.id)
                    const updatedRoom = await getRoom(room.id)

                    pokerIo.to(room.id).emit('participantUpdate', {
                        participants: Array.from(updatedRoom.participants.values())
                    })
                    break
                }
            }
        } catch (error) {
            console.error('Error handling poker disconnect:', error)
        }
    })
});

// Retro Board events
retroIo.on('connection', (socket) => {
    console.log('User connected to retro:', socket.id)

    handleRetroBoardEvents(retroIo, socket);

    socket.on('disconnect', () => {
        console.log('User disconnected from retro:', socket.id)
    })
});

const PORT = 3001
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})

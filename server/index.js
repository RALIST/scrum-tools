import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import './db/schema.js';
import pokerRoutes from './routes/poker.js';
import retroRoutes from './routes/retro.js';
import { handlePlanningPokerEvents } from './sockets/poker.js';
import { handleRetroBoardEvents } from './sockets/retro.js';
import { getRooms, getRoom, removeParticipant } from './db/poker.js';

const app = express();
app.use(cors());
app.use(express.json());

// Mount routes
app.use('/api', pokerRoutes);
app.use('/api', retroRoutes);

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

// Socket.IO events
io.on('connection', (socket) => {
    console.log('User connected:', socket.id)

    // Register event handlers
    handlePlanningPokerEvents(io, socket);
    handleRetroBoardEvents(io, socket);

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

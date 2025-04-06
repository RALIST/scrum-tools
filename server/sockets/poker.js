import bcrypt from 'bcryptjs';
import {
    getRoom,
    addParticipant,
    updateParticipantName,
    updateParticipantVote,
    removeParticipant,
    getRooms,
    resetVotes,
    updateRoomSettings
} from '../db/poker.js';
import logger from '../logger.js'; // Import the logger

// This function handles events for an individual connected socket
const handlePokerSocketEvents = (io, socket) => {
    socket.on('joinRoom', async ({ roomId, userName, password }) => {
        try {
            // Keep track of the room the socket joins for disconnect cleanup
            socket.data.roomId = roomId; // Store roomId in socket data

            const room = await getRoom(roomId);
            if (!room) {
                socket.emit('error', { message: 'Room not found' })
                return
            }

            // Password validation logic
            if (room.password) { // Room requires a password
                if (!password) { // Client did not provide a password
                    socket.emit('error', { message: 'Password required' });
                    return;
                }
                // Both room has password and client provided one, now compare
                const isValid = await bcrypt.compare(password, room.password);
                if (!isValid) {
                    socket.emit('error', { message: 'Invalid password' });
                    return;
                }
            } else if (password) { // Room is public, but client sent a password (optional: treat as error or ignore)
                 logger.warn(`Client ${socket.id} sent a password for public room ${roomId}. Ignoring.`);
                 // Or: socket.emit('error', { message: 'Password not required for this room' }); return;
            }

            // Add participant to DB first
            await addParticipant(roomId, socket.id, userName);

            // Add the new participant to the existing room data in memory
            // Ensure room.participants is a Map before setting
            if (!(room.participants instanceof Map)) {
                 // If getRoom didn't return a Map (e.g., if it was null initially and logic changed), initialize it
                 // This case shouldn't happen based on current getRoom logic, but defensive check
                 logger.warn(`Room ${roomId} participants was not a Map. Initializing.`);
                 room.participants = new Map();
            }
             room.participants.set(socket.id, { id: socket.id, name: userName, vote: null });

            // Join the socket.io room (making it await just in case, though often not needed)
            await socket.join(roomId);

            // Emit the updated room data (using the modified 'room' object)
            io.to(roomId).emit('roomJoined', {
                participants: Array.from(room.participants.values()), // Use updated participants map
                settings: {
                    sequence: room.sequence, // Use sequence from the initially fetched room
                    hasPassword: !!room.password // Use password status from the initially fetched room
                }
            });

            logger.info(`${userName} (${socket.id}) joined poker room ${roomId}`);

        } catch (error) {
            // Log the specific error encountered during the join process
            logger.error(`Error during joinRoom for room ${roomId}, user ${userName}, socket ${socket.id}:`, {
                message: error.message,
                stack: error.stack,
                // Optionally include more context if available, e.g., step where error occurred
            });
            // Send a generic error message to the client
            socket.emit('error', { message: 'Failed to join room due to server error' });
        }
    });

    socket.on('updateSettings', async ({ roomId, settings }) => {
        try {
            // Validate settings input
            if (settings.sequence !== undefined && !Array.isArray(settings.sequence)) {
                logger.warn(`Invalid sequence type received for room ${roomId}: ${typeof settings.sequence}`);
                // Emit the specific validation error and return
                socket.emit('error', { message: 'Invalid settings format: sequence must be an array.' });
                return;
            }
            // Add more validation if needed (e.g., check sequence elements)

            let hashedPassword = undefined
            if (settings.password !== undefined) { // Check if password key exists
                if (typeof settings.password === 'string' && settings.password.length > 0) {
                    hashedPassword = await bcrypt.hash(settings.password, 10);
                } else if (settings.password === null || settings.password === '') {
                     hashedPassword = null; // Explicitly set to null to remove password
                } else {
                     // Handle invalid password type if necessary
                     logger.warn(`Invalid password type received for room ${roomId}: ${typeof settings.password}`);
                     // Decide if this should be an error or ignored
                }
            }

            // Call the DB function only if validation passes
            await updateRoomSettings(roomId, settings.sequence, hashedPassword);
            const updatedRoom = await getRoom(roomId); // Fetch updated room after successful settings update

            // Check if room exists after update (might be redundant if updateRoomSettings ensures existence, but safe)
            if (!updatedRoom) {
                 logger.error(`Room ${roomId} not found after attempting settings update.`);
                 // Handle case where room might have been deleted between update and get
                 socket.emit('error', { message: 'Room not found after update.' });
                 return;
            }


            io.to(roomId).emit('settingsUpdated', {
                settings: {
                    sequence: updatedRoom.sequence,
                    hasPassword: !!updatedRoom.password
                }
            });
        } catch (error) {
            // This catch block now handles errors from updateRoomSettings or getRoom
            logger.error('Error during settings update process:', { roomId, settings, socketId: socket.id, error: error.message, stack: error.stack });
            // Emit the actual error message caught from DB or other operations
            socket.emit('error', { message: error.message || 'Failed to update settings' });
        }
    });

    socket.on('changeName', async ({ roomId, newName }) => {
        try {
            await updateParticipantName(roomId, socket.id, newName)
            const room = await getRoom(roomId)

            io.to(roomId).emit('participantUpdate', {
                participants: Array.from(room.participants.values()),
            });

            logger.info(`User ${socket.id} changed name to ${newName} in poker room ${roomId}`);
        } catch (error) {
            logger.error('Error changing poker participant name:', { roomId, newName, socketId: socket.id, error: error.message, stack: error.stack });
            socket.emit('error', { message: 'Failed to change name' });
        }
    });

    socket.on('vote', async ({ roomId, vote }) => {
        try {
            await updateParticipantVote(roomId, socket.id, vote)
            const room = await getRoom(roomId)

            io.to(roomId).emit('participantUpdate', {
                participants: Array.from(room.participants.values()),
            });
        } catch (error) {
            logger.error('Error recording poker vote:', { roomId, vote, socketId: socket.id, error: error.message, stack: error.stack });
            socket.emit('error', { message: 'Failed to record vote' });
        }
    });

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
            });
        } catch (error) {
            logger.error('Error resetting poker votes:', { roomId, socketId: socket.id, error: error.message, stack: error.stack });
            socket.emit('error', { message: 'Failed to reset votes' });
        }
    });
};

// This function initializes the poker namespace and handles connections/disconnections
export const initializePokerSocket = (pokerIo) => { // Rename 'io' to 'pokerIo' for clarity
    pokerIo.on('connection', (socket) => {
        // Log immediately upon connection to the /poker namespace
        logger.info(`Socket connected to /poker namespace: ${socket.id}`);

        // Handle specific poker events for this socket
        // Pass pokerIo (the namespace object) to the event handler if it needs to emit globally within the namespace
        handlePokerSocketEvents(pokerIo, socket);
        // Removed duplicate call: handlePokerSocketEvents(io, socket);

        // Handle disconnection
        socket.on('disconnect', async () => {
            logger.info(`User disconnected from poker: ${socket.id}`);
            const roomId = socket.data.roomId; // Retrieve roomId stored during joinRoom

            if (roomId) {
                try {
                    await removeParticipant(roomId, socket.id);
                    const updatedRoom = await getRoom(roomId);

                    // Check if room still exists and has participants before emitting
                    if (updatedRoom && updatedRoom.participants) {
                         // Emit within the poker namespace
                         pokerIo.to(roomId).emit('participantUpdate', {
                            participants: Array.from(updatedRoom.participants.values()),
                        });
                        logger.info(`Removed participant ${socket.id} from poker room ${roomId}`);
                    } else {
                        logger.info(`Poker room ${roomId} might be empty or deleted after participant ${socket.id} left.`);
                        // Optionally: Add logic here to delete the room if it's empty
                    }
                } catch (error) {
                    logger.error(`Error handling poker disconnect for socket ${socket.id} in room ${roomId}:`, { error: error.message, stack: error.stack });
                }
            } else {
                 logger.warn(`User ${socket.id} disconnected from poker without joining a specific room.`);
                 // Attempt to find the room if socket.data.roomId wasn't set (fallback, less efficient)
                 try {
                    const rooms = await getRooms();
                    for (const room of rooms) {
                        const fullRoom = await getRoom(room.id);
                        // Check participants map directly if it exists
                        if (fullRoom?.participants?.has(socket.id)) {
                            await removeParticipant(room.id, socket.id);
                            const updatedFallbackRoom = await getRoom(room.id);
                             if (updatedFallbackRoom?.participants) {
                                 // Emit within the poker namespace
                                pokerIo.to(room.id).emit('participantUpdate', {
                                    participants: Array.from(updatedFallbackRoom.participants.values()),
                                });
                                logger.info(`Fallback: Removed participant ${socket.id} from poker room ${room.id}`);
                            }
                            break;
                        }
                    }
                 } catch (error) {
                     logger.error('Error during fallback disconnect handling for poker:', { socketId: socket.id, error: error.message, stack: error.stack });
                 }
            }
        });
    });
};

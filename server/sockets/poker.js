import bcrypt from 'bcryptjs';
const handlePokerSocketEvents = (io, socket, pokerDb) => { // Add pokerDb dependency
    socket.on('joinRoom', async ({ roomId, userName, password }) => {
        try {
            // Keep track of the room the socket joins for disconnect cleanup
            socket.data.roomId = roomId; // Store roomId in socket data

            const room = await pokerDb.getRoom(roomId); // Use injected pokerDb
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
                 // Or: socket.emit('error', { message: 'Password not required for this room' }); return;
            }

            // Add participant to DB first
            await pokerDb.addParticipant(roomId, socket.id, userName); // Use injected pokerDb

            // Add the new participant to the existing room data in memory
            // Ensure room.participants is a Map before setting
            if (!(room.participants instanceof Map)) {
                 // If getRoom didn't return a Map (e.g., if it was null initially and logic changed), initialize it
                 // This case shouldn't happen based on current getRoom logic, but defensive check
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


        } catch (error) {
            // Send a generic error message to the client
            socket.emit('error', { message: 'Failed to join room due to server error' });
        }
    });

    socket.on('updateSettings', async ({ roomId, settings }) => {
        try {
            // Validate settings input
            if (settings.sequence !== undefined && !Array.isArray(settings.sequence)) {
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
                }
            }

            // Call the DB function only if validation passes
            await pokerDb.updateRoomSettings(roomId, settings.sequence, hashedPassword); // Use injected pokerDb
            const updatedRoom = await pokerDb.getRoom(roomId); // Use injected pokerDb

            // Check if room exists after update (might be redundant if updateRoomSettings ensures existence, but safe)
            if (!updatedRoom) {
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
            socket.emit('error', { message: error.message || 'Failed to update settings' });
        }
    });

    socket.on('changeName', async ({ roomId, newName }) => {
        try {
            await pokerDb.updateParticipantName(roomId, socket.id, newName); // Use injected pokerDb
            const room = await pokerDb.getRoom(roomId); // Use injected pokerDb

            io.to(roomId).emit('participantUpdate', {
                participants: Array.from(room.participants.values()),
            });

        } catch (error) {
            socket.emit('error', { message: 'Failed to change name' });
        }
    });

    socket.on('vote', async ({ roomId, vote }) => {
        try {
            await pokerDb.updateParticipantVote(roomId, socket.id, vote); // Use injected pokerDb
            const room = await pokerDb.getRoom(roomId); // Use injected pokerDb

            io.to(roomId).emit('participantUpdate', {
                participants: Array.from(room.participants.values()),
            });
        } catch (error) {
            socket.emit('error', { message: 'Failed to record vote' });
        }
    });

    socket.on('revealVotes', ({ roomId }) => {
        io.to(roomId).emit('votesRevealed')
    })

    socket.on('resetVotes', async ({ roomId }) => {
        try {
            await pokerDb.resetVotes(roomId); // Use injected pokerDb
            const room = await pokerDb.getRoom(roomId); // Use injected pokerDb

            io.to(roomId).emit('votesReset')
            io.to(roomId).emit('participantUpdate', {
                participants: Array.from(room.participants.values())
            });
        } catch (error) {
            socket.emit('error', { message: 'Failed to reset votes' });
        }
    });
};

// This function initializes the poker namespace and handles connections/disconnections
export const initializePokerSocket = (pokerIo, pokerDb) => { // Expecting the namespace instance (pokerIo)
    pokerIo.on('connection', (socket) => { // Listen directly on the passed namespace instance
        // Log immediately upon connection to the /poker namespace

        // Handle specific poker events for this socket
        // Pass pokerIo (the namespace object) to the event handler if it needs to emit globally within the namespace
        handlePokerSocketEvents(pokerIo, socket, pokerDb); // Pass the namespace instance (pokerIo)
        // Removed duplicate call: handlePokerSocketEvents(io, socket);

        // Handle disconnection
        socket.on('disconnect', async () => {
            const roomId = socket.data.roomId; // Retrieve roomId stored during joinRoom

            if (roomId) {
                try {
                    await pokerDb.removeParticipant(roomId, socket.id); // Use injected pokerDb
                    const updatedRoom = await pokerDb.getRoom(roomId); // Use injected pokerDb

                    // Check if room still exists and has participants before emitting
                    if (updatedRoom && updatedRoom.participants) {
                         // Emit within the poker namespace
                         pokerIo.to(roomId).emit('participantUpdate', { // Emit via namespace instance (pokerIo)
                            participants: Array.from(updatedRoom.participants.values()),
                        });
                    } else {
                        // Optionally: Add logic here to delete the room if it's empty
                    }
                } catch (error) {
                }
            } else {
                 // Attempt to find the room if socket.data.roomId wasn't set (fallback, less efficient)
                 try {
                    const rooms = await pokerDb.getRooms(); // Use injected pokerDb
                    for (const room of rooms) {
                        const fullRoom = await pokerDb.getRoom(room.id); // Use injected pokerDb
                        // Check participants map directly if it exists
                        if (fullRoom?.participants?.has(socket.id)) {
                            await pokerDb.removeParticipant(room.id, socket.id); // Use injected pokerDb
                            const updatedFallbackRoom = await pokerDb.getRoom(room.id); // Use injected pokerDb
                             if (updatedFallbackRoom?.participants) {
                                 // Emit within the poker namespace
                                pokerIo.to(room.id).emit('participantUpdate', { // Emit via namespace instance (pokerIo)
                                    participants: Array.from(updatedFallbackRoom.participants.values()),
                                });
                            }
                            break;
                        }
                    }
                 } catch (error) {
                 }
            }
        });
    });
};

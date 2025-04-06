import bcrypt from 'bcryptjs';
import { Socket, Namespace } from 'socket.io'; // Import Namespace
import * as pokerDbFunctions from '../db/poker.js'; // Import DB functions (needs .js)
import {
    PokerClientToServerEvents, PokerServerToClientEvents, PokerInterServerEvents, PokerSocketData,
    PokerJoinRoomPayload, PokerUpdateSettingsPayload, PokerChangeNamePayload, PokerVotePayload,
    PokerRevealVotesPayload, PokerResetVotesPayload, SocketErrorPayload, PokerParticipantInfo
} from '../types/sockets.js'; // Import socket types (needs .js)
import { PokerRoomDetails } from '../types/db.js'; // Import DB types (needs .js)

// Define the type for the injected pokerDb module
type PokerDbModule = typeof pokerDbFunctions;

// Define the typed Socket.IO Namespace and socket types
type TypedPokerNamespace = Namespace<PokerClientToServerEvents, PokerServerToClientEvents, PokerInterServerEvents, PokerSocketData>;
type TypedSocket = Socket<PokerClientToServerEvents, PokerServerToClientEvents, PokerInterServerEvents, PokerSocketData>;


const handlePokerSocketEvents = (
    io: TypedPokerNamespace,
    socket: TypedSocket,
    pokerDb: PokerDbModule // Use the defined type
): void => {

    socket.on('joinRoom', async (payload: PokerJoinRoomPayload) => {
        const { roomId, userName, password } = payload;
        try {
            socket.data.roomId = roomId; // Store roomId in socket data
            const room: PokerRoomDetails | null = await pokerDb.getRoom(roomId);
            if (!room) {
                socket.emit('error', { message: 'Room not found' } as SocketErrorPayload);
                return;
            }

            if (room.password) {
                if (!password) {
                    socket.emit('error', { message: 'Password required' } as SocketErrorPayload);
                    return;
                }
                const isValid: boolean = await bcrypt.compare(password, room.password!);
                if (!isValid) {
                    socket.emit('error', { message: 'Invalid password' } as SocketErrorPayload);
                    return;
                }
            } else if (password) {
                // Ignore password if room is public
            }

            await pokerDb.addParticipant(roomId, socket.id, userName);

            // Ensure room.participants is a Map before setting (defensive check)
            if (!(room.participants instanceof Map)) {
                 room.participants = new Map();
            }
            room.participants.set(socket.id, { id: socket.id, name: userName, vote: null } as PokerParticipantInfo);

            await socket.join(roomId);

            // Emit sequence key (string)
            io.to(roomId).emit('roomJoined', {
                participants: Array.from(room.participants.values()),
                settings: {
                    sequence: room.sequence, // Send string key
                    hasPassword: !!room.password
                }
            });
        } catch (error: any) {
            socket.emit('error', { message: 'Failed to join room due to server error' } as SocketErrorPayload);
        }
    });

    socket.on('updateSettings', async (payload: PokerUpdateSettingsPayload) => {
        const { roomId, settings } = payload;
        try {
            // Removed incorrect validation check for sequence type

            let hashedPassword: string | null | undefined = undefined;
            if (settings.password !== undefined) {
                if (typeof settings.password === 'string' && settings.password.length > 0) {
                    hashedPassword = await bcrypt.hash(settings.password, 10);
                } else if (settings.password === null || settings.password === '') {
                     hashedPassword = null;
                }
                // Ignore if password is not string or null/empty
            }

            // Pass sequence key (string) to DB function
            await pokerDb.updateRoomSettings(roomId, settings.sequence, hashedPassword);
            const updatedRoom: PokerRoomDetails | null = await pokerDb.getRoom(roomId);

            if (!updatedRoom) {
                 socket.emit('error', { message: 'Room not found after update.' } as SocketErrorPayload);
                 return;
            }

            // Emit sequence key (string)
            io.to(roomId).emit('settingsUpdated', {
                settings: {
                    sequence: updatedRoom.sequence,
                    hasPassword: !!updatedRoom.password
                }
            });
        } catch (error: any) {
            socket.emit('error', { message: error.message || 'Failed to update settings' } as SocketErrorPayload);
        }
    });

    socket.on('changeName', async (payload: PokerChangeNamePayload) => {
        const { roomId, newName } = payload;
        try {
            await pokerDb.updateParticipantName(roomId, socket.id, newName);
            const room: PokerRoomDetails | null = await pokerDb.getRoom(roomId);
            if (!room) {
                // Error should have been thrown by updateParticipantName if participant/room not found
                // But we check again just in case getRoom fails for other reasons
                socket.emit('error', { message: 'Room not found after name change.' } as SocketErrorPayload);
                return;
            }
            io.to(roomId).emit('participantUpdate', {
                participants: Array.from(room.participants.values()),
            });
        } catch (error: any) {
            // Send the specific error from the DB function if available, otherwise generic
            socket.emit('error', { message: 'Failed to change name' } as SocketErrorPayload);
        }
    });

    socket.on('vote', async (payload: PokerVotePayload) => {
        const { roomId, vote } = payload;
        try {
            await pokerDb.updateParticipantVote(roomId, socket.id, vote);
            const room: PokerRoomDetails | null = await pokerDb.getRoom(roomId);
            if (!room) {
                socket.emit('error', { message: 'Room not found after vote.' } as SocketErrorPayload);
                return;
            }
            io.to(roomId).emit('participantUpdate', {
                participants: Array.from(room.participants.values()),
            });
        } catch (error: any) {
            socket.emit('error', { message: 'Failed to record vote' } as SocketErrorPayload);
        }
    });

    socket.on('revealVotes', (payload: PokerRevealVotesPayload) => {
        const { roomId } = payload;
        // No DB interaction needed, just broadcast
        io.to(roomId).emit('votesRevealed');
    });

    socket.on('resetVotes', async (payload: PokerResetVotesPayload) => {
        const { roomId } = payload;
        try {
            await pokerDb.resetVotes(roomId);
            const room: PokerRoomDetails | null = await pokerDb.getRoom(roomId);
            if (!room) {
                // If resetVotes threw an error, the catch block handles it.
                // If getRoom returns null after a successful reset (unlikely), emit this.
                socket.emit('error', { message: 'Room not found after vote reset.' } as SocketErrorPayload);
                return;
            }
            io.to(roomId).emit('votesReset');
            io.to(roomId).emit('participantUpdate', {
                participants: Array.from(room.participants.values())
            });
        } catch (error: any) {
            socket.emit('error', { message: 'Failed to reset votes' } as SocketErrorPayload);
        }
    });

}; // End of handlePokerSocketEvents

// This function initializes the poker namespace and handles connections/disconnections
export const initializePokerSocket = (
    pokerIo: TypedPokerNamespace,
    pokerDb: PokerDbModule // Use the defined type
): void => {
    pokerIo.on('connection', (socket: TypedSocket) => { // Type the socket
        console.log(`Socket connected to /poker: ${socket.id}`);

        handlePokerSocketEvents(pokerIo, socket, pokerDb);

        socket.on('disconnect', async () => {
            console.log(`Socket disconnected from /poker: ${socket.id}`);
            const roomId: string | undefined = socket.data.roomId;

            if (roomId) {
                try {
                    await pokerDb.removeParticipant(roomId, socket.id);
                    const updatedRoom: PokerRoomDetails | null = await pokerDb.getRoom(roomId);

                    if (updatedRoom && updatedRoom.participants) {
                         pokerIo.to(roomId).emit('participantUpdate', {
                            participants: Array.from(updatedRoom.participants.values()),
                        });
                    } else {
                        console.log(`Room ${roomId} is now empty or deleted after participant ${socket.id} left.`);
                        // Optionally: Add logic here to delete the room if it's empty
                    }
                } catch (error: any) {
                }
            } else {
                 // Fallback logic removed for simplicity, assuming socket.data.roomId is reliable
            }
        });
    });
};

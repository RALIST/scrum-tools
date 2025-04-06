import { Namespace, Server as SocketIOServer, Socket } from 'socket.io'; // Import Namespace
import * as retroDbFunctions from '../db/retro.js'; // Import DB functions (needs .js)
import {
    RetroClientToServerEvents, RetroServerToClientEvents, RetroInterServerEvents, RetroSocketData,
    RetroJoinBoardPayload, RetroToggleCardsVisibilityPayload, RetroAddCardPayload, RetroEditCardPayload,
    RetroDeleteCardPayload, RetroToggleVotePayload, RetroUpdateSettingsPayload, RetroChangeNamePayload,
    RetroStartTimerPayload, RetroStopTimerPayload, SocketErrorPayload
} from '../types/sockets.js'; // Import socket types (needs .js)
import { RetroBoardDetails, RetroCard } from '../types/db.js'; // Import DB types (needs .js)

// Define the type for the injected retroDb module
type RetroDbModule = typeof retroDbFunctions;

// Define the typed Socket.IO server and socket types
type TypedRetroNamespace = Namespace<RetroClientToServerEvents, RetroServerToClientEvents, RetroInterServerEvents, RetroSocketData>;
type TypedSocket = Socket<RetroClientToServerEvents, RetroServerToClientEvents, RetroInterServerEvents, RetroSocketData>;

// Type the in-memory maps
const activeTimers = new Map<string, NodeJS.Timeout>(); // boardId -> interval timer ID
const userNames = new Map<string, string>(); // socketId -> name
const boardVisibility = new Map<string, boolean>(); // boardId -> hideCards

// Handles events for an individual connected socket
const handleRetroSocketEvents = (
    io: TypedRetroNamespace,
    socket: TypedSocket,
    retroDb: RetroDbModule // Use the defined type
): void => {
    socket.on('joinRetroBoard', async (payload: RetroJoinBoardPayload) => {
        const { boardId, name, password } = payload;
        try {
            // debugLog('Joining retro board', { boardId, name });
            // Store boardId in socket data for disconnect cleanup
            socket.data.boardId = boardId; 
            const board: RetroBoardDetails | null = await retroDb.getRetroBoard(boardId); // Use injected retroDb
            if (!board) {
                // debugLog('Board not found', boardId)
                socket.emit('error', { message: 'Board not found' } as SocketErrorPayload);
                return
            }

            // Verify password if board is password protected
            if (board.hasPassword) {
                const isValid: boolean = await retroDb.verifyRetroBoardPassword(boardId, password); // Use injected retroDb
                if (!isValid) {
                    socket.emit('error', { message: 'Invalid password' } as SocketErrorPayload);
                    return
                }
            }

            const roomName: string = `retro:${boardId}`;
            await socket.join(roomName)
            userNames.set(socket.id, name)
            // debugLog('Socket joined room', { socketId: socket.id, roomName })

            // Send current visibility state
            const hideCards: boolean = boardVisibility.get(boardId) ?? false; // Use nullish coalescing
            // debugLog('Sending initial visibility state', { boardId, hideCards })
            socket.emit('cardsVisibilityChanged', { hideCards }) // Send only to joining client

            // If timer is running, emit timerStarted event with current time
            if (board.timer_running) {
                socket.emit('timerStarted', { timeLeft: board.time_left })
             }

             // Send current timer state specifically to the joining socket
             if (activeTimers.has(boardId)) {
                 // Need a way to get the current timeLeft for the active timer
                 // For now, let's assume the 'board' object fetched earlier has a recent enough value
                 // A more robust solution might store timeLeft with the interval or fetch it again.
                 // debugLog('Timer is active for board, sending timerStarted to joining user', { boardId, timeLeft: board.time_left });
                 socket.emit('timerStarted', { timeLeft: board.time_left });
             } else {
                 // Ensure client knows timer is stopped if it's not active
                 socket.emit('timerStopped');
             }


             socket.emit('retroBoardJoined', board);
         } catch (error: any) {
            socket.emit('error', { message: 'Failed to join retro board' } as SocketErrorPayload);
        }
    });

    socket.on('toggleCardsVisibility', async (payload: RetroToggleCardsVisibilityPayload) => {
        const { boardId, hideCards } = payload;
        try {
            // debugLog('Toggling cards visibility', { boardId, hideCards })
            const roomName: string = `retro:${boardId}`;

            // Update visibility state
            boardVisibility.set(boardId, hideCards)
            const currentState: boolean = boardVisibility.get(boardId) ?? false; // Use nullish coalescing
            // debugLog('Updated visibility state', { boardId, currentState })

            // Broadcast to all clients in the room
            // debugLog('Broadcasting visibility change', { roomName, hideCards })
            io.to(roomName).emit('cardsVisibilityChanged', { hideCards: currentState }); // Broadcast confirmed state
        } catch (error: any) {
            socket.emit('error', { message: 'Failed to toggle cards visibility' } as SocketErrorPayload);
        }
    });

    socket.on('addRetroCard', async (payload: RetroAddCardPayload) => {
        const { boardId, cardId, columnId, text } = payload;
        try {
            const userName: string | undefined = userNames.get(socket.id); // Get author name from server-side map
            if (!userName) {
                // debugLog('Add card failed: User name not found for socket', { socketId: socket.id });
                socket.emit('error', { message: 'Cannot add card: User not identified.' } as SocketErrorPayload);
                return;
            }
            // debugLog('Adding retro card', { boardId, cardId, columnId, authorName: userName }); // Log the correct name
            await retroDb.addRetroCard(boardId, cardId, columnId, text, userName); // Use injected retroDb
            const board: RetroBoardDetails | null = await retroDb.getRetroBoard(boardId); // Use injected retroDb
            if (!board) { // Handle case where board might not be found after add
                socket.emit('error', { message: 'Board not found after adding card.' } as SocketErrorPayload);
                return;
            }
            const roomName: string = `retro:${boardId}`;
            // debugLog('Emitting board update', { roomName });
            io.to(roomName).emit('retroBoardUpdated', board);
        } catch (error: any) {
            // Log the error with the retrieved userName if available
            const userName: string | undefined = userNames.get(socket.id);
            console.error(`Error adding card for user ${userName || 'unknown'}:`, error); // Log error server-side
            socket.emit('error', { message: 'Failed to add card' } as SocketErrorPayload);
        }
    });

    socket.on('editRetroCard', async (payload: RetroEditCardPayload) => {
        const { boardId, cardId, text } = payload;
        try {
            // debugLog('Editing retro card', { boardId, cardId, text })
            await retroDb.updateRetroCardText(cardId, text); // Use injected retroDb
            const board: RetroBoardDetails | null = await retroDb.getRetroBoard(boardId); // Use injected retroDb
            if (!board) { // Handle case where board might not be found after edit
                socket.emit('error', { message: 'Board not found after editing card.' } as SocketErrorPayload);
                return;
            }
            const roomName: string = `retro:${boardId}`;
            // debugLog('Emitting board update', { roomName })
            io.to(roomName).emit('retroBoardUpdated', board);
        } catch (error: any) {
            socket.emit('error', { message: 'Failed to edit card' } as SocketErrorPayload);
        }
    });

    socket.on('deleteRetroCard', async (payload: RetroDeleteCardPayload) => {
        const { boardId, cardId } = payload;
        try {
            // debugLog('Deleting retro card', { boardId, cardId })
            await retroDb.deleteRetroCard(cardId); // Use injected retroDb
            const board: RetroBoardDetails | null = await retroDb.getRetroBoard(boardId); // Use injected retroDb
            // No need to check if board exists here, as we emit even if it's null (meaning board was deleted)
            const roomName: string = `retro:${boardId}`;
            // debugLog('Emitting board update', { roomName })
            io.to(roomName).emit('retroBoardUpdated', board!); // Assert non-null as board should exist if delete didn't fail catastrophically
        } catch (error: any) {
            socket.emit('error', { message: 'Failed to delete card' } as SocketErrorPayload);
        }
    });

    socket.on('toggleVote', async (payload: RetroToggleVotePayload) => {
        const { boardId, cardId } = payload;
        try {
            // debugLog('Toggling vote', { boardId, cardId })
            const userName: string | undefined = userNames.get(socket.id);
            if (!userName) {
                socket.emit('error', { message: 'User not found' } as SocketErrorPayload);
                return
            }

            await retroDb.toggleRetroCardVote(cardId, userName); // Use injected retroDb
            const board: RetroBoardDetails | null = await retroDb.getRetroBoard(boardId); // Use injected retroDb
            if (!board) { // Handle case where board might not be found after vote
                socket.emit('error', { message: 'Board not found after toggling vote.' } as SocketErrorPayload);
                return;
            }
            const roomName: string = `retro:${boardId}`;
            // debugLog('Emitting board update', { roomName })
            io.to(roomName).emit('retroBoardUpdated', board);
        } catch (error: any) {
            socket.emit('error', { message: 'Failed to toggle vote' } as SocketErrorPayload);
        }
    });

    socket.on('updateSettings', async (payload: RetroUpdateSettingsPayload) => {
        const { boardId, settings } = payload;
        try {
            // debugLog('Updating retro board settings', { boardId, settings })
            await retroDb.updateRetroBoardSettings(boardId, settings); // Use injected retroDb
            const board: RetroBoardDetails | null = await retroDb.getRetroBoard(boardId); // Use injected retroDb
            if (!board) { // Handle case where board might not be found after settings update
                socket.emit('error', { message: 'Board not found after updating settings.' } as SocketErrorPayload);
                return;
            }
            const roomName: string = `retro:${boardId}`;
            // debugLog('Emitting settings update', { roomName })
            io.to(roomName).emit('retroBoardUpdated', board);
        } catch (error: any) {
            socket.emit('error', { message: 'Failed to update settings' } as SocketErrorPayload);
        }
    });

    socket.on('changeRetroName', async (payload: RetroChangeNamePayload) => {
        const { boardId, newName } = payload;
        try {
            // debugLog('Changing name', { boardId, newName })
            const board: RetroBoardDetails | null = await retroDb.getRetroBoard(boardId); // Use injected retroDb
            if (!board) {
                socket.emit('error', { message: 'Board not found' } as SocketErrorPayload);
                return
            }

            const oldName: string | undefined = userNames.get(socket.id);
            userNames.set(socket.id, newName)

            // Update all cards by this author
            if (oldName) {
                const cards: RetroCard[] = board.cards.filter(card => card.author_name === oldName);
                for (const card of cards) { // card is implicitly RetroCard here
                    await retroDb.updateRetroCardAuthor(card.id, newName); // Use injected retroDb
                }
            }

            const updatedBoard: RetroBoardDetails | null = await retroDb.getRetroBoard(boardId); // Use injected retroDb
            if (!updatedBoard) { // Handle case where board might not be found after name change
                socket.emit('error', { message: 'Board not found after changing name.' } as SocketErrorPayload);
                return;
            }
            const roomName: string = `retro:${boardId}`;
            // debugLog('Emitting board update', { roomName })
            io.to(roomName).emit('retroBoardUpdated', updatedBoard);
        } catch (error: any) {
            socket.emit('error', { message: 'Failed to change name' } as SocketErrorPayload);
        }
    });

    socket.on('startTimer', async (payload: RetroStartTimerPayload) => {
        const { boardId } = payload;
        try {
            // debugLog('Starting timer', { boardId })
            await retroDb.startRetroTimer(boardId); // Use injected retroDb
            const board: RetroBoardDetails | null = await retroDb.getRetroBoard(boardId); // Use injected retroDb
            if (!board) { // Handle case where board might not be found
                socket.emit('error', { message: 'Board not found when starting timer.' } as SocketErrorPayload);
                return;
            }
            const roomName: string = `retro:${boardId}`;

            // Start a new timer interval
            if (activeTimers.has(boardId)) {
                clearInterval(activeTimers.get(boardId)!); // Use non-null assertion as we check with .has()
            }

            let timeLeft: number = board.default_timer;
            activeTimers.set(boardId, setInterval(async () => {
                timeLeft--
                await retroDb.updateRetroTimer(boardId, timeLeft); // Use injected retroDb
                io.to(roomName).emit('timerUpdate', { timeLeft })

                if (timeLeft <= 0) {
                    clearInterval(activeTimers.get(boardId)!); // Use non-null assertion
                    activeTimers.delete(boardId)
                    await retroDb.stopRetroTimer(boardId); // Use injected retroDb
                    io.to(roomName).emit('timerStopped')
                }
            }, 1000))

            // debugLog('Emitting timer start', { roomName, timeLeft: board.default_timer })
            io.to(roomName).emit('timerStarted', { timeLeft: board.default_timer });
        } catch (error: any) {
            socket.emit('error', { message: 'Failed to start timer' } as SocketErrorPayload);
        }
    });

    socket.on('stopTimer', async (payload: RetroStopTimerPayload) => {
        const { boardId } = payload;
        try {
            // debugLog('Stopping timer', { boardId })
            await retroDb.stopRetroTimer(boardId); // Use injected retroDb
            const roomName: string = `retro:${boardId}`;

            // Clear the timer interval
            if (activeTimers.has(boardId)) {
                clearInterval(activeTimers.get(boardId)!); // Use non-null assertion
                activeTimers.delete(boardId)
            }

            // debugLog('Emitting timer stop', { roomName })
            io.to(roomName).emit('timerStopped');
        } catch (error: any) {
            socket.emit('error', { message: 'Failed to stop timer' } as SocketErrorPayload);
        }
    });

    // Note: The 'disconnect' event is handled in initializeRetroSocket
};

// Initializes the retro namespace and handles connections/disconnections
export const initializeRetroSocket = (
    retroIo: TypedRetroNamespace,
    retroDb: RetroDbModule // Use the defined type
): void => {
    retroIo.on('connection', (socket: TypedSocket) => { // Type the socket
        // Handle specific retro events for this socket
        handleRetroSocketEvents(retroIo, socket, retroDb); // Pass the namespace instance (retroIo)

        // Handle disconnection
        socket.on('disconnect', () => {
            userNames.delete(socket.id);
        });
    });
};

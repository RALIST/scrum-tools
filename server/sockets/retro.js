import {
    getRetroBoard,
    addRetroCard,
    deleteRetroCard,
    startRetroTimer,
    stopRetroTimer,
    updateRetroTimer,
    verifyRetroBoardPassword,
    updateRetroBoardSettings,
    updateRetroCardAuthor,
    toggleRetroCardVote,
    updateRetroCardText
} from '../db/retro.js';
import logger from '../logger.js'; // Import the logger

// Store active timers and user names
const activeTimers = new Map()
const userNames = new Map() // socketId -> name
const boardVisibility = new Map(); // boardId -> hideCards

// Replace debugLog with direct logger calls or redefine it
// Let's redefine it for simplicity, using logger.debug
const debugLog = (message, data) => {
    logger.debug(message, data); // Use logger.debug
};

// Handles events for an individual connected socket
const handleRetroSocketEvents = (io, socket) => {
    socket.on('joinRetroBoard', async ({ boardId, name, password }) => {
        try {
            debugLog('Joining retro board', { boardId, name });
            // Store boardId in socket data for disconnect cleanup
            socket.data.boardId = boardId; 
            const board = await getRetroBoard(boardId)
            if (!board) {
                debugLog('Board not found', boardId)
                socket.emit('error', { message: 'Board not found' })
                return
            }

            // Verify password if board is password protected
            if (board.hasPassword) {
                const isValid = await verifyRetroBoardPassword(boardId, password)
                if (!isValid) {
                    socket.emit('error', { message: 'Invalid password' })
                    return
                }
            }

            const roomName = `retro:${boardId}`
            await socket.join(roomName)
            userNames.set(socket.id, name)
            debugLog('Socket joined room', { socketId: socket.id, roomName })

            // Send current visibility state
            const hideCards = boardVisibility.get(boardId) || false
            debugLog('Sending initial visibility state', { boardId, hideCards })
            io.to(roomName).emit('cardsVisibilityChanged', { hideCards })

            // If timer is running, emit timerStarted event with current time
            if (board.timer_running) {
                socket.emit('timerStarted', { timeLeft: board.time_left })
            }

            socket.emit('retroBoardJoined', board);
        } catch (error) {
            logger.error('Error joining retro board:', { boardId, name, socketId: socket.id, error: error.message, stack: error.stack });
            socket.emit('error', { message: 'Failed to join retro board' });
        }
    });

    socket.on('toggleCardsVisibility', async ({ boardId, hideCards }) => {
        try {
            debugLog('Toggling cards visibility', { boardId, hideCards })
            const roomName = `retro:${boardId}`

            // Update visibility state
            boardVisibility.set(boardId, hideCards)
            const currentState = boardVisibility.get(boardId)
            debugLog('Updated visibility state', { boardId, currentState })

            // Broadcast to all clients in the room
            debugLog('Broadcasting visibility change', { roomName, hideCards })
            io.to(roomName).emit('cardsVisibilityChanged', { hideCards });
        } catch (error) {
            logger.error('Error toggling retro cards visibility:', { boardId, hideCards, socketId: socket.id, error: error.message, stack: error.stack });
            socket.emit('error', { message: 'Failed to toggle cards visibility' });
        }
    });

    socket.on('addRetroCard', async ({ boardId, cardId, columnId, text, authorName }) => {
        try {
            debugLog('Adding retro card', { boardId, cardId, columnId, authorName })
            await addRetroCard(boardId, cardId, columnId, text, authorName)
            const board = await getRetroBoard(boardId)
            const roomName = `retro:${boardId}`
            debugLog('Emitting board update', { roomName })
            io.to(roomName).emit('retroBoardUpdated', board);
        } catch (error) {
            logger.error('Error adding retro card:', { boardId, cardId, columnId, authorName, socketId: socket.id, error: error.message, stack: error.stack });
            socket.emit('error', { message: 'Failed to add card' });
        }
    });

    socket.on('editRetroCard', async ({ boardId, cardId, text }) => {
        try {
            debugLog('Editing retro card', { boardId, cardId, text })
            await updateRetroCardText(cardId, text)
            const board = await getRetroBoard(boardId)
            const roomName = `retro:${boardId}`
            debugLog('Emitting board update', { roomName })
            io.to(roomName).emit('retroBoardUpdated', board);
        } catch (error) {
            logger.error('Error editing retro card:', { boardId, cardId, text, socketId: socket.id, error: error.message, stack: error.stack });
            socket.emit('error', { message: 'Failed to edit card' });
        }
    });

    socket.on('deleteRetroCard', async ({ boardId, cardId }) => {
        try {
            debugLog('Deleting retro card', { boardId, cardId })
            await deleteRetroCard(cardId)
            const board = await getRetroBoard(boardId)
            const roomName = `retro:${boardId}`
            debugLog('Emitting board update', { roomName })
            io.to(roomName).emit('retroBoardUpdated', board);
        } catch (error) {
            logger.error('Error deleting retro card:', { boardId, cardId, socketId: socket.id, error: error.message, stack: error.stack });
            socket.emit('error', { message: 'Failed to delete card' });
        }
    });

    socket.on('toggleVote', async ({ boardId, cardId }) => {
        try {
            debugLog('Toggling vote', { boardId, cardId })
            const userName = userNames.get(socket.id)
            if (!userName) {
                socket.emit('error', { message: 'User not found' })
                return
            }

            await toggleRetroCardVote(cardId, userName)
            const board = await getRetroBoard(boardId)
            const roomName = `retro:${boardId}`
            debugLog('Emitting board update', { roomName })
            io.to(roomName).emit('retroBoardUpdated', board);
        } catch (error) {
            logger.error('Error toggling retro vote:', { boardId, cardId, userName: userNames.get(socket.id), socketId: socket.id, error: error.message, stack: error.stack });
            socket.emit('error', { message: 'Failed to toggle vote' });
        }
    });

    socket.on('updateSettings', async ({ boardId, settings }) => {
        try {
            debugLog('Updating retro board settings', { boardId, settings })
            await updateRetroBoardSettings(boardId, settings)
            const board = await getRetroBoard(boardId)
            const roomName = `retro:${boardId}`
            debugLog('Emitting settings update', { roomName })
            io.to(roomName).emit('retroBoardUpdated', board);
        } catch (error) {
            logger.error('Error updating retro board settings:', { boardId, settings, socketId: socket.id, error: error.message, stack: error.stack });
            socket.emit('error', { message: 'Failed to update settings' });
        }
    });

    socket.on('changeRetroName', async ({ boardId, newName }) => {
        try {
            debugLog('Changing name', { boardId, newName })
            const board = await getRetroBoard(boardId)
            if (!board) {
                socket.emit('error', { message: 'Board not found' })
                return
            }

            const oldName = userNames.get(socket.id)
            userNames.set(socket.id, newName)

            // Update all cards by this author
            if (oldName) {
                const cards = board.cards.filter(card => card.author_name === oldName)
                for (const card of cards) {
                    await updateRetroCardAuthor(card.id, newName)
                }
            }

            const updatedBoard = await getRetroBoard(boardId)
            const roomName = `retro:${boardId}`
            debugLog('Emitting board update', { roomName })
            io.to(roomName).emit('retroBoardUpdated', updatedBoard);
        } catch (error) {
            logger.error('Error changing retro participant name:', { boardId, newName, oldName, socketId: socket.id, error: error.message, stack: error.stack });
            socket.emit('error', { message: 'Failed to change name' });
        }
    });

    socket.on('startTimer', async ({ boardId }) => {
        try {
            debugLog('Starting timer', { boardId })
            await startRetroTimer(boardId)
            const board = await getRetroBoard(boardId)
            const roomName = `retro:${boardId}`

            // Start a new timer interval
            if (activeTimers.has(boardId)) {
                clearInterval(activeTimers.get(boardId))
            }

            let timeLeft = board.default_timer
            activeTimers.set(boardId, setInterval(async () => {
                timeLeft--
                await updateRetroTimer(boardId, timeLeft)
                io.to(roomName).emit('timerUpdate', { timeLeft })

                if (timeLeft <= 0) {
                    clearInterval(activeTimers.get(boardId))
                    activeTimers.delete(boardId)
                    await stopRetroTimer(boardId)
                    io.to(roomName).emit('timerStopped')
                }
            }, 1000))

            debugLog('Emitting timer start', { roomName, timeLeft: board.default_timer })
            io.to(roomName).emit('timerStarted', { timeLeft: board.default_timer });
        } catch (error) {
            logger.error('Error starting retro timer:', { boardId, socketId: socket.id, error: error.message, stack: error.stack });
            socket.emit('error', { message: 'Failed to start timer' });
        }
    });

    socket.on('stopTimer', async ({ boardId }) => {
        try {
            debugLog('Stopping timer', { boardId })
            await stopRetroTimer(boardId)
            const roomName = `retro:${boardId}`

            // Clear the timer interval
            if (activeTimers.has(boardId)) {
                clearInterval(activeTimers.get(boardId))
                activeTimers.delete(boardId)
            }

            debugLog('Emitting timer stop', { roomName })
            io.to(roomName).emit('timerStopped');
        } catch (error) {
            logger.error('Error stopping retro timer:', { boardId, socketId: socket.id, error: error.message, stack: error.stack });
            socket.emit('error', { message: 'Failed to stop timer' });
        }
    });

    // Note: The 'disconnect' event is handled in initializeRetroSocket
};

// Initializes the retro namespace and handles connections/disconnections
export const initializeRetroSocket = (io) => {
    io.on('connection', (socket) => {
        logger.info(`User connected to retro: ${socket.id}`);

        // Handle specific retro events for this socket
        handleRetroSocketEvents(io, socket);

        // Handle disconnection
        socket.on('disconnect', () => {
            const userName = userNames.get(socket.id);
            const boardId = socket.data.boardId; // Retrieve boardId stored during joinRetroBoard
            logger.info(`Retro socket disconnected: ${socket.id}`, { userName, boardId });
            userNames.delete(socket.id);


            // Optional: Add logic here if you need to notify others or clean up
            // board-specific state (like timers or visibility) when a user disconnects,
            // especially if they were the last user in the room.
            if (boardId && userName) {
                 logger.info(`User ${userName} (${socket.id}) disconnected from retro board ${boardId}`);
                 // Example: Notify others (if needed)
                 // const roomName = `retro:${boardId}`;
                 // io.to(roomName).emit('userLeft', { userName });
            } else {
                 logger.warn(`User ${socket.id} disconnected from retro (no specific board info found).`);
            }

            // Clean up timers if the disconnected user was potentially the one running it?
            // This might need more robust logic depending on how timers are managed.
            // If timers are board-specific, check if the room is now empty.
        });
    });
};

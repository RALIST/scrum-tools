const activeTimers = new Map()
const userNames = new Map() // socketId -> name
const boardVisibility = new Map(); // boardId -> hideCards

// Handles events for an individual connected socket
const handleRetroSocketEvents = (io, socket, retroDb) => { // Add retroDb dependency
    socket.on('joinRetroBoard', async ({ boardId, name, password }) => {
        try {
            // debugLog('Joining retro board', { boardId, name });
            // Store boardId in socket data for disconnect cleanup
            socket.data.boardId = boardId; 
            const board = await retroDb.getRetroBoard(boardId); // Use injected retroDb
            if (!board) {
                // debugLog('Board not found', boardId)
                socket.emit('error', { message: 'Board not found' })
                return
            }

            // Verify password if board is password protected
            if (board.hasPassword) {
                const isValid = await retroDb.verifyRetroBoardPassword(boardId, password); // Use injected retroDb
                if (!isValid) {
                    socket.emit('error', { message: 'Invalid password' })
                    return
                }
            }

            const roomName = `retro:${boardId}`
            await socket.join(roomName)
            userNames.set(socket.id, name)
            // debugLog('Socket joined room', { socketId: socket.id, roomName })

            // Send current visibility state
            const hideCards = boardVisibility.get(boardId) || false
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
         } catch (error) {
            socket.emit('error', { message: 'Failed to join retro board' });
        }
    });

    socket.on('toggleCardsVisibility', async ({ boardId, hideCards }) => {
        try {
            // debugLog('Toggling cards visibility', { boardId, hideCards })
            const roomName = `retro:${boardId}`

            // Update visibility state
            boardVisibility.set(boardId, hideCards)
            const currentState = boardVisibility.get(boardId)
            // debugLog('Updated visibility state', { boardId, currentState })

            // Broadcast to all clients in the room
            // debugLog('Broadcasting visibility change', { roomName, hideCards })
            io.to(roomName).emit('cardsVisibilityChanged', { hideCards: currentState }); // Broadcast confirmed state
        } catch (error) {
            socket.emit('error', { message: 'Failed to toggle cards visibility' });
        }
    });

    socket.on('addRetroCard', async ({ boardId, cardId, columnId, text /*, authorName - Ignored */ }) => {
        try {
            const userName = userNames.get(socket.id); // Get author name from server-side map
            if (!userName) {
                // debugLog('Add card failed: User name not found for socket', { socketId: socket.id });
                socket.emit('error', { message: 'Cannot add card: User not identified.' });
                return;
            }
            // debugLog('Adding retro card', { boardId, cardId, columnId, authorName: userName }); // Log the correct name
            await retroDb.addRetroCard(boardId, cardId, columnId, text, userName); // Use injected retroDb
            const board = await retroDb.getRetroBoard(boardId); // Use injected retroDb
            const roomName = `retro:${boardId}`;
            // debugLog('Emitting board update', { roomName });
            io.to(roomName).emit('retroBoardUpdated', board);
        } catch (error) {
            // Log the error with the retrieved userName if available
            const userName = userNames.get(socket.id);
            socket.emit('error', { message: 'Failed to add card' });
        }
    });

    socket.on('editRetroCard', async ({ boardId, cardId, text }) => {
        try {
            // debugLog('Editing retro card', { boardId, cardId, text })
            await retroDb.updateRetroCardText(cardId, text); // Use injected retroDb
            const board = await retroDb.getRetroBoard(boardId); // Use injected retroDb
            const roomName = `retro:${boardId}`
            // debugLog('Emitting board update', { roomName })
            io.to(roomName).emit('retroBoardUpdated', board);
        } catch (error) {
            socket.emit('error', { message: 'Failed to edit card' });
        }
    });

    socket.on('deleteRetroCard', async ({ boardId, cardId }) => {
        try {
            // debugLog('Deleting retro card', { boardId, cardId })
            await retroDb.deleteRetroCard(cardId); // Use injected retroDb
            const board = await retroDb.getRetroBoard(boardId); // Use injected retroDb
            const roomName = `retro:${boardId}`
            // debugLog('Emitting board update', { roomName })
            io.to(roomName).emit('retroBoardUpdated', board);
        } catch (error) {
            socket.emit('error', { message: 'Failed to delete card' });
        }
    });

    socket.on('toggleVote', async ({ boardId, cardId }) => {
        try {
            // debugLog('Toggling vote', { boardId, cardId })
            const userName = userNames.get(socket.id)
            if (!userName) {
                socket.emit('error', { message: 'User not found' })
                return
            }

            await retroDb.toggleRetroCardVote(cardId, userName); // Use injected retroDb
            const board = await retroDb.getRetroBoard(boardId); // Use injected retroDb
            const roomName = `retro:${boardId}`
            // debugLog('Emitting board update', { roomName })
            io.to(roomName).emit('retroBoardUpdated', board);
        } catch (error) {
            socket.emit('error', { message: 'Failed to toggle vote' });
        }
    });

    socket.on('updateSettings', async ({ boardId, settings }) => {
        try {
            // debugLog('Updating retro board settings', { boardId, settings })
            await retroDb.updateRetroBoardSettings(boardId, settings); // Use injected retroDb
            const board = await retroDb.getRetroBoard(boardId); // Use injected retroDb
            const roomName = `retro:${boardId}`
            // debugLog('Emitting settings update', { roomName })
            io.to(roomName).emit('retroBoardUpdated', board);
        } catch (error) {
            socket.emit('error', { message: 'Failed to update settings' });
        }
    });

    socket.on('changeRetroName', async ({ boardId, newName }) => {
        try {
            // debugLog('Changing name', { boardId, newName })
            const board = await retroDb.getRetroBoard(boardId); // Use injected retroDb
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
                    await retroDb.updateRetroCardAuthor(card.id, newName); // Use injected retroDb
                }
            }

            const updatedBoard = await retroDb.getRetroBoard(boardId); // Use injected retroDb
            const roomName = `retro:${boardId}`
            // debugLog('Emitting board update', { roomName })
            io.to(roomName).emit('retroBoardUpdated', updatedBoard);
        } catch (error) {
            socket.emit('error', { message: 'Failed to change name' });
        }
    });

    socket.on('startTimer', async ({ boardId }) => {
        try {
            // debugLog('Starting timer', { boardId })
            await retroDb.startRetroTimer(boardId); // Use injected retroDb
            const board = await retroDb.getRetroBoard(boardId); // Use injected retroDb
            const roomName = `retro:${boardId}`

            // Start a new timer interval
            if (activeTimers.has(boardId)) {
                clearInterval(activeTimers.get(boardId))
            }

            let timeLeft = board.default_timer
            activeTimers.set(boardId, setInterval(async () => {
                timeLeft--
                await retroDb.updateRetroTimer(boardId, timeLeft); // Use injected retroDb
                io.to(roomName).emit('timerUpdate', { timeLeft })

                if (timeLeft <= 0) {
                    clearInterval(activeTimers.get(boardId))
                    activeTimers.delete(boardId)
                    await retroDb.stopRetroTimer(boardId); // Use injected retroDb
                    io.to(roomName).emit('timerStopped')
                }
            }, 1000))

            // debugLog('Emitting timer start', { roomName, timeLeft: board.default_timer })
            io.to(roomName).emit('timerStarted', { timeLeft: board.default_timer });
        } catch (error) {
            socket.emit('error', { message: 'Failed to start timer' });
        }
    });

    socket.on('stopTimer', async ({ boardId }) => {
        try {
            // debugLog('Stopping timer', { boardId })
            await retroDb.stopRetroTimer(boardId); // Use injected retroDb
            const roomName = `retro:${boardId}`

            // Clear the timer interval
            if (activeTimers.has(boardId)) {
                clearInterval(activeTimers.get(boardId))
                activeTimers.delete(boardId)
            }

            // debugLog('Emitting timer stop', { roomName })
            io.to(roomName).emit('timerStopped');
        } catch (error) {
            socket.emit('error', { message: 'Failed to stop timer' });
        }
    });

    // Note: The 'disconnect' event is handled in initializeRetroSocket
};

// Initializes the retro namespace and handles connections/disconnections
export const initializeRetroSocket = (retroIo, retroDb) => { // Expecting the namespace instance (retroIo)
    retroIo.on('connection', (socket) => { // Listen directly on the passed namespace instance
        // Handle specific retro events for this socket
        handleRetroSocketEvents(retroIo, socket, retroDb); // Pass the namespace instance (retroIo)

        // Handle disconnection
        socket.on('disconnect', () => {
            const userName = userNames.get(socket.id);
            const boardId = socket.data.boardId; // Retrieve boardId stored during joinRetroBoard
            userNames.delete(socket.id);
        });
    });
};

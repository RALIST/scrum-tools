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
    toggleRetroCardVote
} from '../db/retro.js'

// Store active timers and user names
const activeTimers = new Map()
const userNames = new Map() // socketId -> name
const boardVisibility = new Map() // boardId -> hideCards

const debugLog = (message, data) => {
    console.log(`[DEBUG] ${message}:`, data)
}

export const handleRetroBoardEvents = (io, socket) => {
    socket.on('joinRetroBoard', async ({ boardId, name, password }) => {
        try {
            debugLog('Joining retro board', { boardId, name })
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

            socket.emit('retroBoardJoined', board)
        } catch (error) {
            console.error('Error joining retro board:', error)
            socket.emit('error', { message: 'Failed to join retro board' })
        }
    })

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
            io.to(roomName).emit('cardsVisibilityChanged', { hideCards })
        } catch (error) {
            console.error('Error toggling cards visibility:', error)
            socket.emit('error', { message: 'Failed to toggle cards visibility' })
        }
    })

    socket.on('addRetroCard', async ({ boardId, cardId, columnId, text, authorName }) => {
        try {
            debugLog('Adding retro card', { boardId, cardId, columnId, authorName })
            await addRetroCard(boardId, cardId, columnId, text, authorName)
            const board = await getRetroBoard(boardId)
            const roomName = `retro:${boardId}`
            debugLog('Emitting board update', { roomName })
            io.to(roomName).emit('retroBoardUpdated', board)
        } catch (error) {
            console.error('Error adding retro card:', error)
            socket.emit('error', { message: 'Failed to add card' })
        }
    })

    socket.on('deleteRetroCard', async ({ boardId, cardId }) => {
        try {
            debugLog('Deleting retro card', { boardId, cardId })
            await deleteRetroCard(cardId)
            const board = await getRetroBoard(boardId)
            const roomName = `retro:${boardId}`
            debugLog('Emitting board update', { roomName })
            io.to(roomName).emit('retroBoardUpdated', board)
        } catch (error) {
            console.error('Error deleting retro card:', error)
            socket.emit('error', { message: 'Failed to delete card' })
        }
    })

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
            io.to(roomName).emit('retroBoardUpdated', board)
        } catch (error) {
            console.error('Error toggling vote:', error)
            socket.emit('error', { message: 'Failed to toggle vote' })
        }
    })

    socket.on('updateSettings', async ({ boardId, settings }) => {
        try {
            debugLog('Updating retro board settings', { boardId, settings })
            await updateRetroBoardSettings(boardId, settings)
            const board = await getRetroBoard(boardId)
            const roomName = `retro:${boardId}`
            debugLog('Emitting settings update', { roomName })
            io.to(roomName).emit('retroBoardUpdated', board)
        } catch (error) {
            console.error('Error updating retro board settings:', error)
            socket.emit('error', { message: 'Failed to update settings' })
        }
    })

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
            io.to(roomName).emit('retroBoardUpdated', updatedBoard)
        } catch (error) {
            console.error('Error changing name:', error)
            socket.emit('error', { message: 'Failed to change name' })
        }
    })

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
            io.to(roomName).emit('timerStarted', { timeLeft: board.default_timer })
        } catch (error) {
            console.error('Error starting timer:', error)
            socket.emit('error', { message: 'Failed to start timer' })
        }
    })

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
            io.to(roomName).emit('timerStopped')
        } catch (error) {
            console.error('Error stopping timer:', error)
            socket.emit('error', { message: 'Failed to stop timer' })
        }
    })

    socket.on('disconnect', () => {
        debugLog('Socket disconnected', { socketId: socket.id })
        userNames.delete(socket.id)
    })
}

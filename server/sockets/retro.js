import {
    getRetroBoard,
    addRetroCard,
    deleteRetroCard,
    startRetroTimer,
    stopRetroTimer,
    updateRetroTimer,
    verifyRetroBoardPassword,
    updateRetroBoardSettings
} from '../db/retro.js'

// Store active timers
const activeTimers = new Map()

export const handleRetroBoardEvents = (io, socket) => {
    socket.on('joinRetroBoard', async ({ boardId, password }) => {
        try {
            console.log('Joining retro board:', boardId)
            const board = await getRetroBoard(boardId)
            if (!board) {
                console.log('Board not found:', boardId)
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
            console.log(`Socket ${socket.id} joined room:`, roomName)

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

    socket.on('addRetroCard', async ({ boardId, cardId, columnId, text, authorName }) => {
        try {
            console.log('Adding retro card:', { boardId, cardId, columnId, text, authorName })
            await addRetroCard(boardId, cardId, columnId, text, authorName)
            const board = await getRetroBoard(boardId)
            const roomName = `retro:${boardId}`
            console.log('Emitting board update to room:', roomName)
            io.to(roomName).emit('retroBoardUpdated', board)
        } catch (error) {
            console.error('Error adding retro card:', error)
            socket.emit('error', { message: 'Failed to add card' })
        }
    })

    socket.on('deleteRetroCard', async ({ boardId, cardId }) => {
        try {
            console.log('Deleting retro card:', { boardId, cardId })
            await deleteRetroCard(cardId)
            const board = await getRetroBoard(boardId)
            const roomName = `retro:${boardId}`
            console.log('Emitting board update to room:', roomName)
            io.to(roomName).emit('retroBoardUpdated', board)
        } catch (error) {
            console.error('Error deleting retro card:', error)
            socket.emit('error', { message: 'Failed to delete card' })
        }
    })

    socket.on('updateSettings', async ({ boardId, settings }) => {
        try {
            console.log('Updating retro board settings:', { boardId, settings })
            await updateRetroBoardSettings(boardId, settings)
            const board = await getRetroBoard(boardId)
            const roomName = `retro:${boardId}`
            console.log('Emitting settings update to room:', roomName)
            io.to(roomName).emit('retroBoardUpdated', board)
        } catch (error) {
            console.error('Error updating retro board settings:', error)
            socket.emit('error', { message: 'Failed to update settings' })
        }
    })

    socket.on('startTimer', async ({ boardId }) => {
        try {
            console.log('Starting timer for board:', boardId)
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

            console.log('Emitting timer start to room:', roomName)
            io.to(roomName).emit('timerStarted', { timeLeft: board.default_timer })
        } catch (error) {
            console.error('Error starting timer:', error)
            socket.emit('error', { message: 'Failed to start timer' })
        }
    })

    socket.on('stopTimer', async ({ boardId }) => {
        try {
            console.log('Stopping timer for board:', boardId)
            await stopRetroTimer(boardId)
            const roomName = `retro:${boardId}`

            // Clear the timer interval
            if (activeTimers.has(boardId)) {
                clearInterval(activeTimers.get(boardId))
                activeTimers.delete(boardId)
            }

            console.log('Emitting timer stop to room:', roomName)
            io.to(roomName).emit('timerStopped')
        } catch (error) {
            console.error('Error stopping timer:', error)
            socket.emit('error', { message: 'Failed to stop timer' })
        }
    })
}

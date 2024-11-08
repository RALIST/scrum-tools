import bcrypt from 'bcryptjs'
import {
    getRoom,
    addParticipant,
    updateParticipantName,
    updateParticipantVote,
    removeParticipant,
    resetVotes,
    updateRoomSettings
} from '../db/poker.js'

export const handlePlanningPokerEvents = (io, socket) => {
    socket.on('joinRoom', async ({ roomId, userName, password }) => {
        try {
            const room = await getRoom(roomId)
            if (!room) {
                socket.emit('error', { message: 'Room not found' })
                return
            }

            if (room.password) {
                const isValid = await bcrypt.compare(password, room.password)
                if (!isValid) {
                    socket.emit('error', { message: 'Invalid password' })
                    return
                }
            }

            await addParticipant(roomId, socket.id, userName)
            const updatedRoom = await getRoom(roomId)

            socket.join(roomId)

            io.to(roomId).emit('roomJoined', {
                participants: Array.from(updatedRoom.participants.values()),
                settings: {
                    sequence: updatedRoom.sequence,
                    hasPassword: !!updatedRoom.password
                }
            })

            console.log(`${userName} joined room ${roomId}`)
        } catch (error) {
            console.error('Error joining room:', error)
            socket.emit('error', { message: 'Failed to join room' })
        }
    })

    socket.on('updateSettings', async ({ roomId, settings }) => {
        try {
            let hashedPassword = undefined
            if (settings.password) {
                hashedPassword = await bcrypt.hash(settings.password, 10)
            }

            await updateRoomSettings(roomId, settings.sequence, hashedPassword)
            const updatedRoom = await getRoom(roomId)

            io.to(roomId).emit('settingsUpdated', {
                settings: {
                    sequence: updatedRoom.sequence,
                    hasPassword: !!updatedRoom.password
                }
            })
        } catch (error) {
            console.error('Error updating settings:', error)
            socket.emit('error', { message: 'Failed to update settings' })
        }
    })

    socket.on('changeName', async ({ roomId, newName }) => {
        try {
            await updateParticipantName(roomId, socket.id, newName)
            const room = await getRoom(roomId)

            io.to(roomId).emit('participantUpdate', {
                participants: Array.from(room.participants.values())
            })

            console.log(`User ${socket.id} changed name to ${newName} in room ${roomId}`)
        } catch (error) {
            console.error('Error changing name:', error)
            socket.emit('error', { message: 'Failed to change name' })
        }
    })

    socket.on('vote', async ({ roomId, vote }) => {
        try {
            await updateParticipantVote(roomId, socket.id, vote)
            const room = await getRoom(roomId)

            io.to(roomId).emit('participantUpdate', {
                participants: Array.from(room.participants.values())
            })
        } catch (error) {
            console.error('Error voting:', error)
            socket.emit('error', { message: 'Failed to record vote' })
        }
    })

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
            })
        } catch (error) {
            console.error('Error resetting votes:', error)
            socket.emit('error', { message: 'Failed to reset votes' })
        }
    })
}

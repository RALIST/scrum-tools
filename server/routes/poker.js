import express from 'express'
import bcrypt from 'bcryptjs'
import { createRoom, getRooms, getRoom } from '../db/poker.js'

const router = express.Router()

router.get('/rooms', async (req, res) => {
    try {
        const rooms = await getRooms()
        const roomList = rooms.map(room => ({
            id: room.id,
            name: room.name,
            participantCount: parseInt(room.participant_count),
            createdAt: room.created_at,
            hasPassword: !!room.password,
            sequence: room.sequence
        }))
        res.json(roomList)
    } catch (error) {
        console.error('Error getting rooms:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

router.post('/rooms', async (req, res) => {
    const { roomId, name, password, sequence } = req.body
    try {
        const room = await getRoom(roomId)
        if (room) {
            return res.status(400).json({ error: 'Room already exists' })
        }

        const hashedPassword = password ? await bcrypt.hash(password, 10) : null
        await createRoom(roomId, name, sequence, hashedPassword)

        res.json({
            success: true,
            roomId,
            hasPassword: !!hashedPassword,
            sequence: sequence || 'fibonacci'
        })
    } catch (error) {
        console.error('Error creating room:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

router.post('/rooms/:roomId/verify-password', async (req, res) => {
    const { roomId } = req.params
    const { password } = req.body

    try {
        const room = await getRoom(roomId)
        if (!room) {
            return res.status(404).json({ error: 'Room not found' })
        }

        if (!room.password) {
            return res.json({ valid: true })
        }

        const isValid = await bcrypt.compare(password, room.password)
        res.json({ valid: isValid })
    } catch (error) {
        console.error('Error verifying password:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

export default router

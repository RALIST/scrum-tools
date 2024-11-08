import express from 'express'
import { createRetroBoard, getRetroBoard } from '../db/retro.js'

const router = express.Router()

router.post('/retro', async (req, res) => {
    const boardId = Math.random().toString(36).substring(2, 8)
    const { name } = req.body

    try {
        await createRetroBoard(boardId, name)
        res.json({ success: true, boardId })
    } catch (error) {
        console.error('Error creating retro board:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

router.get('/retro/:boardId', async (req, res) => {
    const { boardId } = req.params

    try {
        const board = await getRetroBoard(boardId)
        if (!board) {
            return res.status(404).json({ error: 'Board not found' })
        }
        res.json(board)
    } catch (error) {
        console.error('Error getting retro board:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

export default router

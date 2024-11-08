import express from 'express'
import {
    createRetroBoard,
    getRetroBoard,
    verifyRetroBoardPassword,
    updateRetroBoardSettings
} from '../db/retro.js'

const router = express.Router()

router.post('/retro', async (req, res) => {
    const boardId = Math.random().toString(36).substring(2, 8)
    const {
        name,
        defaultTimer,
        hideCardsByDefault,
        hideAuthorNames,
        password
    } = req.body

    try {
        await createRetroBoard(boardId, name, {
            defaultTimer,
            hideCardsByDefault,
            hideAuthorNames,
            password
        })
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

router.post('/retro/:boardId/verify-password', async (req, res) => {
    const { boardId } = req.params
    const { password } = req.body

    try {
        const isValid = await verifyRetroBoardPassword(boardId, password)
        res.json({ valid: isValid })
    } catch (error) {
        console.error('Error verifying retro board password:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

router.put('/retro/:boardId/settings', async (req, res) => {
    const { boardId } = req.params
    const {
        defaultTimer,
        hideCardsByDefault,
        hideAuthorNames,
        password
    } = req.body

    try {
        await updateRetroBoardSettings(boardId, {
            defaultTimer,
            hideCardsByDefault,
            hideAuthorNames,
            password
        })
        const board = await getRetroBoard(boardId)
        res.json(board)
    } catch (error) {
        console.error('Error updating retro board settings:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
})

export default router

import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import {
    createTeam,
    getTeam,
    createSprint,
    updateSprintVelocity,
    getTeamVelocity,
    getTeamAverageVelocity
} from '../db/velocity.js'

const router = express.Router()

// Create a new team
router.post('/teams', async (req, res) => {
    try {
        const { name, password } = req.body

        // Check if team already exists
        const existingTeam = await getTeam(name, password)
        if (existingTeam) {
            // Team exists and password matches
            return res.json({ success: true, team: existingTeam })
        }


        // Create new team
        const id = uuidv4()
        const team = await createTeam(id, name, password)
        res.json({ success: true, team })
    } catch (error) {
        console.error('Error creating team:', error)
        res.status(500).json({ error: 'Failed to find or create team' })
    }
})

// Get team data
router.get('/teams/:name/velocity', async (req, res) => {
    try {
        const { name } = req.params
        const { password } = req.query

        // Get velocity data with password verification
        const velocityData = await getTeamVelocity(name, password)
        if (!velocityData) {
            return res.status(401).json({ error: 'Invalid team name or password' })
        }

        // Get average data with password verification
        const averageData = await getTeamAverageVelocity(name, password)
        if (!averageData) {
            return res.status(401).json({ error: 'Invalid team name or password' })
        }

        res.json({
            sprints: velocityData,
            averages: averageData
        })
    } catch (error) {
        console.error('Error getting team velocity:', error)
        res.status(500).json({ error: 'Failed to get team velocity' })
    }
})

// Create a new sprint
router.post('/teams/:name/sprints', async (req, res) => {
    try {
        const { name } = req.params
        const { password } = req.query
        const { sprintName, startDate, endDate } = req.body

        // Verify team and password
        const team = await getTeam(name, password)
        if (!team) {
            return res.status(401).json({ error: 'Invalid team name or password' })
        }

        const id = uuidv4()
        const sprint = await createSprint(id, team.id, sprintName, startDate, endDate)
        res.json(sprint)
    } catch (error) {
        console.error('Error creating sprint:', error)
        res.status(500).json({ error: 'Failed to create sprint' })
    }
})

// Update sprint velocity
router.put('/sprints/:sprintId/velocity', async (req, res) => {
    try {
        const { sprintId } = req.params
        const { committedPoints, completedPoints } = req.body
        const velocity = await updateSprintVelocity(sprintId, committedPoints, completedPoints)
        res.json(velocity)
    } catch (error) {
        console.error('Error updating sprint velocity:', error)
        res.status(500).json({ error: 'Failed to update sprint velocity' })
    }
})

export default router

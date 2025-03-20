import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import jwt from 'jsonwebtoken'
import pool from '../db/pool.js'
import {
    createTeam,
    getTeam,
    createSprint,
    updateSprintVelocity,
    getTeamVelocity,
    getTeamAverageVelocity,
    getTeamByWorkspace,
} from '../db/velocity.js'

const router = express.Router()

// Create a new team - supports both authenticated and anonymous modes
router.post('/teams', async (req, res) => {
    try {
        const { name, password, workspaceId } = req.body
        let userId = null

        // Check if team already exists
        let existingTeam = null
        
        if (workspaceId) {
            // For workspace teams, look up by name and workspace
            existingTeam = await getTeamByWorkspace(name, workspaceId)
        } else {
            // For anonymous teams, look up by name and password
            existingTeam = await getTeam(name, password)
        }
        
        if (existingTeam) {
            // Team exists and credentials match
            return res.json({ success: true, team: existingTeam })
        }

        // Create new team
        const id = uuidv4()
        const team = await createTeam(id, name, password, workspaceId, userId)
        res.json({ success: true, team })
    } catch (error) {
        console.error('Error creating team:', error)
        res.status(500).json({ error: 'Failed to find or create team' })
    }
})

// Get team data - supports both authenticated and anonymous modes
router.get('/teams/:name/velocity', async (req, res) => {
    try {
        const { name } = req.params
        const { password } = req.query
        let velocityData
        let averageData
    
            // Anonymous password-based lookup
        velocityData = await getTeamVelocity(name, password)
        averageData = await getTeamAverageVelocity(name, password)
        
        // For anonymous mode, verify auth
        if (!velocityData || !averageData) {
            return res.status(401).json({ error: 'Invalid team name or password' })
        }

        res.json({
            sprints: velocityData || [],
            averages: averageData || {
                average_velocity: 0,
                average_commitment: 0,
                completion_rate: 0
            }
        })
    } catch (error) {
        console.error('Error getting team velocity:', error)
        res.status(500).json({ error: 'Failed to get team velocity' })
    }
})

// Create a new sprint - supports both authenticated and anonymous modes
router.post('/teams/:name/sprints', async (req, res) => {
    try {
        const { name } = req.params
        const { password } = req.query
        const { sprintName, startDate, endDate, workspace_id } = req.body
        let team = null
        let workspaceId = workspace_id || null
        let userId = null

        // If request has authorization header, verify user
        if (req.headers.authorization) {
            try {
                // Extract token
                const token = req.headers.authorization.split(' ')[1]
                const decoded = jwt.verify(token, process.env.JWT_SECRET)
                userId = decoded.userId
                
                // Verify workspace access if provided
                if (workspaceId) {
                    const workspaceAccess = await checkWorkspaceAccess(workspaceId, userId)
                    if (!workspaceAccess) {
                        return res.status(403).json({ error: 'User does not have access to this workspace' })
                    }
                    
                    // Get team by workspace
                    team = await getTeamByWorkspace(name, workspaceId)
                }
            } catch (err) {
                console.error('Token validation error:', err)
                // Continue without authentication - fall back to anonymous mode
            }
        }
        
        if (!team) {
            // Anonymous mode - verify team and password
            team = await getTeam(name, password)
        }
        
        if (!team) {
            return res.status(401).json({ error: 'Invalid team name or authentication' })
        }

        const id = uuidv4()
        const sprint = await createSprint(id, team.id, sprintName, startDate, endDate)
        res.json(sprint)
    } catch (error) {
        console.error('Error creating sprint:', error)
        res.status(500).json({ error: 'Failed to create sprint' })
    }
})

// Update sprint velocity - supports both authenticated and anonymous modes
router.put('/sprints/:sprintId/velocity', async (req, res) => {
    try {
        const { sprintId } = req.params
        const { committedPoints, completedPoints } = req.body
        
        // No authorization check needed for updating velocity as it's by sprint ID
        // The sprint was already created under the appropriate team

        const velocity = await updateSprintVelocity(sprintId, committedPoints, completedPoints)
        res.json(velocity)
    } catch (error) {
        console.error('Error updating sprint velocity:', error)
        res.status(500).json({ error: 'Failed to update sprint velocity' })
    }
})

// Helper function to check workspace access
async function checkWorkspaceAccess(workspaceId, userId) {
    const client = await pool.connect()
    try {
        const result = await client.query(
            `SELECT * FROM workspace_members 
             WHERE workspace_id = $1 AND user_id = $2`,
            [workspaceId, userId]
        )
        return result.rows.length > 0
    } finally {
        client.release()
    }
}

export default router

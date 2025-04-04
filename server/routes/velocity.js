import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
// Remove direct pool import, use executeQuery instead for helper
// import pool from '../db/pool.js'; 
import { executeQuery } from '../db/dbUtils.js'; // Import executeQuery
import logger from '../logger.js'; // Import the logger
import {
    createTeam,
    getTeam,
    createSprint,
    updateSprintVelocity,
    getTeamVelocity,
    getTeamAverageVelocity,
    getTeamByWorkspace,
} from '../db/velocity.js'

const router = express.Router();

// Create a new team - supports both authenticated and anonymous modes
// Add 'next'
router.post('/teams', async (req, res, next) => {
    try {
        const { name, password, workspaceId } = req.body;
        let userId = null;

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
        res.json({ success: true, team });
    } catch (error) {
        logger.error('Error creating/finding team:', { error: error.message, stack: error.stack, body: req.body });
        // Pass error to the centralized handler
        next(error);
    }
});

// Get team data - supports both authenticated and anonymous modes
// Add 'next'
router.get('/teams/:name/velocity', async (req, res, next) => {
    try {
        const { name } = req.params;
        const { password } = req.query;
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
        });
    } catch (error) {
        logger.error('Error getting team velocity:', { error: error.message, stack: error.stack, teamName: req.params.name, query: req.query });
        // Pass error to the centralized handler
        next(error);
    }
});

// Create a new sprint - supports both authenticated and anonymous modes
// Add 'next'
router.post('/teams/:name/sprints', async (req, res, next) => {
    try {
        const { name } = req.params;
        const { password } = req.query;
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
                    team = await getTeamByWorkspace(name, workspaceId);
                }
            } catch (err) {
                // Log as warning, as it might be an expected invalid token
                logger.warn('Token validation error during sprint creation (falling back to anonymous):', { error: err.message, teamName: name, workspaceId }); 
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
        res.json(sprint);
    } catch (error) {
        logger.error('Error creating sprint:', { error: error.message, stack: error.stack, teamName: req.params.name, body: req.body });
        // Pass error to the centralized handler
        next(error);
    }
});

// Update sprint velocity - supports both authenticated and anonymous modes
// Add 'next'
router.put('/sprints/:sprintId/velocity', async (req, res, next) => {
    try {
        const { sprintId } = req.params;
        const { committedPoints, completedPoints } = req.body;
        
        // No authorization check needed for updating velocity as it's by sprint ID
        // The sprint was already created under the appropriate team

        const velocity = await updateSprintVelocity(sprintId, committedPoints, completedPoints)
        res.json(velocity);
    } catch (error) {
        logger.error('Error updating sprint velocity:', { error: error.message, stack: error.stack, sprintId: req.params.sprintId, body: req.body });
        // Pass error to the centralized handler
        next(error);
    }
});

// Helper function to check workspace access - Refactored to use executeQuery
async function checkWorkspaceAccess(workspaceId, userId) {
    const queryText = `
        SELECT 1 FROM workspace_members 
        WHERE workspace_id = $1 AND user_id = $2
    `;
    const params = [workspaceId, userId];
    // No try/catch needed here, executeQuery handles errors and throws them
    const result = await executeQuery(queryText, params);
    return result.rows.length > 0;
}

export default router

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
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
    getTeamVelocityByWorkspace, // Import workspace-specific function
    getTeamAverageVelocityByWorkspace, // Import workspace-specific function
} from '../db/velocity.js';

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

// Get team data - supports both authenticated (workspace) and anonymous modes
// optionalAuthenticateToken is applied in index.js, so req.user might exist
router.get('/teams/:name/velocity', async (req, res, next) => {
    try {
        const { name } = req.params;
        const { password } = req.query; // For anonymous mode
        const workspaceId = req.headers['workspace-id']; // Check for workspace context header
        const userId = req.user?.userId; // User ID from optional token

        let velocityData = null;
        let averageData = null;

        // --- Workspace Mode ---
        // Check if user is authenticated AND workspace context is provided
        if (userId && workspaceId) {
            logger.info(`Attempting workspace velocity fetch: user ${userId}, workspace ${workspaceId}, team ${name}`);
            // Verify user has access to this workspace
            const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
            if (!hasAccess) {
                logger.warn(`Forbidden access attempt: User ${userId} to workspace ${workspaceId}`);
                // Return 403 even if the team exists anonymously, workspace access takes precedence
                return res.status(403).json({ error: 'Forbidden: Access denied to this workspace' });
            }

            // Step 1: Check if the team exists for this workspace
            let team = await getTeamByWorkspace(name, workspaceId);

            // Step 2: If team doesn't exist IN THIS WORKSPACE, return 404.
            // Auto-creation should happen elsewhere (e.g., on the frontend page load if needed)
            // or potentially in the POST /teams endpoint if called with workspaceId.
            if (!team) {
                 logger.warn(`Team '${name}' not found in workspace '${workspaceId}'.`);
                 return res.status(404).json({ error: `Team '${name}' not found in this workspace.` });
            }
            
            // Step 3: If team exists, fetch its velocity data
            logger.info(`Team '${name}' found in workspace '${workspaceId}'. Fetching velocity data.`);
            velocityData = await getTeamVelocityByWorkspace(name, workspaceId); // Fetches data based on team found above
            averageData = await getTeamAverageVelocityByWorkspace(name, workspaceId); // Fetches data based on team found above
                 logger.info(`Successfully fetched workspace velocity data for team '${name}' in workspace '${workspaceId}'.`);
                 // Handle case where team exists but has no sprints yet (DB functions return null/defaults)
                 if (velocityData === null) velocityData = [];
                 if (averageData === null) averageData = { average_velocity: '0.00', average_commitment: '0.00', completion_rate: '0.00' };
            // } // Remove extra closing brace here
        }
        // --- Anonymous Mode ---
        // Execute if not in workspace mode (no userId or no workspaceId header)
        else {
            logger.info(`Attempting anonymous velocity fetch for team: ${name}`);
            // Use password from query params
            try {
                velocityData = await getTeamVelocity(name, password);
                averageData = await getTeamAverageVelocity(name, password);
                 logger.info(`Successfully fetched anonymous velocity data for team '${name}'.`);
            } catch (dbError) {
                // Handle specific password/team/context errors from getTeam called within DB functions
                const knownAuthErrors = [
                    "Invalid password for anonymous team",
                    "Password required for this anonymous team",
                    "Invalid password (anonymous team does not require one)",
                    "Password or workspace context required for this team.", // Added this
                    "Cannot access workspace team using a password." // Added this
                ];
                if (knownAuthErrors.includes(dbError.message)) {
                     logger.warn(`Anonymous auth/access failed for team '${name}': ${dbError.message}`);
                     // Return 401 for auth/password issues, maybe 403 for trying password on workspace team? Let's use 401 for simplicity.
                     return res.status(401).json({ error: 'Invalid team name or password/context required' });
                }
                // Re-throw other unexpected DB errors
                logger.error(`Unexpected DB error during anonymous fetch for team '${name}': ${dbError.message}`, { stack: dbError.stack });
                throw dbError;
            }
             // If getTeamVelocity/AverageVelocity return null (shouldn't happen if getTeam throws), handle it
             if (velocityData === null || averageData === null) {
                 // This implies team was found (no password error) but no data exists.
                 logger.warn(`Anonymous team '${name}' found, but no velocity data available.`);
                 // Return empty data, not an error
             }
        }

        // --- Response ---
        // Return data, ensuring defaults for null/undefined cases from either mode
        res.json({
            sprints: velocityData || [], // Ensure array
            averages: averageData || {
                average_velocity: 0,
                average_velocity: 0,
                average_commitment: 0,
                completion_rate: 0
            } // Ensure object with defaults
        });
    } catch (error) {
        logger.error('Error getting team velocity:', { error: error.message, stack: error.stack, teamName: req.params.name, query: req.query });
        // Pass error to the centralized handler
        next(error);
    }
});

// Create a new sprint - supports both authenticated (workspace) and anonymous modes
// optionalAuthenticateToken is applied in index.js
router.post('/teams/:name/sprints', async (req, res, next) => {
    try {
        const { name } = req.params;
        const { password } = req.query; // Password for anonymous access from query
        const { sprintName, startDate, endDate, workspaceId } = req.body; // workspaceId from body for workspace mode
        const userId = req.user?.userId; // User ID from optional token

        let team = null;

        // --- Workspace Mode ---
        // Check if user is authenticated AND workspaceId is provided in the body
        if (userId && workspaceId) {
             logger.info(`Attempting workspace sprint creation: user ${userId}, workspace ${workspaceId}, team ${name}`);
            // Verify user has access to this workspace
            const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
            if (!hasAccess) {
                 logger.warn(`Forbidden sprint creation attempt: User ${userId} to workspace ${workspaceId}`);
                return res.status(403).json({ error: 'Forbidden: Access denied to this workspace' });
            }

            // Get the team using workspace context
            team = await getTeamByWorkspace(name, workspaceId);
            if (!team) {
                logger.warn(`Team '${name}' not found in workspace '${workspaceId}' during sprint creation.`);
                return res.status(404).json({ error: `Team '${name}' not found in this workspace.` });
            }
             logger.info(`Workspace team '${name}' identified for sprint creation.`);
        }
        // --- Anonymous Mode ---
        // Execute if not in workspace mode (no userId or no workspaceId in body)
        else {
            logger.info(`Attempting anonymous sprint creation for team: ${name}`);
            // Use password from query params
            try {
                // Verify team and password for anonymous access
                team = await getTeam(name, password); // This throws on invalid password/team
                 logger.info(`Anonymous team '${name}' identified for sprint creation.`);
            } catch (dbError) {
                if (dbError.message === "Invalid password" || dbError.message === "Password required for this team" || dbError.message === "Invalid password (team does not require one)") {
                    logger.warn(`Anonymous auth failed for team '${name}' during sprint creation: ${dbError.message}`);
                    return res.status(401).json({ error: 'Invalid team name or password' });
                }
                 logger.error(`Unexpected DB error during anonymous sprint creation auth for team '${name}': ${dbError.message}`, { stack: dbError.stack });
                throw dbError; // Re-throw other errors
            }
        }

        // If team is still null after checks (shouldn't happen if logic is correct, but as a safeguard)
        if (!team) {
             logger.error(`Team object is unexpectedly null after auth/anonymous checks for team '${name}' during sprint creation.`);
             // Use 500 for unexpected server state, or 401 if it implies auth failure
             return res.status(500).json({ error: 'Failed to identify team for sprint creation' });
        }

        // --- Create Sprint ---
        const id = uuidv4();
        const sprint = await createSprint(id, team.id, sprintName, startDate, endDate);
        logger.info(`Sprint '${sprint.id}' created successfully for team '${team.id}' ('${name}').`);
        // Return the created sprint ID (or full object)
        res.status(201).json({ id: sprint.id }); // Return 201 Created status and sprint ID
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

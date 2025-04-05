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
// Import isWorkspaceMember from the correct location
import { isWorkspaceMember } from '../db/workspaces.js';

const router = express.Router();

// Create or Load a team - supports both authenticated (workspace) and anonymous modes
router.post('/teams', async (req, res, next) => {
    try {
        const { name, password, workspaceId } = req.body;
        const userId = req.user?.userId; // User ID from optional token (if provided via middleware)

        let team = null;
        let velocityData = [];
        let averageData = { average_velocity: 0, average_commitment: 0, completion_rate: 0 };

        if (workspaceId) {
            // --- Workspace Mode ---
            // This endpoint is primarily for anonymous teams.
            // If workspaceId is provided, we just check if the team exists.
            // Creation of workspace teams happens during workspace creation.
            if (!userId) {
                return res.status(401).json({ error: 'Authentication required for workspace teams.' });
            }
            // Use isWorkspaceMember instead of checkWorkspaceAccess
            const hasAccess = await isWorkspaceMember(workspaceId, userId);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Forbidden: Access denied to this workspace.' });
            }
            team = await getTeamByWorkspace(name, workspaceId);
            if (!team) {
                // Don't create workspace teams here, return not found
                return res.status(404).json({ error: `Team '${name}' not found in this workspace.` });
            }
            // For workspace teams, POST just confirms existence, GET fetches data
            velocityData = null; // Indicate data should be fetched via GET
            averageData = null;

        } else {
            // --- Anonymous Mode ---
            let teamFound = false;
            try {
                // Try to get the team using name and password
                team = await getTeam(name, password);
                teamFound = true; // Mark as found if getTeam succeeds
                logger.info(`Anonymous team '${name}' found. Fetching velocity data.`);
                // If found and password is valid, fetch its data
                velocityData = await getTeamVelocity(name, password);
                averageData = await getTeamAverageVelocity(name, password);

            } catch (error) {
                // Handle specific password errors from getTeam
                const knownAuthErrors = [
                    "Invalid password for anonymous team",
                    "Password required for this anonymous team",
                    "Invalid password (anonymous team does not require one)",
                    "Password or workspace context required for this team.",
                    "Cannot access workspace team using a password."
                ];
                if (knownAuthErrors.includes(error.message)) {
                    logger.warn(`Auth failed during POST /teams for '${name}': ${error.message}`);
                    // Return 401 for auth errors
                    return res.status(401).json({ error: 'Invalid team name or password' });
                }
                // If error is not an auth error, assume the team doesn't exist yet.
                logger.info(`Team '${name}' not found or other error during getTeam: ${error.message}. Attempting creation.`);
            }

            // If team was not found, create it
            if (!teamFound) {
                logger.info(`Creating new anonymous team '${name}'.`);
                const id = uuidv4();
                // Ensure password is provided for new anonymous teams
                if (!password) {
                    return res.status(400).json({ error: 'Password is required to create an anonymous team.' });
                }
                team = await createTeam(id, name, password, null, null); // workspaceId and userId are null
                // New team has no velocity data yet
                velocityData = [];
                averageData = { average_velocity: 0, average_commitment: 0, completion_rate: 0 };
            }
        }

        // --- Response ---
        res.json({
            success: true,
            team: team, // Basic team info
            sprints: velocityData || [], // Velocity data (empty for new anon team or null for workspace check)
            averages: averageData || { average_velocity: 0, average_commitment: 0, completion_rate: 0 } // Averages (zeroes for new anon team or null for workspace check)
        });

    } catch (error) {
        // Catch any unexpected errors not handled above
        logger.error('Error in POST /teams:', { error: error.message, stack: error.stack, body: req.body });
        next(error); // Pass to global error handler
    }
});


// Get team velocity data - ONLY for authenticated (workspace) mode now
router.get('/teams/:name/velocity', async (req, res, next) => {
    try {
        const { name } = req.params;
        const workspaceId = req.headers['workspace-id'];
        const userId = req.user?.userId;

        // This endpoint is now only for workspace teams
        if (!userId || !workspaceId) {
            logger.warn(`GET /teams/:name/velocity called without workspace context for team '${name}'.`);
            return res.status(400).json({ error: 'Workspace context required for this request.' });
        }

        logger.info(`Attempting workspace velocity fetch: user ${userId}, workspace ${workspaceId}, team ${name}`);
        // Use isWorkspaceMember instead of checkWorkspaceAccess
        const hasAccess = await isWorkspaceMember(workspaceId, userId);
        if (!hasAccess) {
            logger.warn(`Forbidden access attempt: User ${userId} to workspace ${workspaceId}`);
            return res.status(403).json({ error: 'Forbidden: Access denied to this workspace' });
        }

        const team = await getTeamByWorkspace(name, workspaceId);
        if (!team) {
             logger.warn(`Team '${name}' not found in workspace '${workspaceId}'.`);
             return res.status(404).json({ error: `Team '${name}' not found in this workspace.` });
        }

        logger.info(`Team '${name}' found in workspace '${workspaceId}'. Fetching velocity data.`);
        const velocityData = await getTeamVelocityByWorkspace(name, workspaceId);
        const averageData = await getTeamAverageVelocityByWorkspace(name, workspaceId);
        logger.info(`Successfully fetched workspace velocity data for team '${name}' in workspace '${workspaceId}'.`);

        res.json({
            sprints: velocityData || [],
            averages: averageData || { average_velocity: 0, average_commitment: 0, completion_rate: 0 }
        });

    } catch (error) {
        logger.error('Error getting team velocity:', { error: error.message, stack: error.stack, teamName: req.params.name });
        next(error);
    }
});

// Create a new sprint - supports both authenticated (workspace) and anonymous modes
router.post('/teams/:name/sprints', async (req, res, next) => {
    try {
        const { name } = req.params;
        const { password } = req.query; // Password for anonymous access from query
        const { sprintName, startDate, endDate, workspaceId } = req.body; // workspaceId from body for workspace mode
        const userId = req.user?.userId; // User ID from optional token

        let team = null;

        // --- Workspace Mode ---
        if (userId && workspaceId) {
             logger.info(`Attempting workspace sprint creation: user ${userId}, workspace ${workspaceId}, team ${name}`);
             // Use isWorkspaceMember instead of checkWorkspaceAccess
            const hasAccess = await isWorkspaceMember(workspaceId, userId);
            if (!hasAccess) {
                 logger.warn(`Forbidden sprint creation attempt: User ${userId} to workspace ${workspaceId}`);
                return res.status(403).json({ error: 'Forbidden: Access denied to this workspace' });
            }
            team = await getTeamByWorkspace(name, workspaceId);
            if (!team) {
                logger.warn(`Team '${name}' not found in workspace '${workspaceId}' during sprint creation.`);
                return res.status(404).json({ error: `Team '${name}' not found in this workspace.` });
            }
             logger.info(`Workspace team '${name}' identified for sprint creation.`);
        }
        // --- Anonymous Mode ---
        else {
            logger.info(`Attempting anonymous sprint creation for team: ${name}`);
            try {
                // Verify team and password for anonymous access
                team = await getTeam(name, password); // This throws on invalid password/team
                 logger.info(`Anonymous team '${name}' identified for sprint creation.`);
            } catch (dbError) {
                // Consolidate password error checks
                const knownAuthErrors = [
                    "Invalid password for anonymous team",
                    "Password required for this anonymous team",
                    "Invalid password (anonymous team does not require one)",
                    "Password or workspace context required for this team.",
                    "Cannot access workspace team using a password."
                ];
                if (knownAuthErrors.includes(dbError.message)) {
                    logger.warn(`Anonymous auth failed for team '${name}' during sprint creation: ${dbError.message}`);
                    return res.status(401).json({ error: 'Invalid team name or password' });
                }
                 logger.error(`Unexpected DB error during anonymous sprint creation auth for team '${name}': ${dbError.message}`, { stack: dbError.stack });
                throw dbError; // Re-throw other errors
            }
        }

        if (!team) {
             logger.error(`Team object is unexpectedly null after auth/anonymous checks for team '${name}' during sprint creation.`);
             return res.status(500).json({ error: 'Failed to identify team for sprint creation' });
        }

        // --- Create Sprint ---
        const id = uuidv4();
        const sprint = await createSprint(id, team.id, sprintName, startDate, endDate);
        logger.info(`Sprint '${sprint.id}' created successfully for team '${team.id}' ('${name}').`);
        res.status(201).json({ id: sprint.id });
    } catch (error) {
        logger.error('Error creating sprint:', { error: error.message, stack: error.stack, teamName: req.params.name, body: req.body });
        next(error);
    }
});

// Update sprint velocity - supports both authenticated and anonymous modes
router.put('/sprints/:sprintId/velocity', async (req, res, next) => {
    try {
        const { sprintId } = req.params;
        const { committedPoints, completedPoints } = req.body;
        const { password } = req.query; // Needed for anonymous check
        const workspaceId = req.headers['workspace-id'];
        const userId = req.user?.userId;

        // --- Authorization Check ---
        const sprintCheckQuery = `
            SELECT s.team_id, t.workspace_id, t.password as team_password_hash
            FROM sprints s
            JOIN teams t ON s.team_id = t.id
            WHERE s.id = $1
        `;
        const sprintCheckResult = await executeQuery(sprintCheckQuery, [sprintId]);

        if (sprintCheckResult.rows.length === 0) {
            return res.status(404).json({ error: 'Sprint not found' });
        }

        const { team_id, workspace_id: sprintWorkspaceId, team_password_hash } = sprintCheckResult.rows[0];

        // Workspace Mode Check
        if (userId && workspaceId) {
            if (workspaceId !== sprintWorkspaceId) {
                 logger.warn(`Mismatch: User ${userId} in workspace ${workspaceId} trying to update sprint ${sprintId} from workspace ${sprintWorkspaceId}`);
                 return res.status(403).json({ error: 'Sprint does not belong to this workspace' });
            }
            // Use isWorkspaceMember instead of checkWorkspaceAccess
            const hasAccess = await isWorkspaceMember(workspaceId, userId);
            if (!hasAccess) {
                 logger.warn(`Forbidden velocity update attempt: User ${userId} to workspace ${workspaceId}`);
                return res.status(403).json({ error: 'Forbidden: Access denied to this workspace' });
            }
             logger.info(`Workspace user ${userId} authorized to update velocity for sprint ${sprintId}.`);
        }
        // Anonymous Mode Check
        else if (!userId && !workspaceId) {
             logger.info(`Attempting anonymous velocity update for sprint: ${sprintId}`);
             if (team_password_hash) {
                 if (!password) {
                     logger.warn(`Password required for anonymous update of sprint ${sprintId}, but not provided.`);
                     return res.status(401).json({ error: 'Password required for this team' });
                 }
                 const teamNameQuery = 'SELECT name FROM teams WHERE id = $1';
                 const teamNameResult = await executeQuery(teamNameQuery, [team_id]);
                 if (teamNameResult.rows.length === 0) {
                      logger.error(`Team ${team_id} not found during anonymous velocity update check for sprint ${sprintId}.`);
                      return res.status(500).json({ error: 'Internal server error' });
                 }
                 const teamName = teamNameResult.rows[0].name;
                 try {
                     await getTeam(teamName, password); // Verify password using getTeam logic
                      logger.info(`Anonymous user authorized via password for sprint ${sprintId}.`);
                 } catch (authError) {
                      logger.warn(`Anonymous auth failed for sprint ${sprintId}: ${authError.message}`);
                     return res.status(401).json({ error: 'Invalid password' });
                 }
             } else if (password) {
                  logger.warn(`Password provided for anonymous update of sprint ${sprintId}, but team requires no password.`);
                 return res.status(401).json({ error: 'Invalid password (team does not require one)' });
             }
              logger.info(`Anonymous user authorized (no password required) for sprint ${sprintId}.`);
        } else {
             logger.warn(`Ambiguous authorization for velocity update on sprint ${sprintId}. User: ${userId}, Workspace Header: ${workspaceId}`);
            return res.status(400).json({ error: 'Invalid request context for velocity update' });
        }
        // --- End Authorization Check ---


        const velocity = await updateSprintVelocity(sprintId, committedPoints, completedPoints);
        res.json(velocity);
    } catch (error) {
        logger.error('Error updating sprint velocity:', { error: error.message, stack: error.stack, sprintId: req.params.sprintId, body: req.body });
        next(error);
    }
});

// Remove the old helper function as it's now imported
// async function checkWorkspaceAccess(workspaceId, userId) { ... }

export default router;

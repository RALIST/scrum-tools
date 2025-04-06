import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// import { executeQuery } from '../db/dbUtils.js'; // Removed executeQuery import
// import { pool } from '../db/pool.js'; // Removed pool import
import logger from '../logger.js';
// Removed direct DB imports
// import { ... } from '../db/velocity.js';
// import { isWorkspaceMember } from '../db/workspaces.js';

// Wrap routes in a setup function that accepts db dependencies
export default function setupVelocityRoutes(velocityDb, workspaceDb) {
    const router = express.Router();

    // Create or Load a team - supports both authenticated (workspace) and anonymous modes
    router.post('/teams', async (req, res, next) => {
        try {
            const { name, password, workspaceId } = req.body;
            const userId = req.user?.userId; // User ID from optional token

            let team = null;
            let velocityData = [];
            let averageData = { average_velocity: 0, average_commitment: 0, completion_rate: 0 };

            if (workspaceId) {
                // --- Workspace Mode ---
                if (!userId) {
                    return res.status(401).json({ error: 'Authentication required for workspace teams.' });
                }
                // Use injected dependency
                const hasAccess = await workspaceDb.isWorkspaceMember(workspaceId, userId); // Removed pool
                if (!hasAccess) {
                    return res.status(403).json({ error: 'Forbidden: Access denied to this workspace.' });
                }
                // Use injected dependency
                team = await velocityDb.getTeamByWorkspace(name, workspaceId); // Removed executeQuery
                if (!team) {
                    return res.status(404).json({ error: `Team '${name}' not found in this workspace.` });
                }
                velocityData = null;
                averageData = null;

            } else {
                // --- Anonymous Mode ---
                try {
                    // Use injected dependency
                    // Corrected to use getTeam and pass executeQuery
                    team = await velocityDb.getTeam(name, password); // Removed executeQuery
                    if (team) {
                        logger.info(`Anonymous team '${name}' found. Fetching velocity data.`);
                        // Use injected dependency
                        // Pass executeQuery
                        velocityData = await velocityDb.getTeamVelocity(name, password); // Removed executeQuery
                        // Also fetch average data for existing anonymous team
                        // Pass executeQuery
                        averageData = await velocityDb.getTeamAverageVelocity(name, password); // Removed executeQuery
                    } else {
                         logger.info(`Anonymous team '${name}' not found by getTeam.`);
                    }

                } catch (error) {
                    const knownAuthErrors = [
                        "Invalid password for anonymous team",
                        "Password required for this anonymous team",
                        "Invalid password (anonymous team does not require one)",
                        "Password or workspace context required for this team.",
                        "Cannot access workspace team using a password."
                    ];
                    if (knownAuthErrors.includes(error.message)) {
                        logger.warn(`Auth failed during POST /teams for '${name}': ${error.message}`);
                        return res.status(401).json({ error: 'Invalid team name or password' });
                    }
                    logger.info(`Team '${name}' not found or other error during getTeam: ${error.message}. Attempting creation.`);
                }
                logger.info('DEBUG: Exited catch block for getTeam.');

                if (!team) {
                    logger.info('DEBUG: Entering createTeam block because team is null.');
                    logger.info(`Creating new anonymous team '${name}'.`);
                    const id = uuidv4();
                    if (!password) {
                        return res.status(400).json({ error: 'Password is required to create an anonymous team.' });
                    }
                    // Use injected dependency
                    // Pass executeQuery (client is null by default in createTeam)
                    team = await velocityDb.createTeam(id, name, password, null, null, null); // Removed executeQuery
                    velocityData = [];
                    averageData = { average_velocity: 0, average_commitment: 0, completion_rate: 0 };
                }
            }

            // --- Response ---
            res.json({
                success: true,
                team: team,
                sprints: velocityData || [],
                averages: averageData || { average_velocity: 0, average_commitment: 0, completion_rate: 0 }
            });

        } catch (error) {
            logger.error('Error in POST /teams:', { error: error.message, stack: error.stack, body: req.body });
            next(error);
        }
    });


    // Get team velocity data - ONLY for authenticated (workspace) mode now
    router.get('/teams/:name/velocity', async (req, res, next) => {
        try {
            const { name } = req.params;
            const workspaceId = req.headers['workspace-id'];
            const userId = req.user?.userId;

            if (!userId || !workspaceId) {
                logger.warn(`GET /teams/:name/velocity called without workspace context for team '${name}'.`);
                return res.status(400).json({ error: 'Workspace context required for this request.' });
            }

            logger.info(`Attempting workspace velocity fetch: user ${userId}, workspace ${workspaceId}, team ${name}`);
            // Use injected dependency
            const hasAccess = await workspaceDb.isWorkspaceMember(workspaceId, userId); // Removed pool
            if (!hasAccess) {
                logger.warn(`Forbidden access attempt: User ${userId} to workspace ${workspaceId}`);
                return res.status(403).json({ error: 'Forbidden: Access denied to this workspace' });
            }

            // Use injected dependency
            const team = await velocityDb.getTeamByWorkspace(name, workspaceId); // Removed executeQuery
            if (!team) {
                 logger.warn(`Team '${name}' not found in workspace '${workspaceId}'.`);
                 return res.status(404).json({ error: `Team '${name}' not found in this workspace.` });
            }

            logger.info(`Team '${name}' found in workspace '${workspaceId}'. Fetching velocity data.`);
            // Use injected dependencies
            const velocityData = await velocityDb.getTeamVelocityByWorkspace(name, workspaceId); // Removed executeQuery
            const averageData = await velocityDb.getTeamAverageVelocityByWorkspace(name, workspaceId); // Removed executeQuery
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
            const { password } = req.query;
            const { sprintName, startDate, endDate, workspaceId } = req.body;
            const userId = req.user?.userId;

            let team = null;

            // --- Workspace Mode ---
            if (userId && workspaceId) {
                 logger.info(`Attempting workspace sprint creation: user ${userId}, workspace ${workspaceId}, team ${name}`);
                 // Use injected dependency
                const hasAccess = await workspaceDb.isWorkspaceMember(workspaceId, userId); // Removed pool
                if (!hasAccess) {
                     logger.warn(`Forbidden sprint creation attempt: User ${userId} to workspace ${workspaceId}`);
                    return res.status(403).json({ error: 'Forbidden: Access denied to this workspace' });
                }
                // Use injected dependency
                team = await velocityDb.getTeamByWorkspace(name, workspaceId); // Removed executeQuery
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
                    // Use injected dependency
                    // Corrected to use getTeam and pass executeQuery
                    team = await velocityDb.getTeam(name, null); // Removed executeQuery
                     if (!team) {
                         logger.warn(`Anonymous team '${name}' not found during sprint creation auth.`);
                         return res.status(401).json({ error: 'Invalid team name or password' });
                     }
                     // Explicitly verify password if required using bcrypt compare
                     if (team.password) { // Check if team has a password hash
                         if (!password) {
                             logger.warn(`Password required for team '${name}' but not provided in query.`);
                             return res.status(401).json({ error: 'Password required for this team' });
                         }
                         const isValid = await bcrypt.compare(password, team.password);
                         if (!isValid) {
                             logger.warn(`Invalid password provided for team '${name}'.`);
                             return res.status(401).json({ error: 'Invalid password.' });
                         }
                     } else if (password) {
                         // Team has no password, but one was provided
                         logger.warn(`Password provided for team '${name}' which does not require one.`);
                         return res.status(401).json({ error: 'Invalid password (team does not require one).' });
                     }
                     logger.info(`Anonymous team '${name}' identified and authorized for sprint creation.`);
                } catch (dbError) {
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
                    logger.warn(`Team '${name}' not found or other error during anonymous sprint creation auth: ${dbError.message}`);
                    return res.status(401).json({ error: 'Invalid team name or password' });
                }
            }

            if (!team) {
                 logger.error(`Team object is unexpectedly null after auth/anonymous checks for team '${name}' during sprint creation.`);
                 return res.status(500).json({ error: 'Failed to identify team for sprint creation' });
            }

            // --- Create Sprint ---
            const id = uuidv4();
            // Use injected dependency
            const sprint = await velocityDb.createSprint(id, team.id, sprintName, startDate, endDate); // Removed executeQuery
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
            const { password } = req.query;
            const workspaceId = req.headers['workspace-id'];
            const userId = req.user?.userId;

            // --- Authorization Check ---
            // Use injected dependency to get sprint details
            const sprint = await velocityDb.getSprintById(sprintId); // Removed executeQuery
            if (!sprint) {
                return res.status(404).json({ error: 'Sprint not found' });
            }

            // Fetch the team associated with the sprint
            const team = await velocityDb.getTeamById(sprint.team_id); // Removed executeQuery
            if (!team) {
                logger.error(`Team ${sprint.team_id} associated with sprint ${sprintId} not found.`);
                // This indicates a data integrity issue, return 500
                return res.status(500).json({ error: 'Internal server error: Could not find team associated with sprint.' });
            }

            // --- Refined Authorization Logic ---
            const isWorkspaceTeam = !!team.workspace_id;

            if (isWorkspaceTeam) {
                // Workspace Team Authorization
                if (!userId) {
                    logger.warn(`Anonymous attempt to update velocity for workspace sprint ${sprintId}.`);
                    return res.status(401).json({ error: 'Authentication required to update this sprint.' });
                }
                if (!workspaceId || workspaceId !== team.workspace_id) {
                    logger.warn(`Workspace context mismatch for sprint ${sprintId}. Header: ${workspaceId}, Team WS: ${team.workspace_id}`);
                    return res.status(403).json({ error: 'Forbidden: Sprint does not belong to the specified workspace.' });
                }
                const hasAccess = await workspaceDb.isWorkspaceMember(team.workspace_id, userId); // Removed pool
                if (!hasAccess) {
                    logger.warn(`User ${userId} forbidden from updating velocity for sprint ${sprintId} in workspace ${team.workspace_id}.`);
                    return res.status(403).json({ error: 'Forbidden: Access denied to this workspace.' });
                }
                logger.info(`Workspace user ${userId} authorized for sprint ${sprintId}.`);

            } else {
                // Anonymous Team Authorization
                if (userId || workspaceId) {
                    logger.warn(`Authenticated/Workspace context provided for anonymous sprint ${sprintId}. User: ${userId}, WS Header: ${workspaceId}`);
                    return res.status(400).json({ error: 'Invalid context for updating an anonymous sprint.' });
                }
                // Check password using bcrypt compare against team.password (hash)
                if (team.password) { // Check if team has a password hash
                    if (!password) {
                        logger.warn(`Password required for anonymous sprint ${sprintId} but not provided.`);
                        return res.status(401).json({ error: 'Password required for this team.' });
                    }
                    const isValid = await bcrypt.compare(password, team.password);
                    if (!isValid) {
                        logger.warn(`Invalid password provided for anonymous sprint ${sprintId}.`);
                        return res.status(401).json({ error: 'Invalid password.' });
                    }
                    logger.info(`Anonymous user authorized via password for sprint ${sprintId}.`);
                } else if (password) {
                    // Team has no password, but one was provided
                    logger.warn(`Password provided for anonymous sprint ${sprintId}, but team requires no password.`);
                    return res.status(401).json({ error: 'Invalid password (team does not require one).' });
                } else {
                    // Team has no password, and none was provided - OK
                    logger.info(`Anonymous user authorized (no password required) for sprint ${sprintId}.`);
                }
            }
            // --- End Authorization Check ---


            // Use injected dependency
            const velocity = await velocityDb.updateSprintVelocity(sprintId, committedPoints, completedPoints); // Removed executeQuery
            res.json(velocity);
        } catch (error) {
            logger.error('Error updating sprint velocity:', { error: error.message, stack: error.stack, sprintId: req.params.sprintId, body: req.body });
            next(error);
        }
    });

    return router; // Return the configured router
}

// Removed default export of router instance

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../db/dbUtils.js'; // Keep executeQuery for direct use if needed
import logger from '../logger.js'; // Import the logger
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
                const hasAccess = await workspaceDb.isWorkspaceMember(workspaceId, userId);
                if (!hasAccess) {
                    return res.status(403).json({ error: 'Forbidden: Access denied to this workspace.' });
                }
                // Use injected dependency
                team = await velocityDb.getTeamByWorkspace(name, workspaceId);
                if (!team) {
                    return res.status(404).json({ error: `Team '${name}' not found in this workspace.` });
                }
                velocityData = null;
                averageData = null;

            } else {
                // --- Anonymous Mode ---
                try {
                    // Use injected dependency
                    team = await velocityDb.getTeamByName(name, null); // Use getTeamByName for anonymous (workspaceId is null)
                    if (team) {
                        logger.info(`Anonymous team '${name}' found. Fetching velocity data.`);
                        // Use injected dependency
                        velocityData = await velocityDb.getTeamVelocity(name, password);
                    } else {
                         logger.info(`Anonymous team '${name}' not found by getTeam.`);
                    }
                    // averageData = await velocityDb.getTeamAverageVelocity(name, password); // This call seems misplaced here

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
                    team = await velocityDb.createTeam(id, name, password, null, null);
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
            const hasAccess = await workspaceDb.isWorkspaceMember(workspaceId, userId);
            if (!hasAccess) {
                logger.warn(`Forbidden access attempt: User ${userId} to workspace ${workspaceId}`);
                return res.status(403).json({ error: 'Forbidden: Access denied to this workspace' });
            }

            // Use injected dependency
            const team = await velocityDb.getTeamByWorkspace(name, workspaceId);
            if (!team) {
                 logger.warn(`Team '${name}' not found in workspace '${workspaceId}'.`);
                 return res.status(404).json({ error: `Team '${name}' not found in this workspace.` });
            }

            logger.info(`Team '${name}' found in workspace '${workspaceId}'. Fetching velocity data.`);
            // Use injected dependencies
            const velocityData = await velocityDb.getTeamVelocityByWorkspace(name, workspaceId);
            const averageData = await velocityDb.getTeamAverageVelocityByWorkspace(name, workspaceId);
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
                const hasAccess = await workspaceDb.isWorkspaceMember(workspaceId, userId);
                if (!hasAccess) {
                     logger.warn(`Forbidden sprint creation attempt: User ${userId} to workspace ${workspaceId}`);
                    return res.status(403).json({ error: 'Forbidden: Access denied to this workspace' });
                }
                // Use injected dependency
                team = await velocityDb.getTeamByWorkspace(name, workspaceId);
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
                    team = await velocityDb.getTeamByName(name, null); // Use getTeamByName for anonymous (workspaceId is null)
                     if (!team) {
                         logger.warn(`Anonymous team '${name}' not found during sprint creation auth.`);
                         return res.status(401).json({ error: 'Invalid team name or password' });
                     }
                     // Explicitly verify password if required
                     const teamRequiresPassword = await velocityDb.checkIfTeamRequiresPassword(team.id); // Needs implementation
                     if (teamRequiresPassword) {
                         if (!password) {
                              logger.warn(`Password required for team '${name}' but not provided in query.`);
                              return res.status(401).json({ error: 'Password required for this team' });
                         }
                         const isValidPassword = await velocityDb.verifyTeamPassword(team.id, password);
                         if (!isValidPassword) {
                              logger.warn(`Invalid password provided for team '${name}'.`);
                              return res.status(401).json({ error: 'Invalid team name or password' });
                         }
                     } else if (password) {
                          logger.warn(`Password provided for team '${name}' which does not require one.`);
                          return res.status(401).json({ error: 'Invalid password (team does not require one)' });
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
            const sprint = await velocityDb.createSprint(id, team.id, sprintName, startDate, endDate);
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
            const sprint = await velocityDb.getSprintById(sprintId);
            if (!sprint) {
                return res.status(404).json({ error: 'Sprint not found' });
            }

            // Now get team details using sprint.team_id
            // Assuming getTeamById exists or can be added to velocityDb interface
            // For now, let's assume getTeamByName can work if we know the team name,
            // or we might need to adjust the DB interface/implementation.
            // Let's proceed assuming we can get team details needed for auth.
            // We need team's workspace_id and password status.
            // This part might need further refinement based on actual velocityDb capabilities.

            // Placeholder: Fetch team details (replace with actual call if available)
            // const team = await velocityDb.getTeamDetails(sprint.team_id);
            // if (!team) {
            //     logger.error(`Team ${sprint.team_id} not found for sprint ${sprintId}`);
            //     return res.status(500).json({ error: 'Internal server error: Team not found' });
            // }
            // const sprintWorkspaceId = team.workspace_id;
            // const teamRequiresPassword = !!team.password_hash; // Example property

            // --- Simplified Auth Logic (Needs refinement based on actual DB functions) ---

            // Workspace Mode Check
            if (userId && workspaceId) {
                // We need the sprint's actual workspace ID to compare
                // Assuming sprint object has workspace_id (needs confirmation from getSprintById implementation)
                if (!sprint.workspace_id) {
                     logger.warn(`Attempt to update non-workspace sprint ${sprintId} in workspace context.`);
                     return res.status(400).json({ error: 'Cannot update non-workspace sprint in workspace context.' });
                }
                if (workspaceId !== sprint.workspace_id) {
                     logger.warn(`Mismatch: User ${userId} in workspace ${workspaceId} trying to update sprint ${sprintId} from workspace ${sprint.workspace_id}`);
                     return res.status(403).json({ error: 'Sprint does not belong to this workspace' });
                }
                const hasAccess = await workspaceDb.isWorkspaceMember(workspaceId, userId);
                if (!hasAccess) {
                     logger.warn(`Forbidden velocity update attempt: User ${userId} to workspace ${workspaceId}`);
                    return res.status(403).json({ error: 'Forbidden: Access denied to this workspace' });
                }
                 logger.info(`Workspace user ${userId} authorized to update velocity for sprint ${sprintId}.`);
            }
            // Anonymous Mode Check
            else if (!userId && !workspaceId) {
                 logger.info(`Attempting anonymous velocity update for sprint: ${sprintId}`);
                 // Check if the sprint belongs to a workspace - anonymous users cannot update these
                 if (sprint.workspace_id) {
                     logger.warn(`Anonymous user attempting to update workspace sprint ${sprintId}.`);
                     return res.status(403).json({ error: 'Forbidden: Cannot update workspace sprint anonymously.' });
                 }
                 // Check if the anonymous team requires a password
                 // We need team details here. Assuming getSprintById returns team_id,
                 // and we have verifyTeamPassword in velocityDb.
                 const teamRequiresPassword = await velocityDb.checkIfTeamRequiresPassword(sprint.team_id); // Needs implementation in db/tests

                 if (teamRequiresPassword) {
                     if (!password) {
                         logger.warn(`Password required for anonymous update of sprint ${sprintId}, but not provided.`);
                         return res.status(401).json({ error: 'Password required for this team' });
                     }
                     const isValidPassword = await velocityDb.verifyTeamPassword(sprint.team_id, password);
                     if (!isValidPassword) {
                          logger.warn(`Anonymous auth failed for sprint ${sprintId}: Invalid password`);
                         return res.status(401).json({ error: 'Invalid password' });
                     }
                      logger.info(`Anonymous user authorized via password for sprint ${sprintId}.`);
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


            // Use injected dependency
            const velocity = await velocityDb.updateSprintVelocity(sprintId, committedPoints, completedPoints);
            res.json(velocity);
        } catch (error) {
            logger.error('Error updating sprint velocity:', { error: error.message, stack: error.stack, sprintId: req.params.sprintId, body: req.body });
            next(error);
        }
    });

    return router; // Return the configured router
}

// Removed default export of router instance

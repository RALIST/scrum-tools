import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// Wrap routes in a setup function that accepts db dependencies
export default function setupVelocityRoutes(velocityDb, workspaceDb) { // Reverted injected dependency name
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
                    team = await velocityDb.getTeam(name, password); // Removed executeQuery
                    if (team) {
                        velocityData = await velocityDb.getTeamVelocity(name, password); // Removed executeQuery
                        averageData = await velocityDb.getTeamAverageVelocity(name, password); // Removed executeQuery
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
                        return res.status(401).json({ error: 'Invalid team name or password' });
                    }
                }

                if (!team) {
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
                return res.status(400).json({ error: 'Workspace context required for this request.' });
            }

            // Use injected dependency
            const hasAccess = await workspaceDb.isWorkspaceMember(workspaceId, userId); // Removed pool
            if (!hasAccess) {
                return res.status(403).json({ error: 'Forbidden: Access denied to this workspace' });
            }

            // Use injected dependency
            const team = await velocityDb.getTeamByWorkspace(name, workspaceId); // Removed executeQuery
            if (!team) {
                 return res.status(404).json({ error: `Team '${name}' not found in this workspace.` });
            }

            const velocityData = await velocityDb.getTeamVelocityByWorkspace(name, workspaceId); // Removed executeQuery
            const averageData = await velocityDb.getTeamAverageVelocityByWorkspace(name, workspaceId); // Removed executeQuery

            res.json({
                sprints: velocityData || [],
                averages: averageData || { average_velocity: 0, average_commitment: 0, completion_rate: 0 }
            });

        } catch (error) {
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
                 // Use injected dependency
                const hasAccess = await workspaceDb.isWorkspaceMember(workspaceId, userId); // Removed pool
                if (!hasAccess) {
                    return res.status(403).json({ error: 'Forbidden: Access denied to this workspace' });
                }
                // Use injected dependency
                team = await velocityDb.getTeamByWorkspace(name, workspaceId); // Removed executeQuery
                if (!team) {
                    return res.status(404).json({ error: `Team '${name}' not found in this workspace.` });
                }
            }
            // --- Anonymous Mode ---
            else {
                try {
                    // Use injected dependency
                    // Corrected to use getTeam and pass executeQuery
                    team = await velocityDb.getTeam(name, null); // Removed executeQuery
                     if (!team) {
                         return res.status(401).json({ error: 'Invalid team name or password' });
                     }
                     // Explicitly verify password if required using bcrypt compare
                     if (team.password) { // Check if team has a password hash
                         if (!password) {
                             return res.status(401).json({ error: 'Password required for this team' });
                         }
                         const isValid = await bcrypt.compare(password, team.password);
                         if (!isValid) {
                             return res.status(401).json({ error: 'Invalid password.' });
                         }
                     } else if (password) {
                         // Team has no password, but one was provided
                         return res.status(401).json({ error: 'Invalid password (team does not require one).' });
                     }
                } catch (dbError) {
                    const knownAuthErrors = [
                        "Invalid password for anonymous team",
                        "Password required for this anonymous team",
                        "Invalid password (anonymous team does not require one)",
                        "Password or workspace context required for this team.",
                        "Cannot access workspace team using a password."
                    ];
                    if (knownAuthErrors.includes(dbError.message)) {
                        return res.status(401).json({ error: 'Invalid team name or password' });
                    }
                    return res.status(401).json({ error: 'Invalid team name or password' });
                }
            }

            if (!team) {
                 return res.status(500).json({ error: 'Failed to identify team for sprint creation' });
            }

            // --- Create Sprint ---
            const id = uuidv4();
            // Use injected dependency
            const sprint = await velocityDb.createSprint(id, team.id, sprintName, startDate, endDate); // Removed executeQuery
            res.status(201).json({ id: sprint.id });
        } catch (error) {
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
                // This indicates a data integrity issue, return 500
                return res.status(500).json({ error: 'Internal server error: Could not find team associated with sprint.' });
            }

            // --- Refined Authorization Logic ---
            const isWorkspaceTeam = !!team.workspace_id;

            if (isWorkspaceTeam) {
                // Workspace Team Authorization
                if (!userId) {
                    return res.status(401).json({ error: 'Authentication required to update this sprint.' });
                }
                if (!workspaceId || workspaceId !== team.workspace_id) {
                    return res.status(403).json({ error: 'Forbidden: Sprint does not belong to the specified workspace.' });
                }
                const hasAccess = await workspaceDb.isWorkspaceMember(team.workspace_id, userId); // Removed pool
                if (!hasAccess) {
                    return res.status(403).json({ error: 'Forbidden: Access denied to this workspace.' });
                }

            } else {
                // Anonymous Team Authorization
                if (userId || workspaceId) {
                    return res.status(400).json({ error: 'Invalid context for updating an anonymous sprint.' });
                }
                // Check password using bcrypt compare against team.password (hash)
                if (team.password) { // Check if team has a password hash
                    if (!password) {
                        return res.status(401).json({ error: 'Password required for this team.' });
                    }
                    const isValid = await bcrypt.compare(password, team.password);
                    if (!isValid) {
                        return res.status(401).json({ error: 'Invalid password.' });
                    }
                } else if (password) {
                    // Team has no password, but one was provided
                    return res.status(401).json({ error: 'Invalid password (team does not require one).' });
                } else {
                    // Team has no password, and none was provided - OK
                }
            }
            // --- End Authorization Check ---
            const velocity = await velocityDb.updateSprintVelocity(sprintId, committedPoints, completedPoints); // Removed executeQuery
            res.json(velocity);
        } catch (error) {
            next(error);
        }
    });

    return router; // Return the configured router
}

// Removed default export of router instance

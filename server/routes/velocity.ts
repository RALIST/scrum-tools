import express, { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import * as velocityDbFunctions from '../db/velocity.js'; // Import DB functions (needs .js)
import * as workspaceDbFunctions from '../db/workspaces.js'; // Import DB functions (needs .js)
import {
    VelocityTeam, VelocitySprint, SprintVelocity, TeamVelocityData,
    TeamAverageVelocity
} from '../types/db.js'; // Import types (needs .js)

// Define types for injected DB modules
type VelocityDbModule = typeof velocityDbFunctions;
type WorkspaceDbModule = typeof workspaceDbFunctions;

// Wrap routes in a setup function that accepts db dependencies
export default function setupVelocityRoutes(
    velocityDb: VelocityDbModule,
    workspaceDb: WorkspaceDbModule // Add workspaceDb dependency type
): Router {
    const router: Router = express.Router();

    // Create or Load a team - supports both authenticated (workspace) and anonymous modes
    router.post('/teams', async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { name, password, workspaceId } = req.body;
            const userId: string | undefined = req.user?.userId; // User ID from optional token

            // Use Omit to exclude password from the team type returned to client
            let team: Omit<VelocityTeam, 'password'> | null = null;
            let velocityData: TeamVelocityData[] | null = []; // Allow null for workspace mode
            let averageData: TeamAverageVelocity | null = { average_velocity: '0.00', average_commitment: '0.00', completion_rate: '0.00' }; // Use string type from interface

            if (workspaceId) {
                // --- Workspace Mode ---
                if (!userId) {
                    res.status(401).json({ error: 'Authentication required for workspace teams.' });
                    return;
                }
                // Use injected dependency
                // Assert non-null for userId and workspaceId
                const hasAccess: boolean = await workspaceDb.isWorkspaceMember(workspaceId, userId!);
                if (!hasAccess) {
                    res.status(403).json({ error: 'Forbidden: Access denied to this workspace.' });
                    return;
                }
                // Use injected dependency
                // Assert non-null for workspaceId
                team = await velocityDb.getTeamByWorkspace(name, workspaceId!);
                if (!team) {
                    res.status(404).json({ error: `Team '${name}' not found in this workspace.` });
                    return;
                }
                velocityData = null;
                averageData = null;

            } else {
                // --- Anonymous Mode ---
                try {
                    team = await velocityDb.getTeam(name, password);
                    if (team) {
                        velocityData = await velocityDb.getTeamVelocity(name, password);
                        averageData = await velocityDb.getTeamAverageVelocity(name, password);
                    }

                } catch (error: any) { // Type error
                    const knownAuthErrors = [
                        "Invalid password for anonymous team",
                        "Password required for this anonymous team",
                        "Invalid password (anonymous team does not require one)",
                        "Password or workspace context required for this team.",
                        "Cannot access workspace team using a password."
                    ];
                    if (knownAuthErrors.includes(error.message)) {
                        res.status(401).json({ error: 'Invalid team name or password' });
                        return;
                    }
                }

                if (!team) {
                    const id: string = uuidv4();
                    if (!password) {
                        res.status(400).json({ error: 'Password is required to create an anonymous team.' });
                        return;
                    }
                    // Use injected dependency
                    // Pass executeQuery (client is null by default in createTeam)
                    // createTeam returns the full team, but we only need the Omit<...> version
                    const createdTeam = await velocityDb.createTeam(id, name, password, null, null, null);
                    if (createdTeam) {
                        const { password: _p, ...teamData } = createdTeam;
                        team = teamData;
                    } else {
                        // Handle potential null return from createTeam if necessary
                        throw new Error("Failed to create team");
                    }
                    velocityData = [];
                    averageData = { average_velocity: '0.00', average_commitment: '0.00', completion_rate: '0.00' }; // Use string type
                }
            }

            // --- Response ---
            res.json({
                success: true,
                team: team,
                sprints: velocityData || [],
                averages: averageData // Already defaulted above
            });

        } catch (error: any) { // Type error
            next(error);
        }
    });


    // Get team velocity data - ONLY for authenticated (workspace) mode now
    router.get('/teams/:name/velocity', async (req: Request<{ name: string }>, res: Response, next: NextFunction) => {
        try {
            const { name } = req.params;
            const workspaceIdHeader = req.headers['workspace-id'];
            const workspaceId: string | undefined = Array.isArray(workspaceIdHeader) ? workspaceIdHeader[0] : workspaceIdHeader;
            const userId: string | undefined = req.user?.userId;

            if (!userId || !workspaceId) {
                res.status(400).json({ error: 'Workspace context required for this request.' });
                return;
            }

            // Use injected dependency
            // Assert non-null for userId and workspaceId
            const hasAccess: boolean = await workspaceDb.isWorkspaceMember(workspaceId!, userId!);
            if (!hasAccess) {
                res.status(403).json({ error: 'Forbidden: Access denied to this workspace' });
                return;
            }

            // Use injected dependency
            // Assert non-null for workspaceId
            const team: Omit<VelocityTeam, 'password'> | null = await velocityDb.getTeamByWorkspace(name, workspaceId!);
            if (!team) {
                 res.status(404).json({ error: `Team '${name}' not found in this workspace.` });
                 return;
            }

            // Assert non-null for workspaceId
            const velocityData: TeamVelocityData[] | null = await velocityDb.getTeamVelocityByWorkspace(name, workspaceId!);
            // Assert non-null for workspaceId
            const averageData: TeamAverageVelocity | null = await velocityDb.getTeamAverageVelocityByWorkspace(name, workspaceId!);

            res.json({
                sprints: velocityData || [],
                averages: averageData ?? { average_velocity: '0.00', average_commitment: '0.00', completion_rate: '0.00' } // Use nullish coalescing and string type
            });

        } catch (error: any) { // Type error
            next(error);
        }
    });

    // Create a new sprint - supports both authenticated (workspace) and anonymous modes
    router.post('/teams/:name/sprints', async (req: Request<{ name: string }>, res: Response, next: NextFunction) => {
        try {
            const { name } = req.params;
            // Type query param (could be string, string[], or undefined)
            const passwordQuery = req.query.password;
            const password = typeof passwordQuery === 'string' ? passwordQuery : undefined;
            const { sprintName, startDate, endDate, workspaceId } = req.body;
            const userId: string | undefined = req.user?.userId;

            let team: VelocityTeam | Omit<VelocityTeam, 'password'> | null = null; // Can be full team or partial

            // --- Workspace Mode ---
            if (userId && workspaceId) {
                 // Use injected dependency
                // Assert non-null for userId and workspaceId
                const hasAccess: boolean = await workspaceDb.isWorkspaceMember(workspaceId, userId!);
                if (!hasAccess) {
                    res.status(403).json({ error: 'Forbidden: Access denied to this workspace' });
                    return;
                }
                // Use injected dependency
                // Assert non-null for workspaceId
                team = await velocityDb.getTeamByWorkspace(name, workspaceId!);
                if (!team) {
                    res.status(404).json({ error: `Team '${name}' not found in this workspace.` });
                    return;
                }
            }
            // --- Anonymous Mode ---
            else {
                // Use getTeam directly, which handles password verification and throws specific errors
                try {
                    team = await velocityDb.getTeam(name, password);
                    if (!team) {
                        // getTeam returns null if not found (and doesn't throw for not found)
                        res.status(404).json({ error: `Team '${name}' not found.` });
                        return;
                    }
                    // If team is found and password is valid (or not needed), execution continues
                } catch (error: any) {
                    // Catch specific errors thrown by getTeam for invalid password/context
                    const knownAuthErrors = [
                        "Invalid password for anonymous team",
                        "Password required for this anonymous team",
                        "Invalid password (anonymous team does not require one)",
                        "Password or workspace context required for this team.", // Should not happen here
                        "Cannot access workspace team using a password." // Should not happen here
                    ];
                     if (knownAuthErrors.includes(error.message)) {
                        // Return 401 for authentication/authorization issues from getTeam
                        res.status(401).json({ error: 'Invalid team name or password' }); // Generic message for security
                        return;
                    } else {
                        // Re-throw other unexpected errors
                        throw error;
                    }
                }
            }

            if (!team) {
                 res.status(500).json({ error: 'Failed to identify team for sprint creation' });
                 return;
            }

            // --- Create Sprint ---
            const id: string = uuidv4();
            const sprint: VelocitySprint = await velocityDb.createSprint(id, team!.id, sprintName, startDate, endDate);
            res.status(201).json({ id: sprint.id });
        } catch (error: any) { // Type error
            next(error);
        }
    });

    // Update sprint velocity - supports both authenticated and anonymous modes
    router.put('/sprints/:sprintId/velocity', async (req: Request<{ sprintId: string }>, res: Response, next: NextFunction) => {
        try {
            const { sprintId } = req.params;
            const { committedPoints, completedPoints } = req.body;
            const passwordQuery = req.query.password;
            const password = typeof passwordQuery === 'string' ? passwordQuery : undefined;
            const workspaceIdHeader = req.headers['workspace-id'];
            const workspaceId: string | undefined = Array.isArray(workspaceIdHeader) ? workspaceIdHeader[0] : workspaceIdHeader;
            const userId: string | undefined = req.user?.userId;

            // --- Authorization Check ---
            // Use injected dependency to get sprint details
            const sprint: VelocitySprint | null = await velocityDb.getSprintById(sprintId);
            if (!sprint) {
                res.status(404).json({ error: 'Sprint not found' });
                return;
            }

            // Fetch the team associated with the sprint
            // Assert non-null for sprint.team_id
            const team: VelocityTeam | null = await velocityDb.getTeamById(sprint!.team_id);
            if (!team) {
                // This indicates a data integrity issue, return 500
                res.status(500).json({ error: 'Internal server error: Could not find team associated with sprint.' });
                return;
            }

            // --- Refined Authorization Logic ---
            // Assert non-null for team
            const isWorkspaceTeam: boolean = !!team!.workspace_id;

            if (isWorkspaceTeam) {
                // Workspace Team Authorization
                if (!userId) {
                    res.status(401).json({ error: 'Authentication required to update this sprint.' });
                    return;
                }
                // Assert non-null for team.workspace_id
                if (!workspaceId || workspaceId !== team!.workspace_id) {
                    res.status(403).json({ error: 'Forbidden: Sprint does not belong to the specified workspace.' });
                    return;
                }
                // Assert non-null for team.workspace_id and userId
                const hasAccess: boolean = await workspaceDb.isWorkspaceMember(team!.workspace_id!, userId!);
                if (!hasAccess) {
                    res.status(403).json({ error: 'Forbidden: Access denied to this workspace.' });
                    return;
                }

            } else {
                // Anonymous Team Authorization
                if (userId || workspaceId) {
                    res.status(400).json({ error: 'Invalid context for updating an anonymous sprint.' });
                    return;
                }
                // Check password using bcrypt compare against team.password (hash)
                // Assert non-null for team
                if (team!.password) { // Check if team has a password hash
                    if (!password) {
                        res.status(401).json({ error: 'Password required for this team.' });
                        return;
                    }
                    // Assert non-null for password and team.password
                    const isValid: boolean = await bcrypt.compare(password!, team!.password!);
                    if (!isValid) {
                        res.status(401).json({ error: 'Invalid password.' });
                        return;
                    }
                } else if (password) {
                    // Team has no password, but one was provided
                    res.status(401).json({ error: 'Invalid password (team does not require one).' });
                    return;
                } else {
                    // Team has no password, and none was provided - OK
                }
            }
            // --- End Authorization Check ---
            const velocity: SprintVelocity = await velocityDb.updateSprintVelocity(sprintId, committedPoints, completedPoints);
            res.json(velocity);
        } catch (error: any) { // Type error
            next(error);
        }
    });

    return router; // Return the configured router
}

// Removed default export of router instance

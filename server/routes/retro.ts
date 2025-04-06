import express, { Router, Request, Response, NextFunction } from 'express';
import * as retroDbFunctions from '../db/retro.js'; // Import DB functions (needs .js)
import * as workspaceDbFunctions from '../db/workspaces.js'; // Import DB functions (needs .js)
import { RetroBoardDetails, RetroBoardSettings } from '../types/db.js'; // Import types (needs .js)

// Define types for injected DB modules
type RetroDbModule = typeof retroDbFunctions;
type WorkspaceDbModule = typeof workspaceDbFunctions;

const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
};

// Wrap routes in a setup function that accepts db dependency
export default function setupRetroRoutes(
    retroDb: RetroDbModule,
    workspaceDb: WorkspaceDbModule // Add workspaceDb dependency type
): Router {
    const router: Router = express.Router();

    // POST /
    router.post('/', async (req: Request, res: Response, next: NextFunction) => {
        const boardId: string = Math.random().toString(36).substring(2, 8);
        const { name, settings = {}, workspaceId } = req.body; // Expect settings object again
        const defaultName: string = `Retro ${formatDate(new Date())}`;

        const userId: string | undefined = req.user?.userId; // Get userId from auth middleware
        try {
            // If workspaceId is provided, ensure the user is authenticated and a member
            if (workspaceId) {
                if (!userId) {
                    res.status(401).json({ error: 'Authentication required to create a workspace retro board.' });
                    return;
                }
                // Assert non-null for userId and workspaceId
                const isMember: boolean = await workspaceDb.isWorkspaceMember(workspaceId, userId!);
                if (!isMember) {
                    res.status(403).json({ error: 'User is not authorized to create a retro board in this workspace.' });
                    return;
                }
            }
            // Use injected dependency
            // Use injected dependency
            // Type settings explicitly
            await retroDb.createRetroBoard(boardId, name || defaultName, workspaceId, settings as RetroBoardSettings); // Pass settings object directly
            res.json({ success: true, boardId });
        } catch (error: any) { // Type error
            next(error);
        }
    });

    // GET /:boardId
    router.get('/:boardId', async (req: Request<{ boardId: string }>, res: Response, next: NextFunction) => {
        const { boardId } = req.params;

        const userId: string | undefined = req.user?.userId; // Get userId from auth middleware
        try {
            // Use injected dependency
            const board: RetroBoardDetails | null = await retroDb.getRetroBoard(boardId);
            if (!board) {
                res.status(404).json({ error: 'Board not found' });
                return;
            }

            // If the board belongs to a workspace, verify membership
            if (board.workspace_id) {
                if (!userId) {
                    res.status(401).json({ error: 'Authentication required to access this retro board.' });
                    return;
                }
                // Assert non-null for userId and board.workspace_id
                const isMember: boolean = await workspaceDb.isWorkspaceMember(board.workspace_id!, userId!);
                if (!isMember) {
                    res.status(403).json({ error: 'User is not authorized to access this retro board.' });
                    return;
                }
            }
            // The 'board' object from getRetroBoard already has 'hasPassword' and omits the actual password hash.
            res.json(board); // Send the object directly
        } catch (error: any) { // Type error
            next(error);
        }
    });

    // POST /:boardId/verify-password
    router.post('/:boardId/verify-password', async (req: Request<{ boardId: string }>, res: Response, next: NextFunction) => {
        const { boardId } = req.params;
        const { password } = req.body;

        try {
            // Use injected dependency
            const isValid: boolean = await retroDb.verifyRetroBoardPassword(boardId, password);
            res.json({ valid: isValid });
        } catch (error: any) { // Type error
            next(error);
        }
    });

    // PUT /:boardId/settings
    router.put('/:boardId/settings', async (req: Request<{ boardId: string }>, res: Response, next: NextFunction) => {
        const { boardId } = req.params;
        const {settings } = req.body; // Expect settings object again
        const {
            defaultTimer,
            hideCardsByDefault,
            hideAuthorNames,
            password
        } = settings;
        const userId: string | undefined = req.user?.userId; // Get userId from auth middleware
        try {

            // Use injected dependency for both checks and updates
            const existingBoard: RetroBoardDetails | null = await retroDb.getRetroBoard(boardId);
            if (!existingBoard) {
                res.status(404).json({ error: 'Board not found' });
                return;
            }

            // If the board belongs to a workspace, verify membership before allowing settings update
            if (existingBoard.workspace_id) {
                 if (!userId) {
                    res.status(401).json({ error: 'Authentication required to update settings for this retro board.' });
                    return;
                }
                // Assert non-null for userId and existingBoard.workspace_id
                const isMember: boolean = await workspaceDb.isWorkspaceMember(existingBoard.workspace_id!, userId!);
                if (!isMember) {
                    res.status(403).json({ error: 'User is not authorized to update settings for this retro board.' });
                    return;
                }
            }

            // Construct settings object with explicit types
            const settingsToUpdate: RetroBoardSettings = {
                defaultTimer,
                hideCardsByDefault,
                hideAuthorNames,
                password
            };
            await retroDb.updateRetroBoardSettings(boardId, settingsToUpdate);
            // Fetch the updated board to return the latest state
            const updatedBoard: RetroBoardDetails | null = await retroDb.getRetroBoard(boardId);
            res.json(updatedBoard);
        } catch (error: any) { // Type error
            next(error);
        }
    });

    return router; // Return the configured router
}

// Removed default export of router instance

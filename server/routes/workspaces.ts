import express, { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.js'; // Needs .js
import * as workspaceDbFunctions from '../db/workspaces.js'; // Needs .js
import * as userDbFunctions from '../db/users.js'; // Needs .js
import * as pokerDbFunctions from '../db/poker.js'; // Needs .js
import * as retroDbFunctions from '../db/retro.js'; // Needs .js
import * as velocityDbFunctions from '../db/velocity.js'; // Needs .js
import {
    Workspace, WorkspaceRole, WorkspaceMemberDetails, User, PokerRoom, RetroBoard,
    WorkspaceVelocityTeam, ValidWorkspaceInvitation
} from '../types/db.js'; // Needs .js

// Define types for injected DB modules
type WorkspaceDbModule = typeof workspaceDbFunctions;
type UserDbModule = typeof userDbFunctions;
type PokerDbModule = typeof pokerDbFunctions;
type RetroDbModule = typeof retroDbFunctions;
type VelocityDbModule = typeof velocityDbFunctions;

// Wrap routes in a setup function that accepts db dependencies
export default function setupWorkspaceRoutes(
    workspaceDb: WorkspaceDbModule,
    userDb: UserDbModule,
    pokerDb: PokerDbModule,
    retroDb: RetroDbModule,
    velocityDb: VelocityDbModule
): Router {
    const router: Router = express.Router();
    // No need to destructure or access via .velocityUtils anymore

    // Create a new workspace
    router.post('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { name, description } = req.body;
        // Assert req.user exists because authenticateToken middleware runs first
        const userId: string = req.user!.userId;

        if (!name) {
          res.status(400).json({ error: 'Workspace name is required' });
          return;
        }

        // Use injected dependency
        const workspace: Workspace = await workspaceDb.createWorkspace(name, description, userId);

        res.status(201).json({
          message: 'Workspace created successfully',
          workspace,
        });
      } catch (error: any) { // Type error
        next(error);
      }
    });

    // Get user's workspaces
    router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Assert req.user exists
        const userId: string = req.user!.userId;
        // Use injected dependency
        const workspaces: Array<Workspace & { role: WorkspaceRole }> = await workspaceDb.getUserWorkspaces(userId);

        res.json(workspaces);
      } catch (error: any) { // Type error
        next(error);
      }
    });

    // Get a specific workspace
    router.get('/:id', authenticateToken, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
      try {
        const workspaceId: string = req.params.id;
        // Use injected dependency
        const workspace: Workspace | null = await workspaceDb.getWorkspaceById(workspaceId);

        if (!workspace) {
          res.status(404).json({ error: 'Workspace not found' });
          return;
        }
        res.json(workspace);
      } catch (error: any) { // Type error
        next(error);
      }
    });

    // Update a workspace
    router.put('/:id', authenticateToken, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
      try {
        const workspaceId: string = req.params.id;
        const { name, description } = req.body;
        // Assert req.user exists
        const userId: string = req.user!.userId;

        // Use injected dependency
        const role: WorkspaceRole | null = await workspaceDb.getUserWorkspaceRole(workspaceId, userId);

        if (!role || role !== 'admin') {
          res.status(403).json({ error: 'You do not have permission to update this workspace' });
          return;
        }

        if (!name) {
          res.status(400).json({ error: 'Workspace name is required' });
          return;
        }

        // Use injected dependency
        const workspace: Workspace = await workspaceDb.updateWorkspace(workspaceId, name, description);

        res.json({
          message: 'Workspace updated successfully',
          workspace,
        });
      } catch (error: any) { // Type error
        next(error);
      }
    });

    // Add a member to a workspace
    router.post('/:id/members', authenticateToken, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
      try {
        const workspaceId: string = req.params.id;
        const { email, role } = req.body;
        // Assert req.user exists
        const userId: string = req.user!.userId;

        // Use injected dependency
        const userRole: WorkspaceRole | null = await workspaceDb.getUserWorkspaceRole(workspaceId, userId);

        if (!userRole || userRole !== 'admin') {
          res.status(403).json({ error: 'You do not have permission to add members' });
          return;
        }

        // Use injected dependency
        const user: User | null = await userDb.getUserByEmail(email);

        if (!user) {
          res.status(404).json({ error: 'User not found' });
          return;
        }

        // Use injected dependency
        // Assert user is not null
        await workspaceDb.addWorkspaceMember(workspaceId, user!.id, role || 'member');

        res.status(201).json({
          message: 'Member added successfully',
        });
      } catch (error: any) { // Type error
        if (error.code === '23505') {
          res.status(409).json({ error: 'User is already a member of this workspace.' });
          return;
        }
        next(error);
      }
    });

    // Remove a member from a workspace
    router.delete('/:id/members/:memberId', authenticateToken, async (req: Request<{ id: string; memberId: string }>, res: Response, next: NextFunction) => {
      try {
        const workspaceId: string = req.params.id;
        const memberId: string = req.params.memberId;
        // Assert req.user exists
        const userId: string = req.user!.userId;

        // Use injected dependency
        const userRole: WorkspaceRole | null = await workspaceDb.getUserWorkspaceRole(workspaceId, userId);

        if (!userRole || userRole !== 'admin') {
          res.status(403).json({ error: 'You do not have permission to remove members' });
          return;
        }

        // Use injected dependency
        const workspace: Workspace | null = await workspaceDb.getWorkspaceById(workspaceId);
        if (!workspace) {
          res.status(404).json({ error: 'Workspace not found' });
          return;
        }
        // Assert workspace is not null
        if (workspace!.owner_id === memberId) {
          res.status(403).json({ error: 'Cannot remove the workspace owner.' });
          return;
        }

        // Use injected dependency
        await workspaceDb.removeWorkspaceMember(workspaceId, memberId); // Removed pool
        // The original code had duplicate checks here, removed them.
        // The removeWorkspaceMember function should handle non-existent members gracefully (e.g., affect 0 rows).

        res.json({
          message: 'Member removed successfully',
        });
      } catch (error: any) { // Type error
        next(error);
      }
    });

    // Get workspace members
    router.get('/:id/members', authenticateToken, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
      try {
        const workspaceId: string = req.params.id;
        // Assert req.user exists
        const userId: string = req.user!.userId;

        // Use injected dependency
        const role: WorkspaceRole | null = await workspaceDb.getUserWorkspaceRole(workspaceId, userId);

        if (!role) {
          res.status(403).json({ error: 'You do not have access to this workspace' });
          return;
        }

        // Use injected dependency
        const members: WorkspaceMemberDetails[] = await workspaceDb.getWorkspaceMembers(workspaceId);
        res.json(members);
      } catch (error: any) { // Type error
        next(error);
      }
    });

    // Get poker rooms for a workspace
    router.get('/:id/rooms', authenticateToken, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
      try {
        const workspaceId: string = req.params.id;
        // Assert req.user exists
        const userId: string = req.user!.userId;

        // Use injected dependency
        const role: WorkspaceRole | null = await workspaceDb.getUserWorkspaceRole(workspaceId, userId);

        if (!role) {
          res.status(403).json({ error: 'You do not have access to this workspace' });
          return;
        }

        // Use injected dependency from pokerDb
        const rooms: PokerRoom[] = await pokerDb.getWorkspaceRooms(workspaceId);

        // Define type for mapped item
        interface RoomListItem {
            id: string; name: string; participantCount: number; createdAt: Date | string;
            hasPassword: boolean; sequence: string[] | string; workspaceId: string | null | undefined;
        }
        const roomList: RoomListItem[] = rooms.map((room: PokerRoom) => ({
          id: room.id,
          name: room.name,
          participantCount: typeof room.participant_count === 'string'
              ? parseInt(room.participant_count, 10)
              : (room.participant_count ?? 0),
          createdAt: room.created_at,
          hasPassword: !!room.password,
          sequence: room.sequence,
          workspaceId: room.workspace_id
        }));
        res.json(roomList);
      } catch (error: any) { // Type error
        next(error);
      }
    });

    // Get retro boards for a workspace
    router.get('/:id/retros', authenticateToken, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
      try {
        const workspaceId: string = req.params.id;
        // Assert req.user exists
        const userId: string = req.user!.userId;

        // Use injected dependency
        const role: WorkspaceRole | null = await workspaceDb.getUserWorkspaceRole(workspaceId, userId);

        if (!role) {
          res.status(403).json({ error: 'You do not have access to this workspace' });
          return;
        }

        // Use injected dependency from retroDb
        const boards: RetroBoard[] = await retroDb.getWorkspaceRetroBoards(workspaceId);

        // Define type for mapped item
        interface BoardListItem {
            id: string; name: string; cardCount: number; createdAt: Date | string;
            hasPassword?: boolean; workspaceId: string | null | undefined;
        }
        const boardList: BoardListItem[] = boards.map((board: RetroBoard) => ({
          id: board.id,
          name: board.name,
          cardCount: typeof board.card_count === 'string'
              ? parseInt(board.card_count, 10)
              : (board.card_count ?? 0),
          createdAt: board.created_at,
          hasPassword: board.hasPassword,
          workspaceId: board.workspace_id
        }));
        res.json(boardList);
      } catch (error: any) { // Type error
        next(error);
      }
    });

    // Get velocity teams for a workspace
    router.get('/:id/velocity-teams', authenticateToken, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
      try {
        const workspaceId: string = req.params.id;
        // Assert req.user exists
        const userId: string = req.user!.userId;

        // Use injected dependency
        const role: WorkspaceRole | null = await workspaceDb.getUserWorkspaceRole(workspaceId, userId);

        if (!role) {
          res.status(403).json({ error: 'You do not have access to this workspace' });
          return;
        }

        // Use injected dependency from velocityDb
        const teams: WorkspaceVelocityTeam[] = await velocityDb.getWorkspaceVelocityTeams(workspaceId);
        // Type is already WorkspaceVelocityTeam, no mapping needed unless transforming
        const teamList = teams;
        res.json(teamList);
      } catch (error: any) { // Type error
        next(error);
      }
    });

    // --- Workspace Invitations API ---

    // Generate a new invitation link for a workspace
    router.post('/:id/invitations', authenticateToken, async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
      try {
        const workspaceId: string = req.params.id;
        // Assert req.user exists
        const userId: string = req.user!.userId;
        const { roleToAssign = 'member', expiresInDays = 7 } = req.body;

        // Use injected dependency
        const userRole: WorkspaceRole | null = await workspaceDb.getUserWorkspaceRole(workspaceId, userId);
        if (userRole !== 'admin') {
          res.status(403).json({ error: 'Forbidden: Only admins can create invitations.' });
          return;
        }

        const token: string = await workspaceDb.createInvitation(workspaceId, userId, roleToAssign as WorkspaceRole, expiresInDays);
        res.status(201).json({ token });

      } catch (error: any) { // Type error
        next(error);
      }
    });

    // Accept a workspace invitation
    router.post('/invitations/accept', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { token } = req.body;
        // Assert req.user exists
        const userId: string = req.user!.userId;

        if (!token) {
          res.status(400).json({ error: 'Invitation token is required.' });
          return;
        }

        // Use injected dependency
        const invitation: ValidWorkspaceInvitation | null = await workspaceDb.findValidInvitationByToken(token);
        if (!invitation) {
          res.status(400).json({ error: 'Invalid or expired invitation token.' });
          return;
        }

        // Assert invitation is not null
        const { id: invitationId, workspace_id: invWorkspaceId, role_to_assign: roleToAssign } = invitation!;

        // Use injected dependency
        const alreadyMember: boolean = await workspaceDb.isWorkspaceMember(invWorkspaceId, userId);
        if (alreadyMember) {
           res.status(200).json({ message: 'You are already a member of this workspace.', workspaceId: invWorkspaceId });
           return;
        }

        // Use injected dependency
        await workspaceDb.addWorkspaceMember(invWorkspaceId, userId, roleToAssign);

        // Use injected dependency
        await workspaceDb.markInvitationAsUsed(invitationId, userId);
        res.status(200).json({ message: 'Successfully joined workspace!', workspaceId: invWorkspaceId });

      } catch (error: any) { // Type error
         if (error.code === '23505') {
            // Need to re-fetch invitation to get workspaceId if add failed but find succeeded
            const invitation: ValidWorkspaceInvitation | null = await workspaceDb.findValidInvitationByToken(req.body.token).catch(() => null);
            res.status(409).json({ message: 'You are already a member of this workspace.', workspaceId: invitation?.workspace_id });
            return;
         }
        next(error);
      }
    });


    return router; // Return the configured router
}

// Removed default export of router instance

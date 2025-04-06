import express from 'express';
// import { pool } from '../db/pool.js'; // Removed pool import
// Removed direct DB imports
// import { ... } from '../db/workspaces.js';
// import { getUserByEmail } from '../db/users.js';
// import { getWorkspaceRooms } from '../db/poker.js';
// import { getWorkspaceRetroBoards } from '../db/retro.js';
// import { getWorkspaceVelocityTeams } from '../db/velocity.js';
import { authenticateToken } from '../middleware/auth.js';
import logger from '../logger.js';

// Wrap routes in a setup function that accepts db dependencies
export default function setupWorkspaceRoutes(workspaceDb, userDb, pokerDb, retroDb, velocityDb) {
    const router = express.Router();
    // Removed destructuring, will access directly

    // Create a new workspace
    router.post('/', authenticateToken, async (req, res, next) => {
      try {
        const { name, description } = req.body;
        const userId = req.user.userId;

        if (!name) {
          return res.status(400).json({ error: 'Workspace name is required' });
        }

        // Use injected dependency
        const workspace = await workspaceDb.createWorkspace(name, description, userId); // Removed pool

        res.status(201).json({
          message: 'Workspace created successfully',
          workspace,
        });
      } catch (error) {
        logger.error('Create workspace error:', { error: error.message, stack: error.stack, userId: req.user?.userId, body: req.body });
        next(error);
      }
    });

    // Get user's workspaces
    router.get('/', authenticateToken, async (req, res, next) => {
      try {
        const userId = req.user.userId;
        // Use injected dependency
        const workspaces = await workspaceDb.getUserWorkspaces(userId); // Removed pool

        res.json(workspaces);
      } catch (error) {
        logger.error('Get workspaces error:', { error: error.message, stack: error.stack, userId: req.user?.userId });
        next(error);
      }
    });

    // Get a specific workspace
    router.get('/:id', authenticateToken, async (req, res, next) => {
      try {
        const workspaceId = req.params.id;
        // Use injected dependency
        const workspace = await workspaceDb.getWorkspaceById(workspaceId); // Removed pool

        if (!workspace) {
          return res.status(404).json({ error: 'Workspace not found' });
        }
        res.json(workspace);
      } catch (error) {
        logger.error('Get workspace error:', { error: error.message, stack: error.stack, userId: req.user?.userId, workspaceId: req.params.id });
        next(error);
      }
    });

    // Update a workspace
    router.put('/:id', authenticateToken, async (req, res, next) => {
      try {
        const workspaceId = req.params.id;
        const { name, description } = req.body;
        const userId = req.user.userId;

        // Use injected dependency
        const role = await workspaceDb.getUserWorkspaceRole(workspaceId, userId); // Removed pool

        if (!role || role !== 'admin') {
          return res.status(403).json({ error: 'You do not have permission to update this workspace' });
        }

        if (!name) {
          return res.status(400).json({ error: 'Workspace name is required' });
        }

        // Use injected dependency
        const workspace = await workspaceDb.updateWorkspace(workspaceId, name, description); // Removed pool

        res.json({
          message: 'Workspace updated successfully',
          workspace,
        });
      } catch (error) {
        logger.error('Update workspace error:', { error: error.message, stack: error.stack, userId: req.user?.userId, workspaceId: req.params.id, body: req.body });
        next(error);
      }
    });

    // Add a member to a workspace
    router.post('/:id/members', authenticateToken, async (req, res, next) => {
      try {
        const workspaceId = req.params.id;
        const { email, role } = req.body;
        const userId = req.user.userId;

        // Use injected dependency
        const userRole = await workspaceDb.getUserWorkspaceRole(workspaceId, userId); // Removed pool

        if (!userRole || userRole !== 'admin') {
          return res.status(403).json({ error: 'You do not have permission to add members' });
        }

        // Use injected dependency
        const user = await userDb.getUserByEmail(email); // Removed pool

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Use injected dependency
        await workspaceDb.addWorkspaceMember(workspaceId, user.id, role || 'member'); // Removed pool

        res.status(201).json({
          message: 'Member added successfully',
        });
      } catch (error) {
        if (error.code === '23505') {
          logger.warn(`Attempt to add duplicate member: User ${req.body.email} to workspace ${req.params.id}`);
          return res.status(409).json({ error: 'User is already a member of this workspace.' });
        }
        logger.error('Add member error:', { error: error.message, stack: error.stack, userId: req.user?.userId, workspaceId: req.params.id, body: req.body });
        next(error);
      }
    });

    // Remove a member from a workspace
    router.delete('/:id/members/:memberId', authenticateToken, async (req, res, next) => {
      try {
        const workspaceId = req.params.id;
        const memberId = req.params.memberId;
        const userId = req.user.userId;

        // Use injected dependency
        const userRole = await workspaceDb.getUserWorkspaceRole(workspaceId, userId); // Removed pool

        if (!userRole || userRole !== 'admin') {
          return res.status(403).json({ error: 'You do not have permission to remove members' });
        }

        // Use injected dependency
        const workspace = await workspaceDb.getWorkspaceById(workspaceId); // Removed pool
        if (!workspace) {
          logger.error(`Workspace ${workspaceId} not found during member removal check by user ${userId}`);
          return res.status(404).json({ error: 'Workspace not found' });
        }
        if (workspace.owner_id === memberId) {
          logger.warn(`User ${userId} attempted to remove owner ${memberId} from workspace ${workspaceId}`);
          return res.status(403).json({ error: 'Cannot remove the workspace owner.' });
        }

        // Use injected dependency
        await workspaceDb.removeWorkspaceMember(workspaceId, memberId); // Removed pool
        // The original code had duplicate checks here, removed them.
        // The removeWorkspaceMember function should handle non-existent members gracefully (e.g., affect 0 rows).

        res.json({
          message: 'Member removed successfully',
        });
      } catch (error) {
        logger.error('Remove member error:', { error: error.message, stack: error.stack, userId: req.user?.userId, workspaceId: req.params.id, memberId: req.params.memberId });
        next(error);
      }
    });

    // Get workspace members
    router.get('/:id/members', authenticateToken, async (req, res, next) => {
      try {
        const workspaceId = req.params.id;
        const userId = req.user.userId;

        // Use injected dependency
        const role = await workspaceDb.getUserWorkspaceRole(workspaceId, userId); // Removed pool

        if (!role) {
          return res.status(403).json({ error: 'You do not have access to this workspace' });
        }

        // Use injected dependency
        const members = await workspaceDb.getWorkspaceMembers(workspaceId); // Removed pool
        res.json(members);
      } catch (error) {
        logger.error('Get members error:', { error: error.message, stack: error.stack, userId: req.user?.userId, workspaceId: req.params.id });
        next(error);
      }
    });

    // Get poker rooms for a workspace
    router.get('/:id/rooms', authenticateToken, async (req, res, next) => {
      try {
        const workspaceId = req.params.id;
        const userId = req.user.userId;

        // Use injected dependency
        const role = await workspaceDb.getUserWorkspaceRole(workspaceId, userId); // Removed pool

        if (!role) {
          return res.status(403).json({ error: 'You do not have access to this workspace' });
        }

        // Use injected dependency from pokerDb
        const rooms = await pokerDb.getWorkspaceRooms(workspaceId);

        const roomList = rooms.map(room => ({
          id: room.id,
          name: room.name,
          participantCount: parseInt(room.participant_count) || 0,
          createdAt: room.created_at,
          hasPassword: !!room.password,
          sequence: room.sequence,
          workspaceId: room.workspace_id
        }));
        res.json(roomList);
      } catch (error) {
        logger.error('Get workspace rooms error:', { error: error.message, stack: error.stack, userId: req.user?.userId, workspaceId: req.params.id });
        next(error);
      }
    });

    // Get retro boards for a workspace
    router.get('/:id/retros', authenticateToken, async (req, res, next) => {
      try {
        const workspaceId = req.params.id;
        const userId = req.user.userId;

        // Use injected dependency
        const role = await workspaceDb.getUserWorkspaceRole(workspaceId, userId); // Removed pool

        if (!role) {
          return res.status(403).json({ error: 'You do not have access to this workspace' });
        }

        // Use injected dependency from retroDb
        const boards = await retroDb.getWorkspaceRetroBoards(workspaceId);

        const boardList = boards.map(board => ({
          id: board.id,
          name: board.name,
          cardCount: parseInt(board.card_count) || 0,
          createdAt: board.created_at,
          hasPassword: board.hasPassword,
          workspaceId: board.workspace_id
        }));
        res.json(boardList);
      } catch (error) {
        logger.error('Get workspace retro boards error:', { error: error.message, stack: error.stack, userId: req.user?.userId, workspaceId: req.params.id });
        next(error);
      }
    });

    // Get velocity teams for a workspace
    router.get('/:id/velocity-teams', authenticateToken, async (req, res, next) => {
      try {
        const workspaceId = req.params.id;
        const userId = req.user.userId;

        // Use injected dependency
        const role = await workspaceDb.getUserWorkspaceRole(workspaceId, userId); // Removed pool

        if (!role) {
          return res.status(403).json({ error: 'You do not have access to this workspace' });
        }

        // Use injected dependency from velocityDb
        const teams = await velocityDb.velocityUtils.getWorkspaceVelocityTeams(workspaceId); // Access method via velocityDb.velocityUtils

        const teamList = teams.map(team => ({
          id: team.id,
          name: team.name,
          createdAt: team.created_at,
          avgVelocityPreview: team.avg_velocity_preview
        }));
        res.json(teamList);
      } catch (error) {
        logger.error('Get workspace velocity teams error:', { error: error.message, stack: error.stack, userId: req.user?.userId, workspaceId: req.params.id });
        next(error);
      }
    });

    // --- Workspace Invitations API ---

    // Generate a new invitation link for a workspace
    router.post('/:id/invitations', authenticateToken, async (req, res, next) => {
      try {
        const workspaceId = req.params.id;
        const userId = req.user.userId;
        const { roleToAssign = 'member', expiresInDays = 7 } = req.body;

        // Use injected dependency
        const userRole = await workspaceDb.getUserWorkspaceRole(workspaceId, userId); // Removed pool
        if (userRole !== 'admin') {
          logger.warn(`User ${userId} attempted to create invite for workspace ${workspaceId} without admin rights.`);
          return res.status(403).json({ error: 'Forbidden: Only admins can create invitations.' });
        }

        // Use injected dependency
        // Pass pool, crypto is handled by default param in DB function
        const token = await workspaceDb.createInvitation(workspaceId, userId, roleToAssign, expiresInDays); // Removed pool

        logger.info(`User ${userId} created invitation token for workspace ${workspaceId}`);
        res.status(201).json({ token });

      } catch (error) {
        logger.error('Error creating workspace invitation:', { error: error.message, stack: error.stack, userId: req.user?.userId, workspaceId: req.params.id, body: req.body });
        next(error);
      }
    });

    // Accept a workspace invitation
    router.post('/invitations/accept', authenticateToken, async (req, res, next) => {
      try {
        const { token } = req.body;
        const userId = req.user.userId;

        if (!token) {
          return res.status(400).json({ error: 'Invitation token is required.' });
        }

        // Use injected dependency
        const invitation = await workspaceDb.findValidInvitationByToken(token); // Removed pool
        if (!invitation) {
          logger.warn(`User ${userId} attempted to use invalid/expired token: ${token}`);
          return res.status(400).json({ error: 'Invalid or expired invitation token.' });
        }

        const { id: invitationId, workspace_id: workspaceId, role_to_assign: roleToAssign } = invitation;

        // Use injected dependency
        const alreadyMember = await workspaceDb.isWorkspaceMember(workspaceId, userId); // Removed pool
        if (alreadyMember) {
           logger.info(`User ${userId} tried to accept invite for workspace ${workspaceId} but is already a member.`);
           return res.status(200).json({ message: 'You are already a member of this workspace.', workspaceId });
        }

        // Use injected dependency
        await workspaceDb.addWorkspaceMember(workspaceId, userId, roleToAssign); // Removed pool

        // Use injected dependency
        const marked = await workspaceDb.markInvitationAsUsed(invitationId, userId); // Removed pool
        if (!marked) {
            logger.warn(`Failed to mark invitation ${invitationId} as used for user ${userId}, possibly already used concurrently.`);
        }

        logger.info(`User ${userId} successfully joined workspace ${workspaceId} using token ${token}`);
        res.status(200).json({ message: 'Successfully joined workspace!', workspaceId });

      } catch (error) {
         if (error.code === '23505') {
            logger.warn(`Error accepting invitation for user ${req.user?.userId} - likely already a member: ${error.message}`);
            // Need to re-fetch invitation to get workspaceId if add failed but find succeeded
            const invitation = await workspaceDb.findValidInvitationByToken(req.body.token).catch(() => null); // Removed pool
            return res.status(409).json({ message: 'You are already a member of this workspace.', workspaceId: invitation?.workspace_id });
         }
        logger.error('Error accepting workspace invitation:', { error: error.message, stack: error.stack, userId: req.user?.userId, body: req.body });
        next(error);
      }
    });


    return router; // Return the configured router
}

// Removed default export of router instance

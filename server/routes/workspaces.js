import express from 'express';
import {
  createWorkspace,
  getUserWorkspaces,
  getWorkspaceById,
  addWorkspaceMember,
  removeWorkspaceMember,
  getWorkspaceMembers,
  updateWorkspace,
  getUserWorkspaceRole,
  createInvitation, // Import DB function for creating invites
  findValidInvitationByToken, // Import DB function for finding invites
  markInvitationAsUsed, // Import DB function for marking invites used
  isWorkspaceMember // Import DB function to check membership
} from '../db/workspaces.js';
import { getUserByEmail } from '../db/users.js';
import { getWorkspaceRooms } from '../db/poker.js';
import { getWorkspaceRetroBoards } from '../db/retro.js';
import { getWorkspaceVelocityTeams } from '../db/velocity.js'; // Import velocity teams function
import { authenticateToken } from '../middleware/auth.js';
import logger from '../logger.js'; // Import the logger

const router = express.Router();

// Create a new workspace
// Add 'next'
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const userId = req.user.userId;
    
    if (!name) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }
    
    const workspace = await createWorkspace(name, description, userId);
    
    res.status(201).json({
      message: 'Workspace created successfully',
      workspace,
    });
  } catch (error) {
    logger.error('Create workspace error:', { error: error.message, stack: error.stack, userId: req.user?.userId, body: req.body });
    // Pass error to the centralized handler
    next(error);
  }
});

// Get user's workspaces
// Add 'next'
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const workspaces = await getUserWorkspaces(userId);

    res.json(workspaces);
  } catch (error) {
    logger.error('Get workspaces error:', { error: error.message, stack: error.stack, userId: req.user?.userId });
    // Pass error to the centralized handler
    next(error);
  }
});

// Get a specific workspace
// Add 'next'
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const workspaceId = req.params.id;
    const workspace = await getWorkspaceById(workspaceId);
    
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    res.json(workspace);
  } catch (error) {
    logger.error('Get workspace error:', { error: error.message, stack: error.stack, userId: req.user?.userId, workspaceId: req.params.id });
    // Pass error to the centralized handler
    next(error);
  }
});

// Update a workspace
// Add 'next'
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const workspaceId = req.params.id;
    const { name, description } = req.body;
    const userId = req.user.userId;
    
    // Check if user has admin rights
    const role = await getUserWorkspaceRole(workspaceId, userId);
    
    if (!role || role !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to update this workspace' });
    }
    
    if (!name) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }
    
    const workspace = await updateWorkspace(workspaceId, name, description);
    
    res.json({
      message: 'Workspace updated successfully',
      workspace,
    });
  } catch (error) {
    logger.error('Update workspace error:', { error: error.message, stack: error.stack, userId: req.user?.userId, workspaceId: req.params.id, body: req.body });
    // Pass error to the centralized handler
    next(error);
  }
});

// Add a member to a workspace
// Add 'next'
router.post('/:id/members', authenticateToken, async (req, res, next) => {
  try {
    const workspaceId = req.params.id;
    const { email, role } = req.body;
    const userId = req.user.userId;
    
    // Check if user has admin rights
    const userRole = await getUserWorkspaceRole(workspaceId, userId);
    
    if (!userRole || userRole !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to add members' });
    }
    
    // Find the user by email
    const user = await getUserByEmail(email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await addWorkspaceMember(workspaceId, user.id, role || 'member');
    
    res.status(201).json({
      message: 'Member added successfully',
    });
  } catch (error) {
    // Handle specific DB errors
    if (error.code === '23505') { // Unique violation (already a member)
      logger.warn(`Attempt to add duplicate member: User ${req.body.email} to workspace ${req.params.id}`);
      return res.status(409).json({ error: 'User is already a member of this workspace.' });
    }
    logger.error('Add member error:', { error: error.message, stack: error.stack, userId: req.user?.userId, workspaceId: req.params.id, body: req.body });
    // Pass other errors to the centralized handler
    next(error);
  }
});

// Remove a member from a workspace
// Add 'next'
router.delete('/:id/members/:memberId', authenticateToken, async (req, res, next) => {
  try {
    const workspaceId = req.params.id;
    const memberId = req.params.memberId;
    const userId = req.user.userId;
    
    // Check if user has admin rights
    const userRole = await getUserWorkspaceRole(workspaceId, userId);
    
    if (!userRole || userRole !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to remove members' });
    }
    
    // Check if trying to remove the owner
    const workspace = await getWorkspaceById(workspaceId); // Fetch workspace to get owner ID
    if (!workspace) {
      // This case should ideally be caught by earlier checks or DB constraints, but handle defensively
      logger.error(`Workspace ${workspaceId} not found during member removal check by user ${userId}`);
      return res.status(404).json({ error: 'Workspace not found' });
    }
    if (workspace.owner_id === memberId) {
      logger.warn(`User ${userId} attempted to remove owner ${memberId} from workspace ${workspaceId}`);
      return res.status(403).json({ error: 'Cannot remove the workspace owner.' });
    }

    await removeWorkspaceMember(workspaceId, memberId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' }); // Should ideally not happen if admin check passed
    }
    if (workspace.owner_id === memberId) {
      logger.warn(`User ${userId} attempted to remove owner ${memberId} from workspace ${workspaceId}`);
      return res.status(403).json({ error: 'Cannot remove the workspace owner.' });
    }

    await removeWorkspaceMember(workspaceId, memberId);
    
    res.json({
      message: 'Member removed successfully',
    });
  } catch (error) {
    logger.error('Remove member error:', { error: error.message, stack: error.stack, userId: req.user?.userId, workspaceId: req.params.id, memberId: req.params.memberId });
    // Pass error to the centralized handler
    next(error);
  }
});

// Get workspace members
// Add 'next'
router.get('/:id/members', authenticateToken, async (req, res, next) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user.userId;
    
    // Check if user is a member of the workspace
    const role = await getUserWorkspaceRole(workspaceId, userId);
    
    if (!role) {
      return res.status(403).json({ error: 'You do not have access to this workspace' });
    }
    
    const members = await getWorkspaceMembers(workspaceId);
    res.json(members);
  } catch (error) {
    logger.error('Get members error:', { error: error.message, stack: error.stack, userId: req.user?.userId, workspaceId: req.params.id });
    // Pass error to the centralized handler
    next(error);
  }
});

// Get poker rooms for a workspace
// Add 'next'
router.get('/:id/rooms', authenticateToken, async (req, res, next) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user.userId;
    
    // Check if user is a member of the workspace
    const role = await getUserWorkspaceRole(workspaceId, userId);
    
    if (!role) {
      return res.status(403).json({ error: 'You do not have access to this workspace' });
    }
    
    const rooms = await getWorkspaceRooms(workspaceId);
    
    // Format rooms for client
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
    // Pass error to the centralized handler
    next(error);
  }
});

// Get retro boards for a workspace
// Add 'next'
router.get('/:id/retros', authenticateToken, async (req, res, next) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user.userId;
    
    // Check if user is a member of the workspace
    const role = await getUserWorkspaceRole(workspaceId, userId);
    
    if (!role) {
      return res.status(403).json({ error: 'You do not have access to this workspace' });
    }
    
    const boards = await getWorkspaceRetroBoards(workspaceId);
    
    // Format boards for client
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
    // Pass error to the centralized handler
    next(error);
  }
});

// Get velocity teams for a workspace
// Add 'next'
router.get('/:id/velocity-teams', authenticateToken, async (req, res, next) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user.userId;

    // Check if user is a member of the workspace
    const role = await getUserWorkspaceRole(workspaceId, userId);

    if (!role) {
      return res.status(403).json({ error: 'You do not have access to this workspace' });
    }

    const teams = await getWorkspaceVelocityTeams(workspaceId);

    // Format teams for client (optional, adjust as needed)
    const teamList = teams.map(team => ({
      id: team.id,
      name: team.name,
      createdAt: team.created_at,
      avgVelocityPreview: team.avg_velocity_preview // Include the preview if calculated
    }));
    res.json(teamList);
  } catch (error) {
    logger.error('Get workspace velocity teams error:', { error: error.message, stack: error.stack, userId: req.user?.userId, workspaceId: req.params.id });
    // Pass error to the centralized handler
    next(error);
  }
});

// --- Workspace Invitations API ---

// Generate a new invitation link for a workspace
router.post('/:id/invitations', authenticateToken, async (req, res, next) => {
  try {
    const workspaceId = req.params.id;
    const userId = req.user.userId;
    const { roleToAssign = 'member', expiresInDays = 7 } = req.body; // Allow specifying role and expiry

    // 1. Verify user is admin of the workspace
    const userRole = await getUserWorkspaceRole(workspaceId, userId);
    if (userRole !== 'admin') {
      logger.warn(`User ${userId} attempted to create invite for workspace ${workspaceId} without admin rights.`);
      return res.status(403).json({ error: 'Forbidden: Only admins can create invitations.' });
    }

    // 2. Create invitation in DB
    const token = await createInvitation(workspaceId, userId, roleToAssign, expiresInDays);

    // 3. Return the invite link (or just the token)
    // Constructing the full link might be better done on the frontend
    // const inviteLink = `${req.protocol}://${req.get('host')}/join-workspace?token=${token}`; // Example link construction
    logger.info(`User ${userId} created invitation token for workspace ${workspaceId}`);
    res.status(201).json({ token }); // Return only the token

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

    // 1. Find valid invitation
    const invitation = await findValidInvitationByToken(token);
    if (!invitation) {
      logger.warn(`User ${userId} attempted to use invalid/expired token: ${token}`);
      return res.status(400).json({ error: 'Invalid or expired invitation token.' });
    }

    const { id: invitationId, workspace_id: workspaceId, role_to_assign: roleToAssign } = invitation;

    // 2. Check if user is already a member
    const alreadyMember = await isWorkspaceMember(workspaceId, userId);
    if (alreadyMember) {
       logger.info(`User ${userId} tried to accept invite for workspace ${workspaceId} but is already a member.`);
       // Optionally mark token as used even if already a member? Or just return success.
       // await markInvitationAsUsed(invitationId, userId); // Decide if needed
       return res.status(200).json({ message: 'You are already a member of this workspace.', workspaceId });
    }

    // 3. Add user to workspace members
    await addWorkspaceMember(workspaceId, userId, roleToAssign);

    // 4. Mark invitation as used
    const marked = await markInvitationAsUsed(invitationId, userId);
    if (!marked) {
        // This might happen in a race condition, log it but proceed as user was added
        logger.warn(`Failed to mark invitation ${invitationId} as used for user ${userId}, possibly already used concurrently.`);
    }

    logger.info(`User ${userId} successfully joined workspace ${workspaceId} using token ${token}`);
    res.status(200).json({ message: 'Successfully joined workspace!', workspaceId });

  } catch (error) {
     // Handle potential DB errors during addWorkspaceMember specifically?
     if (error.code === '23505') { // Unique violation (likely already a member, though checked above)
        logger.warn(`Error accepting invitation for user ${req.user?.userId} - likely already a member: ${error.message}`);
        // Find workspace ID again if needed to return it
        const invitation = await findValidInvitationByToken(req.body.token);
        return res.status(409).json({ message: 'You are already a member of this workspace.', workspaceId: invitation?.workspace_id });
     }
    logger.error('Error accepting workspace invitation:', { error: error.message, stack: error.stack, userId: req.user?.userId, body: req.body });
    next(error);
  }
});


export default router;

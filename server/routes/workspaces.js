import express from 'express';
import { 
  createWorkspace, 
  getUserWorkspaces, 
  getWorkspaceById, 
  addWorkspaceMember, 
  removeWorkspaceMember, 
  getWorkspaceMembers, 
  updateWorkspace,
  getUserWorkspaceRole
} from '../db/workspaces.js';
import { getUserByEmail } from '../db/users.js';
import { getWorkspaceRooms } from '../db/poker.js';
import { getWorkspaceRetroBoards } from '../db/retro.js';
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
    // Handle potential specific errors like duplicate member?
    logger.error('Add member error:', { error: error.message, stack: error.stack, userId: req.user?.userId, workspaceId: req.params.id, body: req.body });
    // Pass error to the centralized handler
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

export default router;

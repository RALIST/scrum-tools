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

const router = express.Router();

// Create a new workspace
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    const userId = req.user.userId;
    
    if (!name) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }
    
    const workspace = await createWorkspace(name, description, userId);
    
    res.status(201).json({
      message: 'Workspace created successfully',
      workspace
    });
  } catch (error) {
    console.error('Create workspace error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's workspaces
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const workspaces = await getUserWorkspaces(userId);
    
    res.json(workspaces);
  } catch (error) {
    console.error('Get workspaces error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a specific workspace
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const workspace = await getWorkspaceById(workspaceId);
    
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    
    res.json(workspace);
  } catch (error) {
    console.error('Get workspace error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a workspace
router.put('/:id', authenticateToken, async (req, res) => {
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
      workspace
    });
  } catch (error) {
    console.error('Update workspace error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add a member to a workspace
router.post('/:id/members', authenticateToken, async (req, res) => {
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
      message: 'Member added successfully'
    });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove a member from a workspace
router.delete('/:id/members/:memberId', authenticateToken, async (req, res) => {
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
      message: 'Member removed successfully'
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get workspace members
router.get('/:id/members', authenticateToken, async (req, res) => {
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
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get poker rooms for a workspace
router.get('/:id/rooms', authenticateToken, async (req, res) => {
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
    console.error('Get workspace rooms error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get retro boards for a workspace
router.get('/:id/retros', authenticateToken, async (req, res) => {
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
    console.error('Get workspace retro boards error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
import { pool } from './pool.js';
import { v4 as uuidv4 } from 'uuid';
import { createTeam } from './velocity.js'; // Import createTeam

// Create a new workspace
export const createWorkspace = async (name, description, ownerId) => {
  const client = await pool.connect();
  try {
    // Generate a unique ID
    const id = uuidv4();
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Insert the new workspace
    const result = await client.query(
      'INSERT INTO workspaces (id, name, description, owner_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, name, description, ownerId]
    );
    
    // Add the owner as a member with 'admin' role
    await client.query(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
      [id, ownerId, 'admin']
    );

    // Create a default team with the same name as the workspace
    const defaultTeamId = uuidv4();
    // Pass the existing client and the workspace name to createTeam
    await createTeam(defaultTeamId, name, null, id, null, client); // Use 'name' (workspace name) instead of 'My team'

    // Commit transaction
    await client.query('COMMIT');
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Get workspaces for a user
export const getUserWorkspaces = async (userId) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT w.*, wm.role 
      FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE wm.user_id = $1
      ORDER BY w.created_at DESC
    `, [userId]);
    
    return result.rows;
  } finally {
    client.release();
  }
};

// Get workspace by ID
export const getWorkspaceById = async (workspaceId) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM workspaces WHERE id = $1',
      [workspaceId]
    );
    
    return result.rows[0] || null;
  } finally {
    client.release();
  }
};

// Add a member to a workspace
export const addWorkspaceMember = async (workspaceId, userId, role = 'member') => {
  const client = await pool.connect();
  try {
    await client.query(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
      [workspaceId, userId, role]
    );
  } finally {
    client.release();
  }
};

// Remove a member from a workspace
export const removeWorkspaceMember = async (workspaceId, userId) => {
  const client = await pool.connect();
  try {
    await client.query(
      'DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );
  } finally {
    client.release();
  }
};

// Get workspace members
export const getWorkspaceMembers = async (workspaceId) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT u.id, u.name, u.email, wm.role, wm.joined_at
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = $1
      ORDER BY wm.role, u.name
    `, [workspaceId]);
    
    return result.rows;
  } finally {
    client.release();
  }
};

// Update workspace info
export const updateWorkspace = async (workspaceId, name, description) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'UPDATE workspaces SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, description, workspaceId]
    );
    
    return result.rows[0];
  } finally {
    client.release();
  }
};

// Check if user is a member of workspace
export const isWorkspaceMember = async (workspaceId, userId) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );
    
    return result.rows.length > 0;
  } finally {
    client.release();
  }
};

// Get user role in workspace
export const getUserWorkspaceRole = async (workspaceId, userId) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );
    
    return result.rows.length > 0 ? result.rows[0].role : null;
  } finally {
    client.release();
  }
};

// --- Workspace Invitations ---

// Create a new invitation token
export const createInvitation = async (workspaceId, createdBy, roleToAssign, expiresInDays = 7) => {
  const client = await pool.connect();
  try {
    const { randomBytes } = await import('crypto'); // Use dynamic import for crypto
    const token = randomBytes(16).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const queryText = `
      INSERT INTO workspace_invitations (workspace_id, token, role_to_assign, expires_at, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING token
    `;
    const params = [workspaceId, token, roleToAssign, expiresAt, createdBy];
    const result = await client.query(queryText, params);
    return result.rows[0].token;
  } finally {
    client.release();
  }
};

// Find a valid invitation by token
export const findValidInvitationByToken = async (token) => {
  const client = await pool.connect();
  try {
    const queryText = `
      SELECT id, workspace_id, role_to_assign
      FROM workspace_invitations
      WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()
    `;
    const params = [token];
    const result = await client.query(queryText, params);
    return result.rows[0] || null; // Return the invite details or null if not found/valid
  } finally {
    client.release();
  }
};

// Mark an invitation as used
export const markInvitationAsUsed = async (invitationId, usedByUserId) => {
  const client = await pool.connect();
  try {
    const queryText = `
      UPDATE workspace_invitations
      SET used_at = NOW(), used_by = $2
      WHERE id = $1 AND used_at IS NULL -- Ensure it wasn't used concurrently
      RETURNING id
    `;
    const params = [invitationId, usedByUserId];
    const result = await client.query(queryText, params);
    return result.rowCount > 0; // Return true if update was successful
  } finally {
    client.release();
  }
};

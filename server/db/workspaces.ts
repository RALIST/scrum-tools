import pg, { PoolClient, QueryResult } from 'pg'; // Import pg types
import { pool as defaultPool } from './pool.js'; // Rename default import (needs .js)
import { v4 as uuidv4 } from 'uuid';
import * as velocityDb from './velocity.js'; // Import velocityDb namespace (needs .js)
import crypto from 'crypto'; // Import the full crypto module
import { Workspace, WorkspaceRole, WorkspaceMemberDetails, ValidWorkspaceInvitation } from '../types/db.js'; // Import types (needs .js)

// Create a new workspace
export const createWorkspace = async (
    name: string,
    description: string | null,
    ownerId: string
): Promise<Workspace> => {
  const client: PoolClient = await (defaultPool as pg.Pool).connect(); // Use internal defaultPool, assert type
  try {
    // Generate a unique ID
    const id: string = uuidv4();
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Insert the new workspace
    const result: QueryResult<Workspace> = await client.query(
      'INSERT INTO workspaces (id, name, description, owner_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, name, description, ownerId]
    );
    
    // Add the owner as a member with 'admin' role
    await client.query(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
      [id, ownerId, 'admin']
    );

    // Create a default team with the same name as the workspace
    const defaultTeamId: string = uuidv4();
    // Pass the existing client and the workspace name to createTeam
    // Use injected _createTeam, passing the client and executeQuery from the client
    // const dbExecutor = (queryText: string, params: any[]) => client.query(queryText, params); // This executor is not used anymore
    // createTeam now handles its own execution, just pass necessary args + client for transaction
    await velocityDb.createTeam(defaultTeamId, name, null, id, null, client);

    // Commit transaction
    await client.query('COMMIT');
    
    return result.rows[0];
  } catch (error: any) { // Type error
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Get workspaces for a user
// Type needs to include the joined 'role'
export const getUserWorkspaces = async (userId: string): Promise<Array<Workspace & { role: WorkspaceRole }>> => {
  const client: PoolClient = await (defaultPool as pg.Pool).connect(); // Use internal defaultPool, assert type
  try {
    const result: QueryResult<Workspace & { role: WorkspaceRole }> = await client.query(`
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
export const getWorkspaceById = async (workspaceId: string): Promise<Workspace | null> => {
  const client: PoolClient = await (defaultPool as pg.Pool).connect(); // Use internal defaultPool, assert type
  try {
    const result: QueryResult<Workspace> = await client.query(
      'SELECT * FROM workspaces WHERE id = $1',
      [workspaceId]
    );
    
    return result.rows[0] || null;
  } finally {
    client.release();
  }
};

// Add a member to a workspace
export const addWorkspaceMember = async (
    workspaceId: string,
    userId: string,
    role: WorkspaceRole = 'member'
): Promise<void> => {
  const client: PoolClient = await (defaultPool as pg.Pool).connect(); // Use internal defaultPool, assert type
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
export const removeWorkspaceMember = async (workspaceId: string, userId: string): Promise<void> => {
  const client: PoolClient = await (defaultPool as pg.Pool).connect(); // Use internal defaultPool, assert type
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
export const getWorkspaceMembers = async (workspaceId: string): Promise<WorkspaceMemberDetails[]> => {
  const client: PoolClient = await (defaultPool as pg.Pool).connect(); // Use internal defaultPool, assert type
  try {
    const result: QueryResult<WorkspaceMemberDetails> = await client.query(`
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
export const updateWorkspace = async (
    workspaceId: string,
    name: string,
    description: string | null
): Promise<Workspace> => {
  const client: PoolClient = await (defaultPool as pg.Pool).connect(); // Use internal defaultPool, assert type
  try {
    const result: QueryResult<Workspace> = await client.query(
      'UPDATE workspaces SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, description, workspaceId]
    );
    
    return result.rows[0];
  } finally {
    client.release();
  }
};

// Check if user is a member of workspace
export const isWorkspaceMember = async (workspaceId: string, userId: string): Promise<boolean> => {
  const client: PoolClient = await (defaultPool as pg.Pool).connect(); // Use internal defaultPool, assert type
  try {
    // Query doesn't need a specific result type, just checking rows.length
    const result: QueryResult<any> = await client.query(
      'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );
    
    return result.rows.length > 0;
  } finally {
    client.release();
  }
};

// Get user role in workspace
export const getUserWorkspaceRole = async (workspaceId: string, userId: string): Promise<WorkspaceRole | null> => {
  const client: PoolClient = await (defaultPool as pg.Pool).connect(); // Use internal defaultPool, assert type
  try {
    const result: QueryResult<{ role: WorkspaceRole }> = await client.query(
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
export const createInvitation = async (
    workspaceId: string,
    createdBy: string,
    roleToAssign: WorkspaceRole,
    expiresInDays: number = 7
): Promise<string> => {
  const client: PoolClient = await (defaultPool as pg.Pool).connect(); // Use internal defaultPool, assert type
  try {
    // Use the globally imported crypto module (which is spied on in tests)
    const token: string = crypto.randomBytes(16).toString('hex');
    const expiresAt: Date = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const queryText = `
      INSERT INTO workspace_invitations (workspace_id, token, role_to_assign, expires_at, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING token
    `;
    const params = [workspaceId, token, roleToAssign, expiresAt, createdBy];
    const result: QueryResult<{ token: string }> = await client.query(queryText, params);
    return result.rows[0].token;
  } finally {
    client.release();
  }
};

// Find a valid invitation by token
export const findValidInvitationByToken = async (token: string): Promise<ValidWorkspaceInvitation | null> => {
  const client: PoolClient = await (defaultPool as pg.Pool).connect(); // Use internal defaultPool, assert type
  try {
    const queryText = `
      SELECT id, workspace_id, role_to_assign
      FROM workspace_invitations
      WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()
    `;
    const params = [token];
    const result: QueryResult<ValidWorkspaceInvitation> = await client.query(queryText, params);
    return result.rows[0] || null; // Return the invite details or null if not found/valid
  } finally {
    client.release();
  }
};

// Mark an invitation as used
export const markInvitationAsUsed = async (invitationId: number, usedByUserId: string): Promise<boolean> => {
  const client: PoolClient = await (defaultPool as pg.Pool).connect(); // Use internal defaultPool, assert type
  try {
    const queryText = `
      UPDATE workspace_invitations
      SET used_at = NOW(), used_by = $2
      WHERE id = $1 AND used_at IS NULL -- Ensure it wasn't used concurrently
      RETURNING id
    `;
    const params = [invitationId, usedByUserId];
    const result: QueryResult<{ id: number }> = await client.query(queryText, params);
    return (result.rowCount ?? 0) > 0; // Handle potentially null rowCount
  } finally {
    client.release();
  }
};

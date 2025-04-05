import { pool } from './pool.js';
import { v4 as uuidv4 } from 'uuid';

// Create a history snapshot for a retro board
export const createRetroBoardSnapshot = async (boardId, snapshot) => {
  const client = await pool.connect();
  try {
    // Generate a unique ID
    const id = uuidv4();
    
    const result = await client.query(
      'INSERT INTO retro_board_history (id, board_id, snapshot) VALUES ($1, $2, $3) RETURNING *',
      [id, boardId, JSON.stringify(snapshot)]
    );
    
    return result.rows[0];
  } finally {
    client.release();
  }
};

// Get history snapshots for a retro board
export const getRetroBoardHistory = async (boardId) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM retro_board_history WHERE board_id = $1 ORDER BY created_at DESC',
      [boardId]
    );
    
    return result.rows;
  } finally {
    client.release();
  }
};

// Get a specific history snapshot
export const getHistorySnapshot = async (snapshotId) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM retro_board_history WHERE id = $1',
      [snapshotId]
    );
    
    return result.rows[0] || null;
  } finally {
    client.release();
  }
};

// Clean up old history (keeping only last 10 snapshots for a board)
export const cleanupBoardHistory = async (boardId) => {
  const client = await pool.connect();
  try {
    await client.query(`
      DELETE FROM retro_board_history 
      WHERE id IN (
        SELECT id FROM retro_board_history 
        WHERE board_id = $1 
        ORDER BY created_at DESC 
        OFFSET 10
      )
    `, [boardId]);
  } finally {
    client.release();
  }
};
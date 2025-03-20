import pool from './pool.js';

const runMigration = async () => {
  const client = await pool.connect();
  try {
    // Check if workspace_id column exists in retro_boards
    const retroBoardsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'retro_boards' AND column_name = 'workspace_id'
    `);
    
    if (retroBoardsCheck.rows.length === 0) {
      console.log('Adding workspace_id and created_by columns to retro_boards table...');
      await client.query(`
        ALTER TABLE retro_boards 
        ADD COLUMN workspace_id VARCHAR(255) REFERENCES workspaces(id) NULL,
        ADD COLUMN created_by VARCHAR(255) REFERENCES users(id) NULL
      `);
      console.log('Added workspace_id and created_by columns to retro_boards table');
    } else {
      console.log('workspace_id column already exists in retro_boards table');
    }

    // Check if workspace_id column exists in retro_boards
    const teamsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'teams' AND column_name = 'workspace_id'
    `);
    
    if (teamsCheck.rows.length === 0) {
      console.log('Adding workspace_id colums to teams table...');
      await client.query(`
        ALTER TABLE teams 
        ADD COLUMN workspace_id VARCHAR(255) REFERENCES workspaces(id) NULL
      `);
      console.log('Added workspace_id column to teams table');
    } else {
      console.log('workspace_id column already exists in teams table');
    }

    // Check if workspace_id column exists in rooms
    const roomsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'rooms' AND column_name = 'workspace_id'
    `);
    
    if (roomsCheck.rows.length === 0) {
      console.log('Adding workspace_id and created_by columns to rooms table...');
      await client.query(`
        ALTER TABLE rooms 
        ADD COLUMN workspace_id VARCHAR(255) REFERENCES workspaces(id) NULL,
        ADD COLUMN created_by VARCHAR(255) REFERENCES users(id) NULL
      `);
      console.log('Added workspace_id and created_by columns to rooms table');
    } else {
      console.log('workspace_id column already exists in rooms table');
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    client.release();
  }
};

runMigration().catch(console.error);
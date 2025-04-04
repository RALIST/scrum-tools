/* eslint-disable camelcase */

// Migration file should use CommonJS syntax if your migrate-config.cjs uses it.
// However, node-pg-migrate supports ES modules if configured.
// Let's assume ES module syntax based on the project's "type": "module".
// If errors occur, we might need to switch back to CommonJS (exports.up = ...)

export const shorthands = undefined;

export const up = (pgm) => {
  // Users table
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL, -- Note: schema.js uses this name
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP WITH TIME ZONE
    );
  `);

  // Workspaces table
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS workspaces (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        owner_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Workspace members table
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS workspace_members (
        workspace_id VARCHAR(255) REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'member',
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (workspace_id, user_id)
    );
  `);
  
  // Teams table (for velocity tracking) - Needs password_hash based on db/velocity.js logic
   pgm.sql(`
    CREATE TABLE IF NOT EXISTS teams (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        password VARCHAR(255), -- Changed from password_hash based on schema.js
        workspace_id VARCHAR(255) REFERENCES workspaces(id) NULL,
        created_by VARCHAR(255) REFERENCES users(id) NULL
    );
  `);

  // Sprints table
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS sprints (
        id VARCHAR(255) PRIMARY KEY,
        team_id VARCHAR(255) REFERENCES teams(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Sprint velocity table
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS sprint_velocity (
        sprint_id VARCHAR(255) REFERENCES sprints(id) ON DELETE CASCADE,
        committed_points INTEGER NOT NULL,
        completed_points INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (sprint_id)
    );
  `);

  // Rooms table (for planning poker)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255),
        sequence VARCHAR(50) DEFAULT 'fibonacci',
        password VARCHAR(255), -- Stores hash if password set
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        workspace_id VARCHAR(255) REFERENCES workspaces(id) NULL,
        created_by VARCHAR(255) REFERENCES users(id) NULL
    );
  `);

  // Participants table (for planning poker)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS participants (
        id VARCHAR(255),
        room_id VARCHAR(255) REFERENCES rooms(id) ON DELETE CASCADE,
        name VARCHAR(255),
        vote VARCHAR(50),
        user_id VARCHAR(255) REFERENCES users(id) NULL,
        PRIMARY KEY (id, room_id)
    );
  `);

  // Retro boards table
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS retro_boards (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        timer_running BOOLEAN DEFAULT false,
        time_left INTEGER DEFAULT 300,
        default_timer INTEGER DEFAULT 300,
        hide_cards_by_default BOOLEAN DEFAULT false,
        hide_author_names BOOLEAN DEFAULT false,
        password VARCHAR(255), -- Stores hash if password set
        workspace_id VARCHAR(255) REFERENCES workspaces(id) NULL,
        created_by VARCHAR(255) REFERENCES users(id) NULL
    );
  `);

  // Retro cards table
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS retro_cards (
        id VARCHAR(255) PRIMARY KEY,
        board_id VARCHAR(255) REFERENCES retro_boards(id) ON DELETE CASCADE,
        column_id VARCHAR(50),
        text TEXT,
        author_name VARCHAR(255),
        author_id VARCHAR(255) REFERENCES users(id) NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Retro card votes table
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS retro_card_votes (
        card_id VARCHAR(255) REFERENCES retro_cards(id) ON DELETE CASCADE,
        user_name VARCHAR(255),
        user_id VARCHAR(255) REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (card_id, user_id)
    );
  `);

  // Retro board history table
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS retro_board_history (
        id VARCHAR(255) PRIMARY KEY,
        board_id VARCHAR(255) REFERENCES retro_boards(id) ON DELETE CASCADE,
        snapshot JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

export const down = (pgm) => {
  // Drop tables in reverse order of creation due to dependencies
  pgm.sql(`DROP TABLE IF EXISTS retro_board_history;`);
  pgm.sql(`DROP TABLE IF EXISTS retro_card_votes;`);
  pgm.sql(`DROP TABLE IF EXISTS retro_cards;`);
  pgm.sql(`DROP TABLE IF EXISTS retro_boards;`);
  pgm.sql(`DROP TABLE IF EXISTS participants;`);
  pgm.sql(`DROP TABLE IF EXISTS rooms;`);
  pgm.sql(`DROP TABLE IF EXISTS sprint_velocity;`);
  pgm.sql(`DROP TABLE IF EXISTS sprints;`);
  pgm.sql(`DROP TABLE IF EXISTS teams;`);
  pgm.sql(`DROP TABLE IF EXISTS workspace_members;`);
  pgm.sql(`DROP TABLE IF EXISTS workspaces;`);
  pgm.sql(`DROP TABLE IF EXISTS users;`);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Users table
  await knex.schema.createTableIfNotExists('users', (table) => { // Use createTableIfNotExists
    table.string('id').primary();
    table.string('email').notNullable().unique();
    table.string('password_hash').notNullable();
    table.string('name').notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('last_login', { useTz: true });
  });

  // Workspaces table
  await knex.schema.createTableIfNotExists('workspaces', (table) => { // Use createTableIfNotExists
    table.string('id').primary();
    table.string('name').notNullable();
    table.text('description');
    table.string('owner_id').references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Workspace members table
  await knex.schema.createTableIfNotExists('workspace_members', (table) => { // Use createTableIfNotExists
    table.string('workspace_id').references('id').inTable('workspaces').onDelete('CASCADE');
    table.string('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('role', 50).defaultTo('member');
    table.timestamp('joined_at', { useTz: true }).defaultTo(knex.fn.now());
    table.primary(['workspace_id', 'user_id']); // Composite primary key
  });

  // Teams table (for velocity tracking)
  await knex.schema.createTableIfNotExists('teams', (table) => { // Use createTableIfNotExists
    table.string('id').primary();
    table.string('name').notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.string('password'); // Stores hash if password set
    table.string('workspace_id').references('id').inTable('workspaces').nullable();
    table.string('created_by').references('id').inTable('users').nullable();
  });

  // Sprints table
  await knex.schema.createTableIfNotExists('sprints', (table) => { // Use createTableIfNotExists
    table.string('id').primary();
    table.string('team_id').references('id').inTable('teams').onDelete('CASCADE');
    table.string('name').notNullable();
    table.date('start_date').notNullable();
    table.date('end_date').notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Sprint velocity table
  await knex.schema.createTableIfNotExists('sprint_velocity', (table) => { // Use createTableIfNotExists
    table.string('sprint_id').primary().references('id').inTable('sprints').onDelete('CASCADE');
    table.integer('committed_points').notNullable();
    table.integer('completed_points').notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Rooms table (for planning poker)
  await knex.schema.createTableIfNotExists('rooms', (table) => { // Use createTableIfNotExists
    table.string('id').primary();
    table.string('name');
    table.string('sequence', 50).defaultTo('fibonacci');
    table.string('password'); // Stores hash if password set
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.string('workspace_id').references('id').inTable('workspaces').nullable();
    table.string('created_by').references('id').inTable('users').nullable();
  });

  // Participants table (for planning poker)
  await knex.schema.createTableIfNotExists('participants', (table) => { // Use createTableIfNotExists
    table.string('id');
    table.string('room_id').references('id').inTable('rooms').onDelete('CASCADE');
    table.string('name');
    table.string('vote', 50);
    table.string('user_id').references('id').inTable('users').nullable();
    table.primary(['id', 'room_id']); // Composite primary key
  });

  // Retro boards table
  await knex.schema.createTableIfNotExists('retro_boards', (table) => { // Use createTableIfNotExists
    table.string('id').primary();
    table.string('name');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.boolean('timer_running').defaultTo(false);
    table.integer('time_left').defaultTo(300);
    table.integer('default_timer').defaultTo(300);
    table.boolean('hide_cards_by_default').defaultTo(false);
    table.boolean('hide_author_names').defaultTo(false);
    table.string('password'); // Stores hash if password set
    table.string('workspace_id').references('id').inTable('workspaces').nullable();
    table.string('created_by').references('id').inTable('users').nullable();
  });

  // Retro cards table
  await knex.schema.createTableIfNotExists('retro_cards', (table) => { // Use createTableIfNotExists
    table.string('id').primary();
    table.string('board_id').references('id').inTable('retro_boards').onDelete('CASCADE');
    table.string('column_id', 50);
    table.text('text');
    table.string('author_name');
    table.string('author_id').references('id').inTable('users').nullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Retro card votes table
  // Create in its original state as per the first old migration
  await knex.schema.createTableIfNotExists('retro_card_votes', (table) => { // Use createTableIfNotExists
    table.string('card_id').references('id').inTable('retro_cards').onDelete('CASCADE');
    table.string('user_name'); // Nullable initially
    table.string('user_id'); // Define column first
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.primary(['card_id', 'user_id']); // Original composite primary key
    // Define foreign key separately
    table.foreign('user_id').references('id').inTable('users');
  });

  // Retro board history table
  await knex.schema.createTableIfNotExists('retro_board_history', (table) => { // Use createTableIfNotExists
    table.string('id').primary();
    table.string('board_id').references('id').inTable('retro_boards').onDelete('CASCADE');
    table.jsonb('snapshot').notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Drop tables in reverse order of creation due to dependencies
  await knex.schema.dropTableIfExists('retro_board_history');
  await knex.schema.dropTableIfExists('retro_card_votes');
  await knex.schema.dropTableIfExists('retro_cards');
  await knex.schema.dropTableIfExists('retro_boards');
  await knex.schema.dropTableIfExists('participants');
  await knex.schema.dropTableIfExists('rooms');
  await knex.schema.dropTableIfExists('sprint_velocity');
  await knex.schema.dropTableIfExists('sprints');
  await knex.schema.dropTableIfExists('teams');
  await knex.schema.dropTableIfExists('workspace_members');
  await knex.schema.dropTableIfExists('workspaces');
  await knex.schema.dropTableIfExists('users');
};

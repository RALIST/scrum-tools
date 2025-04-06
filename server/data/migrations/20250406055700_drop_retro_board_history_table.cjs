/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  // Drop the retro_board_history table
  return knex.schema.dropTableIfExists('retro_board_history');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  // Recreate the retro_board_history table
  return knex.schema.createTableIfNotExists('retro_board_history', (table) => {
    table.string('id').primary();
    table.string('board_id').references('id').inTable('retro_boards').onDelete('CASCADE');
    table.jsonb('snapshot').notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
};

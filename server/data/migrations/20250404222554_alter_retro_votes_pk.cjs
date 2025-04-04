/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('retro_card_votes', (table) => {
    // Drop the old primary key constraint (using card_id, user_id)
    // Knex doesn't have a simple dropConstraintIfExists, we might need raw SQL or ignore errors if it doesn't exist
    // Or assume it exists based on the previous migration. Let's try dropping directly.
    // If the table was just created, this PK might have a default name like retro_card_votes_pkey
    // It's safer to drop and recreate if unsure about the exact name from the previous step.
    // Let's drop the primary key constraint first. Knex default name is usually table_pkey
    table.dropPrimary();

    // Drop the user_id column
    table.dropColumn('user_id');

    // Make user_name not nullable
    table.string('user_name').notNullable().alter();

    // Add the new primary key constraint using user_name
    table.primary(['card_id', 'user_name']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Revert the changes in reverse order
  await knex.schema.alterTable('retro_card_votes', (table) => {
    // Drop the new primary key constraint
    table.dropPrimary();

    // Make user_name nullable again (assuming it was nullable before)
    table.string('user_name').nullable().alter();

    // Add the user_id column back
    table.string('user_id').references('id').inTable('users');

    // Add the old primary key constraint back (card_id, user_id)
    // This might fail if duplicates exist.
    table.primary(['card_id', 'user_id']);
  });
};

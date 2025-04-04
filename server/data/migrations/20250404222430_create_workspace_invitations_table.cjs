/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTableIfNotExists('workspace_invitations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()')); // Use knex.raw for uuid generation
    table.string('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
    table.text('token').notNullable().unique();
    table.string('role_to_assign').notNullable().defaultTo('member');
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.string('created_by').notNullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('used_at', { useTz: true }).nullable();
    table.string('used_by').references('id').inTable('users').onDelete('SET NULL').nullable();

    // Indexes (Knex creates indexes for foreign keys automatically, but we can add explicit ones)
    table.index('token');
    table.index('workspace_id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('workspace_invitations');
};

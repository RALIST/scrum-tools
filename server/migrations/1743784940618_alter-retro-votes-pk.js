/* eslint-disable camelcase */

// Using ES module syntax based on project type
export const shorthands = undefined;

export const up = (pgm) => {
  // Drop the existing primary key constraint (assuming default naming convention)
  // If this fails, find the actual constraint name using SQL query mentioned before.
  pgm.dropConstraint('retro_card_votes', 'retro_card_votes_pkey', { ifExists: true });

  // Drop the user_id column as it's no longer part of the identifying key for a vote
  pgm.dropColumns('retro_card_votes', ['user_id'], { ifExists: true });
  
  // Ensure user_name is not null if it wasn't already (important for PK)
  pgm.alterColumn('retro_card_votes', 'user_name', { notNull: true });

  // Add the new primary key constraint using user_name
  pgm.addConstraint('retro_card_votes', 'retro_card_votes_pkey', {
    primaryKey: ['card_id', 'user_name']
  });
};

export const down = (pgm) => {
  // Drop the new primary key constraint
  pgm.dropConstraint('retro_card_votes', 'retro_card_votes_pkey', { ifExists: true });
  
  // Allow nulls in user_name again if needed (depends on original state)
  // pgm.alterColumn('retro_card_votes', 'user_name', { notNull: false });

  // Add the user_id column back (assuming it was VARCHAR referencing users.id)
  // Data is lost here.
  pgm.addColumns('retro_card_votes', {
    user_id: { type: 'varchar(255)', references: 'users' } // Simplified reference
  });

  // Add the old primary key constraint back.
  // This might fail if duplicates were created while user_id was dropped.
  // A real rollback might need more complex data handling.
   pgm.addConstraint('retro_card_votes', 'retro_card_votes_pkey_old', { 
     primaryKey: ['card_id', 'user_id'] 
   });
   // Consider renaming back if needed: pgm.renameConstraint('retro_card_votes', 'retro_card_votes_pkey_old', 'retro_card_votes_pkey');
};

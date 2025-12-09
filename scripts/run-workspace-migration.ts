import { sql } from 'drizzle-orm';
import { db } from '../db/index';
import * as dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  console.log('🔄 Running workspace sessions migration...');

  try {
    // Drop existing user_id column if it has wrong type
    console.log('  Checking existing user_id column...');
    await db.execute(sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'code_generation_sessions'
          AND column_name = 'user_id'
          AND data_type != 'text'
        ) THEN
          ALTER TABLE code_generation_sessions DROP COLUMN user_id;
        END IF;
      END $$;
    `);

    // Add user_id column
    console.log('  Adding user_id column...');
    await db.execute(sql`
      ALTER TABLE code_generation_sessions
      ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE
    `);

    // Set metadata default
    console.log('  Setting metadata default...');
    await db.execute(sql`
      ALTER TABLE code_generation_sessions
      ALTER COLUMN metadata SET DEFAULT '{}'::jsonb
    `);

    // Create index for user_id
    console.log('  Creating user_id index...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_user_id
      ON code_generation_sessions(user_id)
    `);

    // Create index for updated_at
    console.log('  Creating updated_at index...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_updated_at
      ON code_generation_sessions(updated_at DESC)
    `);

    // Backfill user_id from workspaces
    console.log('  Backfilling user_id from workspaces...');
    await db.execute(sql`
      UPDATE code_generation_sessions cgs
      SET user_id = w.owner_id
      FROM workspaces w
      WHERE cgs.workspace_id = w.id AND cgs.user_id IS NULL
    `);

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Restart your dev server');
    console.log('  2. Workspace sessions will now persist across page navigation');
    console.log('  3. Chat history and generated files are automatically saved');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

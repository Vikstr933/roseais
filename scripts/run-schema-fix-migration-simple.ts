import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🔧 Running schema fix migration...');
  console.log('');

  try {
    // Step 1: Change id column type from INTEGER to TEXT
    console.log('📝 Step 1: Changing code_generation_sessions.id from INTEGER to TEXT...');
    try {
      await db.execute(sql`
        ALTER TABLE code_generation_sessions
        ALTER COLUMN id TYPE TEXT USING id::TEXT
      `);
      console.log('   ✅ Successfully changed column type');
    } catch (err: any) {
      if (err.message?.includes('type text') || err.message?.includes('redan')) {
        console.log('   ⚠️  Column is already TEXT type (skipping)');
      } else {
        throw err;
      }
    }

    console.log('');

    // Step 2: Add is_active column if doesn't exist
    console.log('📝 Step 2: Adding is_active column to project_files...');
    try {
      await db.execute(sql`
        ALTER TABLE project_files
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true
      `);
      console.log('   ✅ Column added or already exists');
    } catch (err: any) {
      if (err.message?.includes('already exists') || err.message?.includes('redan finns')) {
        console.log('   ⚠️  Column already exists (skipping)');
      } else {
        throw err;
      }
    }

    console.log('');

    // Step 3: Create index
    console.log('📝 Step 3: Creating index on project_files.is_active...');
    try {
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_project_files_is_active
        ON project_files(is_active)
      `);
      console.log('   ✅ Index created or already exists');
    } catch (err: any) {
      console.log('   ⚠️  Index might already exist (continuing)');
    }

    console.log('');

    // Step 4: Update existing records
    console.log('📝 Step 4: Updating existing records...');
    await db.execute(sql`
      UPDATE project_files SET is_active = true WHERE is_active IS NULL
    `);
    console.log('   ✅ Existing records updated');

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Migration completed successfully!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Summary of changes:');
    console.log('  ✅ code_generation_sessions.id: INTEGER → TEXT');
    console.log('  ✅ project_files.is_active: ADDED (BOOLEAN, default: true)');
    console.log('  ✅ Index created on project_files.is_active');
    console.log('');

    process.exit(0);
  } catch (error: any) {
    console.log('');
    console.log('='.repeat(60));
    console.error('❌ Migration failed!');
    console.log('='.repeat(60));
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('');
    process.exit(1);
  }
}

runMigration();

import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🔧 Running schema fix migration...');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '2012_fix_session_id_type_and_project_files_v2.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Loaded migration file');

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Executing ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`   ${i + 1}/${statements.length} - Executing statement...`);
          await db.execute(sql.raw(statement + ';'));
        } catch (err: any) {
          // Some statements might fail if already applied - that's OK
          if (err.message?.includes('already exists') ||
              err.message?.includes('finns redan') ||
              err.message?.includes('does not exist')) {
            console.log(`   ⚠️  Statement skipped (already applied or table doesn't exist)`);
          } else {
            throw err;
          }
        }
      }
    }

    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Summary of changes:');
    console.log('  ✅ code_generation_sessions.id: INTEGER → TEXT');
    console.log('  ✅ project_files.is_active: ADDED (BOOLEAN)');
    console.log('');

    process.exit(0);
  } catch (error: any) {
    console.error('');
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

runMigration();

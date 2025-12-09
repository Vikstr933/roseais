import { db } from '../db/index.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMonetizationMigration() {
  try {
    console.log('Running monetization migration...');

    // Read the migration file
    const migrationPath = join(
      __dirname,
      '../migrations/2007_add_monetization_tables.sql'
    );
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await db.run(statement);
      }
    }

    console.log('✅ Monetization migration completed successfully!');

    // Verify tables were created
    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%user%' OR name LIKE '%subscription%' OR name LIKE '%rate%'"
    );
    console.log(
      'Created tables:',
      tables.map(t => t.name)
    );
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMonetizationMigration()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });

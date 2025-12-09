import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the database
const dbPath = path.join(__dirname, '..', 'db', 'db.sqlite');
const migrationPath = path.join(
  __dirname,
  '..',
  'migrations',
  '2002_add_user_authentication.sql'
);

console.log('Running user authentication migration...');
console.log('Database path:', dbPath);
console.log('Migration path:', migrationPath);

try {
  // Check if database exists
  if (!fs.existsSync(dbPath)) {
    console.error('Database file does not exist at:', dbPath);
    process.exit(1);
  }

  // Check if migration file exists
  if (!fs.existsSync(migrationPath)) {
    console.error('Migration file does not exist at:', migrationPath);
    process.exit(1);
  }

  // Read migration SQL
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  // Connect to database
  const db = new Database(dbPath);

  // Run migration
  console.log('Executing migration...');
  db.exec(migrationSQL);

  // Verify tables were created
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'user%'"
    )
    .all();
  console.log(
    'Created tables:',
    tables.map(t => t.name)
  );

  // Close database connection
  db.close();

  console.log('✅ User authentication migration completed successfully!');
  console.log('Created tables:');
  console.log('  - users');
  console.log('  - user_sessions');
  console.log('  - user_api_keys');
  console.log('  - user_workspaces');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'db', 'db.sqlite');
const db = new Database(dbPath);

try {
  console.log('Creating api_keys table...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      key_name TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      key_type TEXT NOT NULL,
      description TEXT,
      website TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_used TEXT,
      usage_count INTEGER DEFAULT 0,
      UNIQUE(user_id, service_name, key_name)
    )
  `);

  console.log('✅ api_keys table created successfully');

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_service ON api_keys(service_name);
    CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
  `);

  console.log('✅ Indexes created successfully');
} catch (error) {
  console.error('❌ Error creating api_keys table:', error);
} finally {
  db.close();
  console.log('Database connection closed');
}

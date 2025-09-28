import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createTables() {
  try {
    const dbPath = path.join(process.cwd(), 'db', 'db.sqlite');
    const db = new Database(dbPath);

    console.log('Creating database tables...');

    // Create agents table
    db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        role TEXT NOT NULL,
        model TEXT NOT NULL,
        system_prompt TEXT NOT NULL,
        temperature TEXT NOT NULL,
        custom_instructions TEXT,
        capabilities TEXT NOT NULL,
        expertise TEXT NOT NULL,
        frameworks TEXT NOT NULL,
        libraries TEXT NOT NULL,
        best_practices TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1
      )
    `);

    // Create agent_scripts table
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_scripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        language TEXT NOT NULL,
        version TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        script_template TEXT NOT NULL,
        config_schema TEXT NOT NULL,
        requirements TEXT NOT NULL,
        category TEXT NOT NULL,
        tags TEXT NOT NULL
      )
    `);

    console.log('✅ Database tables created successfully');

    // Check if tables exist
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables in database:', tables.map(t => t.name));

    db.close();
    console.log('🎉 Database setup completed!');

  } catch (error) {
    console.error('❌ Error setting up database:', error);
  }
}

createTables();

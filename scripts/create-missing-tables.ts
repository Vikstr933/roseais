import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

async function createTables() {
  console.log('🔧 Creating missing database tables...');
  console.log('');

  try {
    // Step 1: Create code_generation_sessions table
    console.log('📝 Step 1: Creating code_generation_sessions table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS code_generation_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        input_prompt TEXT,
        generated_code TEXT,
        agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL,
        status TEXT DEFAULT 'completed',
        metadata JSONB DEFAULT '{}'::jsonb
      )
    `);
    console.log('   ✅ Table created successfully');

    // Step 2: Create indexes
    console.log('');
    console.log('📝 Step 2: Creating indexes...');

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_user_id ON code_generation_sessions(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_updated_at ON code_generation_sessions(updated_at DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_workspace_id ON code_generation_sessions(workspace_id)`);

    console.log('   ✅ Indexes created');

    // Step 3: Fix project_files
    console.log('');
    console.log('📝 Step 3: Adding is_active to project_files...');
    await db.execute(sql`ALTER TABLE project_files ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_project_files_is_active ON project_files(is_active)`);
    console.log('   ✅ Column added');

    console.log('');
    console.log('✅ SUCCESS! All tables created.');
    console.log('');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
}

createTables();

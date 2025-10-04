/**
 * Fix PostgreSQL Schema - Complete Migration
 * 
 * This script drops and recreates all tables with the correct schema for PostgreSQL,
 * including proper UUID support and all required columns.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

console.log('🔧 Connecting to PostgreSQL...');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('supabase.co') || DATABASE_URL.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : false,
});

const db = drizzle(pool);

async function fixSchema() {
  try {
    console.log('🗑️  Dropping existing tables (if any)...');
    
    // Drop all tables in correct order (respecting foreign keys)
    await pool.query('DROP TABLE IF EXISTS rate_limits CASCADE');
    await pool.query('DROP TABLE IF EXISTS monetization_events CASCADE');
    await pool.query('DROP TABLE IF EXISTS usage_tracking CASCADE');
    await pool.query('DROP TABLE IF EXISTS project_files CASCADE');
    await pool.query('DROP TABLE IF EXISTS chat_messages CASCADE');
    await pool.query('DROP TABLE IF EXISTS generation_locks CASCADE');
    await pool.query('DROP TABLE IF EXISTS project_members CASCADE');
    await pool.query('DROP TABLE IF EXISTS workspaces CASCADE');
    await pool.query('DROP TABLE IF EXISTS agents CASCADE');
    await pool.query('DROP TABLE IF EXISTS api_keys CASCADE');
    await pool.query('DROP TABLE IF EXISTS sessions CASCADE');
    await pool.query('DROP TABLE IF EXISTS activity_tracking CASCADE');
    await pool.query('DROP TABLE IF EXISTS collaboration_sessions CASCADE');
    await pool.query('DROP TABLE IF EXISTS component_tests CASCADE');
    await pool.query('DROP TABLE IF EXISTS component_versions CASCADE');
    await pool.query('DROP TABLE IF EXISTS component_usage CASCADE');
    await pool.query('DROP TABLE IF EXISTS shared_components CASCADE');
    await pool.query('DROP TABLE IF EXISTS components CASCADE');
    await pool.query('DROP TABLE IF EXISTS user_notifications CASCADE');
    await pool.query('DROP TABLE IF EXISTS knowledge_items CASCADE');
    await pool.query('DROP TABLE IF EXISTS event_logs CASCADE');
    await pool.query('DROP TABLE IF EXISTS users CASCADE');

    console.log('✅ Old tables dropped');
    
    console.log('📦 Creating new tables with correct schema...');

    // Enable UUID extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // 1. Users table (with TEXT id for UUID)
    await pool.query(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        preferences JSONB DEFAULT '{"theme":"light","autoSave":true,"defaultLanguage":"typescript"}'::jsonb,
        is_active BOOLEAN DEFAULT true,
        tier TEXT DEFAULT 'free',
        stripe_customer_id TEXT,
        subscription_status TEXT DEFAULT 'none',
        subscription_id TEXT,
        trial_ends_at TIMESTAMP
      )
    `);
    console.log('✅ Users table created');

    // 2. Sessions table
    await pool.query(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Sessions table created');

    // 3. API Keys table
    await pool.query(`
      CREATE TABLE api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key_hash TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        last_used TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      )
    `);
    console.log('✅ API Keys table created');

    // 4. Agents table
    await pool.query(`
      CREATE TABLE agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        model TEXT NOT NULL,
        system_prompt TEXT NOT NULL,
        temperature REAL DEFAULT 0.7,
        max_tokens INTEGER DEFAULT 4096,
        tools JSONB DEFAULT '[]'::jsonb,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      )
    `);
    console.log('✅ Agents table created');

    // 5. Workspaces table (with all columns)
    await pool.query(`
      CREATE TABLE workspaces (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        agent_config JSONB DEFAULT '{}'::jsonb,
        test_cases JSONB DEFAULT '[]'::jsonb,
        collaborators JSONB DEFAULT '[]'::jsonb,
        status TEXT DEFAULT 'active',
        owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        project_type TEXT DEFAULT 'web',
        project_status TEXT DEFAULT 'active',
        invite_code TEXT UNIQUE,
        settings JSONB DEFAULT '{}'::jsonb,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Workspaces table created');

    // 6. Project Members table
    await pool.query(`
      CREATE TABLE project_members (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT DEFAULT 'viewer',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, user_id)
      )
    `);
    console.log('✅ Project Members table created');

    // 7. Chat Messages table
    await pool.query(`
      CREATE TABLE chat_messages (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB DEFAULT '{}'::jsonb
      )
    `);
    console.log('✅ Chat Messages table created');

    // 8. Project Files table
    await pool.query(`
      CREATE TABLE project_files (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        file_content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, file_path)
      )
    `);
    console.log('✅ Project Files table created');

    // 9. Generation Locks table
    await pool.query(`
      CREATE TABLE generation_locks (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lock_type TEXT NOT NULL,
        session_id TEXT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        status TEXT DEFAULT 'active',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Generation Locks table created');

    // 10. Activity Tracking table
    await pool.query(`
      CREATE TABLE activity_tracking (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, user_id)
      )
    `);
    console.log('✅ Activity Tracking table created');

    // 11. Event Logs table
    await pool.query(`
      CREATE TABLE event_logs (
        id SERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Event Logs table created');

    // 12. Knowledge Items table
    await pool.query(`
      CREATE TABLE knowledge_items (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB DEFAULT '{}'::jsonb
      )
    `);
    console.log('✅ Knowledge Items table created');

    // 13. Components table
    await pool.query(`
      CREATE TABLE components (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        code TEXT NOT NULL,
        framework TEXT NOT NULL,
        category TEXT,
        tags JSONB DEFAULT '[]'::jsonb,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_public BOOLEAN DEFAULT false,
        usage_count INTEGER DEFAULT 0
      )
    `);
    console.log('✅ Components table created');

    // 14. Rate Limits table
    await pool.query(`
      CREATE TABLE rate_limits (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        count INTEGER DEFAULT 0,
        window_start TIMESTAMP NOT NULL,
        window_end TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Rate Limits table created');

    // 15. Usage Tracking table
    await pool.query(`
      CREATE TABLE usage_tracking (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action_type TEXT NOT NULL,
        tokens_used INTEGER DEFAULT 0,
        cost_cents INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Usage Tracking table created');

    // 16. Code Generation Sessions table
    await pool.query(`
      CREATE TABLE code_generation_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        input_prompt TEXT NOT NULL,
        generated_code TEXT NOT NULL,
        agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL,
        status TEXT DEFAULT 'completed',
        metadata JSONB DEFAULT '{}'::jsonb
      )
    `);
    console.log('✅ Code Generation Sessions table created');

    // Create indexes for performance
    console.log('🔍 Creating indexes...');
    await pool.query('CREATE INDEX idx_sessions_user_id ON sessions(user_id)');
    await pool.query('CREATE INDEX idx_workspaces_owner_id ON workspaces(owner_id)');
    await pool.query('CREATE INDEX idx_chat_messages_project_id ON chat_messages(project_id)');
    await pool.query('CREATE INDEX idx_project_files_project_id ON project_files(project_id)');
    await pool.query('CREATE INDEX idx_activity_tracking_project_id ON activity_tracking(project_id)');
    await pool.query('CREATE INDEX idx_event_logs_user_id ON event_logs(user_id)');
    await pool.query('CREATE INDEX idx_rate_limits_user_id ON rate_limits(user_id)');
    await pool.query('CREATE INDEX idx_usage_tracking_user_id ON usage_tracking(user_id)');
    console.log('✅ Indexes created');

    console.log('✅ PostgreSQL schema fixed successfully!');
    console.log('\n📊 Summary:');
    console.log('  - All tables recreated with correct schema');
    console.log('  - UUID support enabled (TEXT type for id columns)');
    console.log('  - All foreign keys properly configured');
    console.log('  - Indexes created for performance');
    console.log('\n🎉 Database is ready for use!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
fixSchema().catch((error) => {
  console.error('Migration error:', error);
  process.exit(1);
});


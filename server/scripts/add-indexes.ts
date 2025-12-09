import { db } from '../../db';
import { sql } from 'drizzle-orm';

/**
 * Add Database Indexes for Performance Optimization
 * 
 * This script adds critical indexes to improve query performance
 * Run with: tsx server/scripts/add-indexes.ts
 */

async function addIndexes() {
  console.log('🚀 Adding database indexes for performance optimization...\n');

  try {
    // ========================================================================
    // User-related indexes
    // ========================================================================
    
    console.log('Creating indexes for users table...');
    
    // Index for user lookups by email (login)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_users_email 
      ON users(email);
    `);
    
    // Index for user lookups by username
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_users_username 
      ON users(username);
    `);
    
    // Index for user tier (for billing/feature access)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_users_tier 
      ON users(tier);
    `);
    
    // Composite index for active users by tier
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_users_active_tier 
      ON users(is_active, tier);
    `);

    // ========================================================================
    // Session-related indexes
    // ========================================================================
    
    console.log('Creating indexes for user_sessions table...');
    
    // Index for session token lookup (authentication)
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token 
      ON user_sessions(session_token);
    `);
    
    // Index for finding user sessions
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id 
      ON user_sessions(user_id);
    `);
    
    // Index for session expiry cleanup
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires 
      ON user_sessions(expires_at)
      WHERE is_active = 1;
    `);

    // ========================================================================
    // Code generation session indexes
    // ========================================================================
    
    console.log('Creating indexes for code_generation_sessions table...');
    
    // Index for user's sessions
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_code_sessions_user_id 
      ON code_generation_sessions(user_id);
    `);
    
    // Index for workspace sessions
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_code_sessions_workspace_id 
      ON code_generation_sessions(workspace_id);
    `);
    
    // Composite index for user's recent sessions
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_code_sessions_user_created 
      ON code_generation_sessions(user_id, created_at DESC);
    `);
    
    // Index for session status
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_code_sessions_status 
      ON code_generation_sessions(status);
    `);

    // ========================================================================
    // Workspace indexes
    // ========================================================================
    
    console.log('Creating indexes for workspaces table...');
    
    // Index for owner's workspaces
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_workspaces_owner 
      ON workspaces(owner_id);
    `);
    
    // Index for active workspaces
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_workspaces_status 
      ON workspaces(project_status);
    `);
    
    // Index for invite codes
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_invite 
      ON workspaces(invite_code) 
      WHERE invite_code IS NOT NULL;
    `);
    
    // Composite index for user's active workspaces
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_workspaces_owner_status 
      ON workspaces(owner_id, project_status);
    `);

    // ========================================================================
    // Project collaboration indexes
    // ========================================================================
    
    console.log('Creating indexes for project_members table...');
    
    // Index for project members
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_project_members_project 
      ON project_members(project_id);
    `);
    
    // Index for user's projects
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_project_members_user 
      ON project_members(user_id);
    `);
    
    // Composite index for active members
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_project_members_active 
      ON project_members(project_id, user_id) 
      WHERE is_active = 1;
    `);

    // ========================================================================
    // Project files indexes
    // ========================================================================
    
    console.log('Creating indexes for project_files table...');
    
    // Index for project files
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_project_files_project 
      ON project_files(project_id);
    `);
    
    // Composite index for project file paths
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_project_files_path 
      ON project_files(project_id, file_path);
    `);
    
    // Index for recently modified files
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_project_files_updated 
      ON project_files(updated_at DESC) 
      WHERE is_active = 1;
    `);

    // ========================================================================
    // Project activities indexes
    // ========================================================================
    
    console.log('Creating indexes for project_activities table...');
    
    // Index for project activities
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_activities_project 
      ON project_activities(project_id);
    `);
    
    // Index for user activities
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_activities_user 
      ON project_activities(user_id);
    `);
    
    // Composite index for recent project activities
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_activities_project_created 
      ON project_activities(project_id, created_at DESC);
    `);

    // ========================================================================
    // Chat messages indexes
    // ========================================================================
    
    console.log('Creating indexes for project_chat_messages table...');
    
    // Index for project messages
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_chat_project 
      ON project_chat_messages(project_id);
    `);
    
    // Composite index for recent messages
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_chat_project_created 
      ON project_chat_messages(project_id, created_at DESC);
    `);

    // ========================================================================
    // Usage tracking indexes
    // ========================================================================
    
    console.log('Creating indexes for user_usage table...');
    
    // Index for user usage tracking
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_usage_user 
      ON user_usage(user_id);
    `);
    
    // Index for service usage
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_usage_service 
      ON user_usage(service_name);
    `);
    
    // Composite index for user's daily usage
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_usage_user_created 
      ON user_usage(user_id, created_at DESC);
    `);
    
    // Index for cost analysis
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_usage_cost 
      ON user_usage(cost DESC);
    `);

    // ========================================================================
    // Rate limiting indexes
    // ========================================================================
    
    console.log('Creating indexes for rate_limit_buckets table...');
    
    // Composite index for rate limit lookups
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_rate_limit_user_bucket 
      ON rate_limit_buckets(user_id, bucket_type);
    `);
    
    // Index for window expiry
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_rate_limit_window 
      ON rate_limit_buckets(window_end);
    `);

    // ========================================================================
    // Generation locks indexes
    // ========================================================================
    
    console.log('Creating indexes for generation_locks table...');
    
    // Index for active locks
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_locks_project_status 
      ON generation_locks(project_id, status) 
      WHERE status = 'active';
    `);
    
    // Index for lock expiry
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_locks_expires 
      ON generation_locks(expires_at) 
      WHERE status = 'active';
    `);

    // ========================================================================
    // API keys indexes
    // ========================================================================
    
    console.log('Creating indexes for user_api_keys table...');
    
    // Index for user's API keys
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_api_keys_user 
      ON user_api_keys(user_id);
    `);
    
    // Index for active API keys
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_api_keys_active 
      ON user_api_keys(user_id, service_name) 
      WHERE is_active = 1;
    `);

    // ========================================================================
    // Agent and prompt indexes
    // ========================================================================
    
    console.log('Creating indexes for agents table...');
    
    // Index for active agents
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_agents_active 
      ON agents(is_active);
    `);
    
    // Index for agent role
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_agents_role 
      ON agents(role);
    `);

    console.log('Creating indexes for prompt_chains table...');
    
    // Index for active prompt chains
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_prompt_chains_active 
      ON prompt_chains(is_active);
    `);

    // ========================================================================
    // Full-text search indexes (if using PostgreSQL)
    // ========================================================================
    
    // Note: These are PostgreSQL-specific and won't work with SQLite
    if (process.env.DATABASE_URL?.includes('postgresql')) {
      console.log('\nCreating full-text search indexes (PostgreSQL only)...');
      
      // Full-text search on code generation sessions
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_code_sessions_search 
        ON code_generation_sessions 
        USING gin(to_tsvector('english', input_prompt || ' ' || COALESCE(title, '')));
      `);
      
      // Full-text search on project files
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_project_files_search 
        ON project_files 
        USING gin(to_tsvector('english', file_content)) 
        WHERE file_type IN ('component', 'style');
      `);
    }

    console.log('\n✅ All indexes created successfully!');
    
    // Analyze tables to update statistics
    console.log('\n📊 Analyzing tables to update statistics...');
    await db.execute(sql`ANALYZE;`);
    
    console.log('\n🎉 Database optimization complete!');

  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  }
}

// Run the script
addIndexes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

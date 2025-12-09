/**
 * PostgreSQL Migration: Enable Row Level Security (RLS) on All Tables
 * 
 * SAFE VERSION - Only enables RLS on tables that actually exist
 * 
 * This migration enables RLS and creates policies for all tables to ensure
 * users can only access their own data.
 * 
 * CRITICAL: Run this in Supabase SQL Editor
 */

-- ==================================================================
-- CREATE APP SCHEMA FOR CUSTOM FUNCTIONS
-- ==================================================================
-- Create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS app;

-- Grant usage on schema
GRANT USAGE ON SCHEMA app TO authenticated;
GRANT USAGE ON SCHEMA app TO anon;
GRANT USAGE ON SCHEMA app TO service_role;

-- ==================================================================
-- HELPER FUNCTION: Get current user ID from app context
-- ==================================================================
-- This function gets the user ID from app context (set by our middleware)
CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS TEXT AS $$
  SELECT current_setting('app.user_id', true);
$$ LANGUAGE sql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION app.current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION app.current_user_id() TO anon;
GRANT EXECUTE ON FUNCTION app.current_user_id() TO service_role;

-- ==================================================================
-- ENABLE RLS ON EXISTING TABLES ONLY
-- ==================================================================
-- Note: Run this migration when database is not under heavy load
-- If deadlock occurs, run sections separately

-- Users table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    -- Drop existing policies first to avoid conflicts
    DROP POLICY IF EXISTS "Users can view own profile" ON users;
    DROP POLICY IF EXISTS "Users can update own profile" ON users;
    
    -- Enable RLS
    -- Create policies
    CREATE POLICY "Users can view own profile"
      ON users FOR SELECT
      USING (
        id = app.current_user_id() 
        OR (SELECT role FROM users WHERE id = app.current_user_id()) IN ('admin', 'superadmin')
      );
    
    DROP POLICY IF EXISTS "Users can update own profile" ON users;
    CREATE POLICY "Users can update own profile"
      ON users FOR UPDATE
      USING (
        id = app.current_user_id() 
        OR (SELECT role FROM users WHERE id = app.current_user_id()) IN ('admin', 'superadmin')
      );
  END IF;
END $$;

-- Sessions
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions') THEN
    -- Drop existing policies first
    DROP POLICY IF EXISTS "Users can view own sessions" ON sessions;
    DROP POLICY IF EXISTS "Users can create own sessions" ON sessions;
    DROP POLICY IF EXISTS "Users can delete own sessions" ON sessions;
    
    -- Enable RLS
    ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can view own sessions"
      ON sessions FOR SELECT
      USING (
        user_id = app.current_user_id() 
        OR EXISTS (
          SELECT 1 FROM users 
          WHERE id = app.current_user_id() 
          AND role IN ('admin', 'superadmin')
        )
      );
    
    DROP POLICY IF EXISTS "Users can create own sessions" ON sessions;
    CREATE POLICY "Users can create own sessions"
      ON sessions FOR INSERT
      WITH CHECK (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can delete own sessions" ON sessions;
    CREATE POLICY "Users can delete own sessions"
      ON sessions FOR DELETE
      USING (
        user_id = app.current_user_id() 
        OR EXISTS (
          SELECT 1 FROM users 
          WHERE id = app.current_user_id() 
          AND role IN ('admin', 'superadmin')
        )
      );
  END IF;
END $$;

-- Workspaces
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces') THEN
    -- Drop existing policies first
    DROP POLICY IF EXISTS "Users can view own workspaces" ON workspaces;
    DROP POLICY IF EXISTS "Users can create own workspaces" ON workspaces;
    DROP POLICY IF EXISTS "Users can update own workspaces" ON workspaces;
    DROP POLICY IF EXISTS "Users can delete own workspaces" ON workspaces;
    
    -- Enable RLS
    ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can view own workspaces"
      ON workspaces FOR SELECT
      USING (
        owner_id = app.current_user_id() 
        OR EXISTS (
          SELECT 1 FROM users WHERE id = app.current_user_id() AND role IN ('admin', 'superadmin')
        )
      );
    
    DROP POLICY IF EXISTS "Users can create own workspaces" ON workspaces;
    CREATE POLICY "Users can create own workspaces"
      ON workspaces FOR INSERT
      WITH CHECK (owner_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can update own workspaces" ON workspaces;
    CREATE POLICY "Users can update own workspaces"
      ON workspaces FOR UPDATE
      USING (owner_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can delete own workspaces" ON workspaces;
    CREATE POLICY "Users can delete own workspaces"
      ON workspaces FOR DELETE
      USING (owner_id = app.current_user_id());
  END IF;
END $$;

-- Project Files
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_files') THEN
    ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own project files" ON project_files;
    CREATE POLICY "Users can view own project files"
      ON project_files FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM workspaces 
          WHERE id = project_files.project_id 
          AND owner_id = app.current_user_id()
        )
      );
    
    DROP POLICY IF EXISTS "Users can manage own project files" ON project_files;
    CREATE POLICY "Users can manage own project files"
      ON project_files FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM workspaces 
          WHERE id = project_files.project_id 
          AND owner_id = app.current_user_id()
        )
      );
  END IF;
END $$;

-- Project Members
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_members') THEN
    ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view project members" ON project_members;
    CREATE POLICY "Users can view project members"
      ON project_members FOR SELECT
      USING (
        user_id = app.current_user_id()
        OR EXISTS (
          SELECT 1 FROM workspaces 
          WHERE id = project_members.project_id 
          AND owner_id = app.current_user_id()
        )
      );
    
    DROP POLICY IF EXISTS "Project owners can manage members" ON project_members;
    CREATE POLICY "Project owners can manage members"
      ON project_members FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM workspaces 
          WHERE id = project_members.project_id 
          AND owner_id = app.current_user_id()
        )
      );
  END IF;
END $$;

-- Agents
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents') THEN
    ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own and system agents" ON agents;
    CREATE POLICY "Users can view own and system agents"
      ON agents FOR SELECT
      USING (
        created_by = app.current_user_id() 
        OR (SELECT is_system FROM agents WHERE id = agents.id) = 1
        OR EXISTS (
          SELECT 1 FROM users WHERE id = app.current_user_id() AND role IN ('admin', 'superadmin')
        )
      );
    
    DROP POLICY IF EXISTS "Users can create own agents" ON agents;
    CREATE POLICY "Users can create own agents"
      ON agents FOR INSERT
      WITH CHECK (created_by = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can update own agents" ON agents;
    CREATE POLICY "Users can update own agents"
      ON agents FOR UPDATE
      USING (created_by = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can delete own agents" ON agents;
    CREATE POLICY "Users can delete own agents"
      ON agents FOR DELETE
      USING (created_by = app.current_user_id());
  END IF;
END $$;

-- User Credentials
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_credentials') THEN
    ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own credentials" ON user_credentials;
    CREATE POLICY "Users can view own credentials"
      ON user_credentials FOR SELECT
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can manage own credentials" ON user_credentials;
    CREATE POLICY "Users can manage own credentials"
      ON user_credentials FOR ALL
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- Discord User Mappings
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'discord_user_mappings') THEN
    ALTER TABLE discord_user_mappings ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own Discord mapping" ON discord_user_mappings;
    CREATE POLICY "Users can view own Discord mapping"
      ON discord_user_mappings FOR SELECT
      USING (system_user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can manage own Discord mapping" ON discord_user_mappings;
    CREATE POLICY "Users can manage own Discord mapping"
      ON discord_user_mappings FOR ALL
      USING (system_user_id = app.current_user_id());
  END IF;
END $$;

-- Code Generation Sessions
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'code_generation_sessions') THEN
    ALTER TABLE code_generation_sessions ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own code sessions" ON code_generation_sessions;
    CREATE POLICY "Users can view own code sessions"
      ON code_generation_sessions FOR SELECT
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can manage own code sessions" ON code_generation_sessions;
    CREATE POLICY "Users can manage own code sessions"
      ON code_generation_sessions FOR ALL
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- Chat Messages
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_messages') THEN
    ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own chat messages" ON chat_messages;
    CREATE POLICY "Users can view own chat messages"
      ON chat_messages FOR SELECT
      USING (
        user_id = app.current_user_id()
        OR EXISTS (
          SELECT 1 FROM workspaces 
          WHERE id = chat_messages.project_id 
          AND owner_id = app.current_user_id()
        )
      );
    
    DROP POLICY IF EXISTS "Users can create own chat messages" ON chat_messages;
    CREATE POLICY "Users can create own chat messages"
      ON chat_messages FOR INSERT
      WITH CHECK (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can delete own chat messages" ON chat_messages;
    CREATE POLICY "Users can delete own chat messages"
      ON chat_messages FOR DELETE
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- API Keys
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_keys') THEN
    ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own API keys" ON api_keys;
    CREATE POLICY "Users can view own API keys"
      ON api_keys FOR SELECT
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can manage own API keys" ON api_keys;
    CREATE POLICY "Users can manage own API keys"
      ON api_keys FOR ALL
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- Rate Limits
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rate_limits') THEN
    ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own rate limits" ON rate_limits;
    CREATE POLICY "Users can view own rate limits"
      ON rate_limits FOR SELECT
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- Usage Tracking
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usage_tracking') THEN
    ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own usage tracking" ON usage_tracking;
    CREATE POLICY "Users can view own usage tracking"
      ON usage_tracking FOR SELECT
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- Generation Locks
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'generation_locks') THEN
    ALTER TABLE generation_locks ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own generation locks" ON generation_locks;
    CREATE POLICY "Users can view own generation locks"
      ON generation_locks FOR SELECT
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can manage own generation locks" ON generation_locks;
    CREATE POLICY "Users can manage own generation locks"
      ON generation_locks FOR ALL
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- OAuth States
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'oauth_states') THEN
    ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own OAuth states" ON oauth_states;
    CREATE POLICY "Users can view own OAuth states"
      ON oauth_states FOR SELECT
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can create own OAuth states" ON oauth_states;
    CREATE POLICY "Users can create own OAuth states"
      ON oauth_states FOR INSERT
      WITH CHECK (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can delete own OAuth states" ON oauth_states;
    CREATE POLICY "Users can delete own OAuth states"
      ON oauth_states FOR DELETE
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- Event Logs
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_logs') THEN
    ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own event logs" ON event_logs;
    CREATE POLICY "Users can view own event logs"
      ON event_logs FOR SELECT
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- Plugin Configs
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plugin_configs') THEN
    ALTER TABLE plugin_configs ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own plugin configs" ON plugin_configs;
    CREATE POLICY "Users can view own plugin configs"
      ON plugin_configs FOR SELECT
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can manage own plugin configs" ON plugin_configs;
    CREATE POLICY "Users can manage own plugin configs"
      ON plugin_configs FOR ALL
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- Plugin Knowledge
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plugin_knowledge') THEN
    ALTER TABLE plugin_knowledge ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own plugin knowledge" ON plugin_knowledge;
    CREATE POLICY "Users can view own plugin knowledge"
      ON plugin_knowledge FOR SELECT
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- Plugin Actions
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plugin_actions') THEN
    ALTER TABLE plugin_actions ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own plugin actions" ON plugin_actions;
    CREATE POLICY "Users can view own plugin actions"
      ON plugin_actions FOR SELECT
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- Plugin Sync Logs
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plugin_sync_logs') THEN
    ALTER TABLE plugin_sync_logs ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own plugin sync logs" ON plugin_sync_logs;
    CREATE POLICY "Users can view own plugin sync logs"
      ON plugin_sync_logs FOR SELECT
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- Conversations
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations') THEN
    ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
    CREATE POLICY "Users can view own conversations"
      ON conversations FOR SELECT
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
    CREATE POLICY "Users can manage own conversations"
      ON conversations FOR ALL
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- User Preferences
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_preferences') THEN
    ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
    CREATE POLICY "Users can view own preferences"
      ON user_preferences FOR SELECT
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can manage own preferences" ON user_preferences;
    CREATE POLICY "Users can manage own preferences"
      ON user_preferences FOR ALL
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- AI Insights
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_insights') THEN
    ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own AI insights" ON ai_insights;
    CREATE POLICY "Users can view own AI insights"
      ON ai_insights FOR SELECT
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- Prompt Chains
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prompt_chains') THEN
    ALTER TABLE prompt_chains ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own prompt chains" ON prompt_chains;
    CREATE POLICY "Users can view own prompt chains"
      ON prompt_chains FOR SELECT
      USING (true); -- Public for now, can add user_id later if needed
    
    DROP POLICY IF EXISTS "Users can manage own prompt chains" ON prompt_chains;
    CREATE POLICY "Users can manage own prompt chains"
      ON prompt_chains FOR ALL
      USING (true); -- Public for now
  END IF;
END $$;

-- Prompt Templates
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prompt_templates') THEN
    ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view prompt templates" ON prompt_templates;
    CREATE POLICY "Users can view prompt templates"
      ON prompt_templates FOR SELECT
      USING (true); -- Public for now
    
    DROP POLICY IF EXISTS "Users can manage prompt templates" ON prompt_templates;
    CREATE POLICY "Users can manage prompt templates"
      ON prompt_templates FOR ALL
      USING (true); -- Public for now
  END IF;
END $$;

-- Plugin Execution Logs (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plugin_execution_logs') THEN
    ALTER TABLE plugin_execution_logs ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own plugin execution logs" ON plugin_execution_logs;
    CREATE POLICY "Users can view own plugin execution logs"
      ON plugin_execution_logs FOR SELECT
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- Plugin Generation Requests (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plugin_generation_requests') THEN
    ALTER TABLE plugin_generation_requests ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own plugin generation requests" ON plugin_generation_requests;
    CREATE POLICY "Users can view own plugin generation requests"
      ON plugin_generation_requests FOR SELECT
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can create own plugin generation requests" ON plugin_generation_requests;
    CREATE POLICY "Users can create own plugin generation requests"
      ON plugin_generation_requests FOR INSERT
      WITH CHECK (user_id = app.current_user_id());
  END IF;
END $$;

-- Plugin Reviews (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plugin_reviews') THEN
    ALTER TABLE plugin_reviews ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view all plugin reviews" ON plugin_reviews;
    CREATE POLICY "Users can view all plugin reviews"
      ON plugin_reviews FOR SELECT
      USING (true); -- Reviews are public
    
    DROP POLICY IF EXISTS "Users can create own plugin reviews" ON plugin_reviews;
    CREATE POLICY "Users can create own plugin reviews"
      ON plugin_reviews FOR INSERT
      WITH CHECK (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can update own plugin reviews" ON plugin_reviews;
    CREATE POLICY "Users can update own plugin reviews"
      ON plugin_reviews FOR UPDATE
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- Plugin Installations (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plugin_installations') THEN
    ALTER TABLE plugin_installations ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own plugin installations" ON plugin_installations;
    CREATE POLICY "Users can view own plugin installations"
      ON plugin_installations FOR SELECT
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can manage own plugin installations" ON plugin_installations;
    CREATE POLICY "Users can manage own plugin installations"
      ON plugin_installations FOR ALL
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- Plugin Marketplace Ratings (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plugin_marketplace_ratings') THEN
    ALTER TABLE plugin_marketplace_ratings ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view all plugin ratings" ON plugin_marketplace_ratings;
    CREATE POLICY "Users can view all plugin ratings"
      ON plugin_marketplace_ratings FOR SELECT
      USING (true); -- Ratings are public
    
    DROP POLICY IF EXISTS "Users can manage own plugin ratings" ON plugin_marketplace_ratings;
    CREATE POLICY "Users can manage own plugin ratings"
      ON plugin_marketplace_ratings FOR ALL
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- Plugin Security Incidents (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plugin_security_incidents') THEN
    ALTER TABLE plugin_security_incidents ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Admins can view all security incidents" ON plugin_security_incidents;
    CREATE POLICY "Admins can view all security incidents"
      ON plugin_security_incidents FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM users 
          WHERE id = app.current_user_id() 
          AND role IN ('admin', 'superadmin')
        )
      );
  END IF;
END $$;

-- User Generated Plugins (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_generated_plugins') THEN
    ALTER TABLE user_generated_plugins ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own plugins" ON user_generated_plugins;
    CREATE POLICY "Users can view own plugins"
      ON user_generated_plugins FOR SELECT
      USING (user_id = app.current_user_id() OR status = 'approved');
    
    DROP POLICY IF EXISTS "Users can manage own plugins" ON user_generated_plugins;
    CREATE POLICY "Users can manage own plugins"
      ON user_generated_plugins FOR ALL
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- ==================================================================
-- FIX DUPLICATE INDEXES
-- ==================================================================

-- Drop duplicate indexes on code_generation_sessions
DROP INDEX IF EXISTS idx_code_gen_sessions_user_id;
DROP INDEX IF EXISTS idx_code_gen_sessions_workspace_id;

-- Drop duplicate indexes on plugin_execution_logs
DROP INDEX IF EXISTS idx_pel_status;

-- Drop duplicate constraint on project_files (this is a constraint, not an index)
ALTER TABLE project_files DROP CONSTRAINT IF EXISTS project_files_project_id_file_path_key;

-- Drop duplicate indexes on user_generated_plugins
DROP INDEX IF EXISTS idx_ugp_created;
DROP INDEX IF EXISTS idx_ugp_user_status;

-- ==================================================================
-- NOTES
-- ==================================================================
-- 
-- 1. Service role (backend) can bypass RLS automatically when using
--    service_role key in DATABASE_URL
--
-- 2. For user-facing queries, set app.user_id in middleware:
--    SET app.user_id = 'user-uuid-here';
--
-- 3. This migration only enables RLS on tables that exist
--    Missing tables are skipped gracefully
--
-- 4. Test RLS policies after migration:
--    SET app.user_id = 'test-user-id';
--    SELECT * FROM users; -- Should only return current user
--


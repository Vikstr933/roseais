/**
 * PostgreSQL Migration: Enable Row Level Security (RLS) - SIMPLE VERSION
 * 
 * This version checks if RLS is already enabled before trying to enable it.
 * Run each section separately if you encounter deadlock issues.
 * 
 * IMPORTANT: 
 * - Wait for all active queries to finish before running
 * - Run during low-traffic periods
 * - If deadlock occurs, wait 30 seconds and try again
 */

-- ==================================================================
-- STEP 1: CREATE APP SCHEMA AND FUNCTION
-- ==================================================================
CREATE SCHEMA IF NOT EXISTS app;
GRANT USAGE ON SCHEMA app TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS TEXT AS $$
  SELECT current_setting('app.user_id', true);
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION app.current_user_id() TO authenticated, anon, service_role;

-- ==================================================================
-- STEP 2: ENABLE RLS (Only if not already enabled)
-- ==================================================================
-- Run these one at a time, waiting a few seconds between each

-- Users
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'users'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users FOR SELECT
  USING (id = app.current_user_id() OR (SELECT role FROM users WHERE id = app.current_user_id()) IN ('admin', 'superadmin'));

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users FOR UPDATE
  USING (id = app.current_user_id() OR (SELECT role FROM users WHERE id = app.current_user_id()) IN ('admin', 'superadmin'));

-- Sessions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'sessions'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own sessions" ON sessions;
CREATE POLICY "Users can view own sessions" ON sessions FOR SELECT
  USING (user_id = app.current_user_id() OR EXISTS (SELECT 1 FROM users WHERE id = app.current_user_id() AND role IN ('admin', 'superadmin')));

DROP POLICY IF EXISTS "Users can create own sessions" ON sessions;
CREATE POLICY "Users can create own sessions" ON sessions FOR INSERT
  WITH CHECK (user_id = app.current_user_id());

DROP POLICY IF EXISTS "Users can delete own sessions" ON sessions;
CREATE POLICY "Users can delete own sessions" ON sessions FOR DELETE
  USING (user_id = app.current_user_id() OR EXISTS (SELECT 1 FROM users WHERE id = app.current_user_id() AND role IN ('admin', 'superadmin')));

-- Workspaces
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'workspaces'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own workspaces" ON workspaces;
CREATE POLICY "Users can view own workspaces" ON workspaces FOR SELECT
  USING (owner_id = app.current_user_id() OR EXISTS (SELECT 1 FROM users WHERE id = app.current_user_id() AND role IN ('admin', 'superadmin')));

DROP POLICY IF EXISTS "Users can create own workspaces" ON workspaces;
CREATE POLICY "Users can create own workspaces" ON workspaces FOR INSERT
  WITH CHECK (owner_id = app.current_user_id());

DROP POLICY IF EXISTS "Users can update own workspaces" ON workspaces;
CREATE POLICY "Users can update own workspaces" ON workspaces FOR UPDATE
  USING (owner_id = app.current_user_id());

DROP POLICY IF EXISTS "Users can delete own workspaces" ON workspaces;
CREATE POLICY "Users can delete own workspaces" ON workspaces FOR DELETE
  USING (owner_id = app.current_user_id());

-- Project Files
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'project_files'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own project files" ON project_files;
CREATE POLICY "Users can view own project files" ON project_files FOR SELECT
  USING (EXISTS (SELECT 1 FROM workspaces WHERE id = project_files.project_id AND owner_id = app.current_user_id()));

DROP POLICY IF EXISTS "Users can manage own project files" ON project_files;
CREATE POLICY "Users can manage own project files" ON project_files FOR ALL
  USING (EXISTS (SELECT 1 FROM workspaces WHERE id = project_files.project_id AND owner_id = app.current_user_id()));

-- Project Members
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'project_members'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view project members" ON project_members;
CREATE POLICY "Users can view project members" ON project_members FOR SELECT
  USING (user_id = app.current_user_id() OR EXISTS (SELECT 1 FROM workspaces WHERE id = project_members.project_id AND owner_id = app.current_user_id()));

DROP POLICY IF EXISTS "Project owners can manage members" ON project_members;
CREATE POLICY "Project owners can manage members" ON project_members FOR ALL
  USING (EXISTS (SELECT 1 FROM workspaces WHERE id = project_members.project_id AND owner_id = app.current_user_id()));

-- Agents
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'agents'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own and system agents" ON agents;
CREATE POLICY "Users can view own and system agents" ON agents FOR SELECT
  USING (created_by = app.current_user_id() OR (SELECT COALESCE(is_system, 0) FROM agents WHERE id = agents.id) = 1 OR EXISTS (SELECT 1 FROM users WHERE id = app.current_user_id() AND role IN ('admin', 'superadmin')));

DROP POLICY IF EXISTS "Users can create own agents" ON agents;
CREATE POLICY "Users can create own agents" ON agents FOR INSERT
  WITH CHECK (created_by = app.current_user_id());

DROP POLICY IF EXISTS "Users can update own agents" ON agents;
CREATE POLICY "Users can update own agents" ON agents FOR UPDATE
  USING (created_by = app.current_user_id());

DROP POLICY IF EXISTS "Users can delete own agents" ON agents;
CREATE POLICY "Users can delete own agents" ON agents FOR DELETE
  USING (created_by = app.current_user_id());

-- User Credentials
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'user_credentials'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own credentials" ON user_credentials;
CREATE POLICY "Users can view own credentials" ON user_credentials FOR SELECT
  USING (user_id = app.current_user_id());

DROP POLICY IF EXISTS "Users can manage own credentials" ON user_credentials;
CREATE POLICY "Users can manage own credentials" ON user_credentials FOR ALL
  USING (user_id = app.current_user_id());

-- Discord User Mappings
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'discord_user_mappings'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE discord_user_mappings ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own Discord mapping" ON discord_user_mappings;
CREATE POLICY "Users can view own Discord mapping" ON discord_user_mappings FOR SELECT
  USING (system_user_id = app.current_user_id());

DROP POLICY IF EXISTS "Users can manage own Discord mapping" ON discord_user_mappings;
CREATE POLICY "Users can manage own Discord mapping" ON discord_user_mappings FOR ALL
  USING (system_user_id = app.current_user_id());

-- Code Generation Sessions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'code_generation_sessions'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE code_generation_sessions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own code sessions" ON code_generation_sessions;
CREATE POLICY "Users can view own code sessions" ON code_generation_sessions FOR SELECT
  USING (user_id = app.current_user_id());

DROP POLICY IF EXISTS "Users can manage own code sessions" ON code_generation_sessions;
CREATE POLICY "Users can manage own code sessions" ON code_generation_sessions FOR ALL
  USING (user_id = app.current_user_id());

-- Chat Messages
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'chat_messages'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own chat messages" ON chat_messages;
CREATE POLICY "Users can view own chat messages" ON chat_messages FOR SELECT
  USING (user_id = app.current_user_id() OR EXISTS (SELECT 1 FROM workspaces WHERE id = chat_messages.project_id AND owner_id = app.current_user_id()));

DROP POLICY IF EXISTS "Users can create own chat messages" ON chat_messages;
CREATE POLICY "Users can create own chat messages" ON chat_messages FOR INSERT
  WITH CHECK (user_id = app.current_user_id());

DROP POLICY IF EXISTS "Users can delete own chat messages" ON chat_messages;
CREATE POLICY "Users can delete own chat messages" ON chat_messages FOR DELETE
  USING (user_id = app.current_user_id());

-- API Keys
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'api_keys'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own API keys" ON api_keys;
CREATE POLICY "Users can view own API keys" ON api_keys FOR SELECT
  USING (user_id = app.current_user_id());

DROP POLICY IF EXISTS "Users can manage own API keys" ON api_keys;
CREATE POLICY "Users can manage own API keys" ON api_keys FOR ALL
  USING (user_id = app.current_user_id());

-- Rate Limits
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'rate_limits'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own rate limits" ON rate_limits;
CREATE POLICY "Users can view own rate limits" ON rate_limits FOR SELECT
  USING (user_id = app.current_user_id());

-- Usage Tracking
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'usage_tracking'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own usage tracking" ON usage_tracking;
CREATE POLICY "Users can view own usage tracking" ON usage_tracking FOR SELECT
  USING (user_id = app.current_user_id());

-- Generation Locks
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'generation_locks'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE generation_locks ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own generation locks" ON generation_locks;
CREATE POLICY "Users can view own generation locks" ON generation_locks FOR SELECT
  USING (user_id = app.current_user_id());

DROP POLICY IF EXISTS "Users can manage own generation locks" ON generation_locks;
CREATE POLICY "Users can manage own generation locks" ON generation_locks FOR ALL
  USING (user_id = app.current_user_id());

-- OAuth States
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'oauth_states'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own OAuth states" ON oauth_states;
CREATE POLICY "Users can view own OAuth states" ON oauth_states FOR SELECT
  USING (user_id = app.current_user_id());

DROP POLICY IF EXISTS "Users can create own OAuth states" ON oauth_states;
CREATE POLICY "Users can create own OAuth states" ON oauth_states FOR INSERT
  WITH CHECK (user_id = app.current_user_id());

DROP POLICY IF EXISTS "Users can delete own OAuth states" ON oauth_states;
CREATE POLICY "Users can delete own OAuth states" ON oauth_states FOR DELETE
  USING (user_id = app.current_user_id());

-- Event Logs
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'event_logs'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own event logs" ON event_logs;
CREATE POLICY "Users can view own event logs" ON event_logs FOR SELECT
  USING (user_id = app.current_user_id());

-- Plugin Configs
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'plugin_configs'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE plugin_configs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own plugin configs" ON plugin_configs;
CREATE POLICY "Users can view own plugin configs" ON plugin_configs FOR SELECT
  USING (user_id = app.current_user_id());

DROP POLICY IF EXISTS "Users can manage own plugin configs" ON plugin_configs;
CREATE POLICY "Users can manage own plugin configs" ON plugin_configs FOR ALL
  USING (user_id = app.current_user_id());

-- Plugin Knowledge
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'plugin_knowledge'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE plugin_knowledge ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own plugin knowledge" ON plugin_knowledge;
CREATE POLICY "Users can view own plugin knowledge" ON plugin_knowledge FOR SELECT
  USING (user_id = app.current_user_id());

-- Plugin Actions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'plugin_actions'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE plugin_actions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own plugin actions" ON plugin_actions;
CREATE POLICY "Users can view own plugin actions" ON plugin_actions FOR SELECT
  USING (user_id = app.current_user_id());

-- Plugin Sync Logs
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'plugin_sync_logs'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE plugin_sync_logs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own plugin sync logs" ON plugin_sync_logs;
CREATE POLICY "Users can view own plugin sync logs" ON plugin_sync_logs FOR SELECT
  USING (user_id = app.current_user_id());

-- Conversations
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'conversations'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
CREATE POLICY "Users can view own conversations" ON conversations FOR SELECT
  USING (user_id = app.current_user_id());

DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
CREATE POLICY "Users can manage own conversations" ON conversations FOR ALL
  USING (user_id = app.current_user_id());

-- User Preferences
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'user_preferences'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
CREATE POLICY "Users can view own preferences" ON user_preferences FOR SELECT
  USING (user_id = app.current_user_id());

DROP POLICY IF EXISTS "Users can manage own preferences" ON user_preferences;
CREATE POLICY "Users can manage own preferences" ON user_preferences FOR ALL
  USING (user_id = app.current_user_id());

-- AI Insights
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'ai_insights'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own AI insights" ON ai_insights;
CREATE POLICY "Users can view own AI insights" ON ai_insights FOR SELECT
  USING (user_id = app.current_user_id());

-- Prompt Chains (skip if already has RLS)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'prompt_chains') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      WHERE c.relname = 'prompt_chains' AND c.relrowsecurity = true
    ) THEN
      ALTER TABLE prompt_chains ENABLE ROW LEVEL SECURITY;
    END IF;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view prompt chains" ON prompt_chains;
CREATE POLICY "Users can view prompt chains" ON prompt_chains FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage prompt chains" ON prompt_chains;
CREATE POLICY "Users can manage prompt chains" ON prompt_chains FOR ALL USING (true);

-- Prompt Templates (skip if already has RLS)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'prompt_templates') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      WHERE c.relname = 'prompt_templates' AND c.relrowsecurity = true
    ) THEN
      ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
    END IF;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view prompt templates" ON prompt_templates;
CREATE POLICY "Users can view prompt templates" ON prompt_templates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage prompt templates" ON prompt_templates;
CREATE POLICY "Users can manage prompt templates" ON prompt_templates FOR ALL USING (true);

-- User Generated Plugins
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'user_generated_plugins'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE user_generated_plugins ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own plugins" ON user_generated_plugins;
CREATE POLICY "Users can view own plugins" ON user_generated_plugins FOR SELECT
  USING (user_id = app.current_user_id() OR status = 'approved');

DROP POLICY IF EXISTS "Users can manage own plugins" ON user_generated_plugins;
CREATE POLICY "Users can manage own plugins" ON user_generated_plugins FOR ALL
  USING (user_id = app.current_user_id());

-- Plugin Execution Logs
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'plugin_execution_logs'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE plugin_execution_logs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own plugin execution logs" ON plugin_execution_logs;
CREATE POLICY "Users can view own plugin execution logs" ON plugin_execution_logs FOR SELECT
  USING (user_id = app.current_user_id());

-- Plugin Generation Requests
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'plugin_generation_requests'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE plugin_generation_requests ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own plugin generation requests" ON plugin_generation_requests;
CREATE POLICY "Users can view own plugin generation requests" ON plugin_generation_requests FOR SELECT
  USING (user_id = app.current_user_id());

DROP POLICY IF EXISTS "Users can create own plugin generation requests" ON plugin_generation_requests;
CREATE POLICY "Users can create own plugin generation requests" ON plugin_generation_requests FOR INSERT
  WITH CHECK (user_id = app.current_user_id());

-- Plugin Reviews
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'plugin_reviews'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE plugin_reviews ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view all plugin reviews" ON plugin_reviews;
CREATE POLICY "Users can view all plugin reviews" ON plugin_reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create own plugin reviews" ON plugin_reviews;
CREATE POLICY "Users can create own plugin reviews" ON plugin_reviews FOR INSERT
  WITH CHECK (reviewer_id = app.current_user_id());

DROP POLICY IF EXISTS "Users can update own plugin reviews" ON plugin_reviews;
CREATE POLICY "Users can update own plugin reviews" ON plugin_reviews FOR UPDATE
  USING (reviewer_id = app.current_user_id());

-- Plugin Installations
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'plugin_installations'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE plugin_installations ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view own plugin installations" ON plugin_installations;
CREATE POLICY "Users can view own plugin installations" ON plugin_installations FOR SELECT
  USING (user_id = app.current_user_id());

DROP POLICY IF EXISTS "Users can manage own plugin installations" ON plugin_installations;
CREATE POLICY "Users can manage own plugin installations" ON plugin_installations FOR ALL
  USING (user_id = app.current_user_id());

-- Plugin Security Incidents
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'plugin_security_incidents'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE plugin_security_incidents ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Admins can view all security incidents" ON plugin_security_incidents;
CREATE POLICY "Admins can view all security incidents" ON plugin_security_incidents FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = app.current_user_id() AND role IN ('admin', 'superadmin')));

-- Plugin Marketplace Ratings
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'plugin_marketplace_ratings'
    AND c.relrowsecurity = false
  ) THEN
    ALTER TABLE plugin_marketplace_ratings ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can view all plugin ratings" ON plugin_marketplace_ratings;
CREATE POLICY "Users can view all plugin ratings" ON plugin_marketplace_ratings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own plugin ratings" ON plugin_marketplace_ratings;
CREATE POLICY "Users can manage own plugin ratings" ON plugin_marketplace_ratings FOR ALL
  USING (user_id = app.current_user_id());

-- Public reference tables (no RLS needed - these are public data)
-- ai_models, companies, frameworks are intentionally left without RLS

-- ==================================================================
-- STEP 3: FIX DUPLICATE INDEXES AND CONSTRAINTS
-- ==================================================================
-- Drop duplicate indexes
DROP INDEX IF EXISTS idx_code_gen_sessions_user_id;
DROP INDEX IF EXISTS idx_code_gen_sessions_workspace_id;
DROP INDEX IF EXISTS idx_pel_status;
DROP INDEX IF EXISTS idx_ugp_created;
DROP INDEX IF EXISTS idx_ugp_user_status;

-- Drop duplicate constraint (this is a constraint, not an index)
ALTER TABLE project_files DROP CONSTRAINT IF EXISTS project_files_project_id_file_path_key;

-- ==================================================================
-- VERIFICATION QUERY
-- ==================================================================
-- Run this to see which tables have RLS enabled:
-- SELECT tablename, relrowsecurity 
-- FROM pg_tables t
-- JOIN pg_class c ON c.relname = t.tablename
-- WHERE t.schemaname = 'public'
-- ORDER BY tablename;


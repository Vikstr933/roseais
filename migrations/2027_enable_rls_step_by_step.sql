/**
 * PostgreSQL Migration: Enable Row Level Security (RLS) - STEP BY STEP
 * 
 * This version runs each table in separate transactions to avoid deadlocks.
 * Run each section separately if you encounter deadlock issues.
 * 
 * CRITICAL: Run this in Supabase SQL Editor, one section at a time if needed
 */

-- ==================================================================
-- STEP 1: CREATE APP SCHEMA AND FUNCTION
-- ==================================================================
-- Run this first
CREATE SCHEMA IF NOT EXISTS app;
GRANT USAGE ON SCHEMA app TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS TEXT AS $$
  SELECT current_setting('app.user_id', true);
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION app.current_user_id() TO authenticated, anon, service_role;

-- ==================================================================
-- STEP 2: ENABLE RLS ON CORE TABLES (Run these one at a time if needed)
-- ==================================================================

-- Users
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON users FOR SELECT
  USING (id = app.current_user_id() OR (SELECT role FROM users WHERE id = app.current_user_id()) IN ('admin', 'superadmin'));
CREATE POLICY "Users can update own profile" ON users FOR UPDATE
  USING (id = app.current_user_id() OR (SELECT role FROM users WHERE id = app.current_user_id()) IN ('admin', 'superadmin'));

-- Sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can create own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON sessions;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sessions" ON sessions FOR SELECT
  USING (user_id = app.current_user_id() OR EXISTS (SELECT 1 FROM users WHERE id = app.current_user_id() AND role IN ('admin', 'superadmin')));
CREATE POLICY "Users can create own sessions" ON sessions FOR INSERT
  WITH CHECK (user_id = app.current_user_id());
CREATE POLICY "Users can delete own sessions" ON sessions FOR DELETE
  USING (user_id = app.current_user_id() OR EXISTS (SELECT 1 FROM users WHERE id = app.current_user_id() AND role IN ('admin', 'superadmin')));

-- Workspaces
DROP POLICY IF EXISTS "Users can view own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can create own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can update own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can delete own workspaces" ON workspaces;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own workspaces" ON workspaces FOR SELECT
  USING (owner_id = app.current_user_id() OR EXISTS (SELECT 1 FROM users WHERE id = app.current_user_id() AND role IN ('admin', 'superadmin')));
CREATE POLICY "Users can create own workspaces" ON workspaces FOR INSERT
  WITH CHECK (owner_id = app.current_user_id());
CREATE POLICY "Users can update own workspaces" ON workspaces FOR UPDATE
  USING (owner_id = app.current_user_id());
CREATE POLICY "Users can delete own workspaces" ON workspaces FOR DELETE
  USING (owner_id = app.current_user_id());

-- Project Files
DROP POLICY IF EXISTS "Users can view own project files" ON project_files;
DROP POLICY IF EXISTS "Users can manage own project files" ON project_files;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own project files" ON project_files FOR SELECT
  USING (EXISTS (SELECT 1 FROM workspaces WHERE id = project_files.project_id AND owner_id = app.current_user_id()));
CREATE POLICY "Users can manage own project files" ON project_files FOR ALL
  USING (EXISTS (SELECT 1 FROM workspaces WHERE id = project_files.project_id AND owner_id = app.current_user_id()));

-- Project Members
DROP POLICY IF EXISTS "Users can view project members" ON project_members;
DROP POLICY IF EXISTS "Project owners can manage members" ON project_members;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view project members" ON project_members FOR SELECT
  USING (user_id = app.current_user_id() OR EXISTS (SELECT 1 FROM workspaces WHERE id = project_members.project_id AND owner_id = app.current_user_id()));
CREATE POLICY "Project owners can manage members" ON project_members FOR ALL
  USING (EXISTS (SELECT 1 FROM workspaces WHERE id = project_members.project_id AND owner_id = app.current_user_id()));

-- Agents
DROP POLICY IF EXISTS "Users can view own and system agents" ON agents;
DROP POLICY IF EXISTS "Users can create own agents" ON agents;
DROP POLICY IF EXISTS "Users can update own agents" ON agents;
DROP POLICY IF EXISTS "Users can delete own agents" ON agents;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own and system agents" ON agents FOR SELECT
  USING (created_by = app.current_user_id() OR (SELECT is_system FROM agents WHERE id = agents.id) = 1 OR EXISTS (SELECT 1 FROM users WHERE id = app.current_user_id() AND role IN ('admin', 'superadmin')));
CREATE POLICY "Users can create own agents" ON agents FOR INSERT
  WITH CHECK (created_by = app.current_user_id());
CREATE POLICY "Users can update own agents" ON agents FOR UPDATE
  USING (created_by = app.current_user_id());
CREATE POLICY "Users can delete own agents" ON agents FOR DELETE
  USING (created_by = app.current_user_id());

-- User Credentials
DROP POLICY IF EXISTS "Users can view own credentials" ON user_credentials;
DROP POLICY IF EXISTS "Users can manage own credentials" ON user_credentials;
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own credentials" ON user_credentials FOR SELECT
  USING (user_id = app.current_user_id());
CREATE POLICY "Users can manage own credentials" ON user_credentials FOR ALL
  USING (user_id = app.current_user_id());

-- Discord User Mappings
DROP POLICY IF EXISTS "Users can view own Discord mapping" ON discord_user_mappings;
DROP POLICY IF EXISTS "Users can manage own Discord mapping" ON discord_user_mappings;
ALTER TABLE discord_user_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own Discord mapping" ON discord_user_mappings FOR SELECT
  USING (system_user_id = app.current_user_id());
CREATE POLICY "Users can manage own Discord mapping" ON discord_user_mappings FOR ALL
  USING (system_user_id = app.current_user_id());

-- Code Generation Sessions
DROP POLICY IF EXISTS "Users can view own code sessions" ON code_generation_sessions;
DROP POLICY IF EXISTS "Users can manage own code sessions" ON code_generation_sessions;
ALTER TABLE code_generation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own code sessions" ON code_generation_sessions FOR SELECT
  USING (user_id = app.current_user_id());
CREATE POLICY "Users can manage own code sessions" ON code_generation_sessions FOR ALL
  USING (user_id = app.current_user_id());

-- Chat Messages
DROP POLICY IF EXISTS "Users can view own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can create own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete own chat messages" ON chat_messages;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own chat messages" ON chat_messages FOR SELECT
  USING (user_id = app.current_user_id() OR EXISTS (SELECT 1 FROM workspaces WHERE id = chat_messages.project_id AND owner_id = app.current_user_id()));
CREATE POLICY "Users can create own chat messages" ON chat_messages FOR INSERT
  WITH CHECK (user_id = app.current_user_id());
CREATE POLICY "Users can delete own chat messages" ON chat_messages FOR DELETE
  USING (user_id = app.current_user_id());

-- API Keys
DROP POLICY IF EXISTS "Users can view own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can manage own API keys" ON api_keys;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own API keys" ON api_keys FOR SELECT
  USING (user_id = app.current_user_id());
CREATE POLICY "Users can manage own API keys" ON api_keys FOR ALL
  USING (user_id = app.current_user_id());

-- Rate Limits
DROP POLICY IF EXISTS "Users can view own rate limits" ON rate_limits;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own rate limits" ON rate_limits FOR SELECT
  USING (user_id = app.current_user_id());

-- Usage Tracking
DROP POLICY IF EXISTS "Users can view own usage tracking" ON usage_tracking;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own usage tracking" ON usage_tracking FOR SELECT
  USING (user_id = app.current_user_id());

-- Generation Locks
DROP POLICY IF EXISTS "Users can view own generation locks" ON generation_locks;
DROP POLICY IF EXISTS "Users can manage own generation locks" ON generation_locks;
ALTER TABLE generation_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own generation locks" ON generation_locks FOR SELECT
  USING (user_id = app.current_user_id());
CREATE POLICY "Users can manage own generation locks" ON generation_locks FOR ALL
  USING (user_id = app.current_user_id());

-- OAuth States
DROP POLICY IF EXISTS "Users can view own OAuth states" ON oauth_states;
DROP POLICY IF EXISTS "Users can create own OAuth states" ON oauth_states;
DROP POLICY IF EXISTS "Users can delete own OAuth states" ON oauth_states;
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own OAuth states" ON oauth_states FOR SELECT
  USING (user_id = app.current_user_id());
CREATE POLICY "Users can create own OAuth states" ON oauth_states FOR INSERT
  WITH CHECK (user_id = app.current_user_id());
CREATE POLICY "Users can delete own OAuth states" ON oauth_states FOR DELETE
  USING (user_id = app.current_user_id());

-- Event Logs
DROP POLICY IF EXISTS "Users can view own event logs" ON event_logs;
ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own event logs" ON event_logs FOR SELECT
  USING (user_id = app.current_user_id());

-- Plugin Configs
DROP POLICY IF EXISTS "Users can view own plugin configs" ON plugin_configs;
DROP POLICY IF EXISTS "Users can manage own plugin configs" ON plugin_configs;
ALTER TABLE plugin_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own plugin configs" ON plugin_configs FOR SELECT
  USING (user_id = app.current_user_id());
CREATE POLICY "Users can manage own plugin configs" ON plugin_configs FOR ALL
  USING (user_id = app.current_user_id());

-- Plugin Knowledge
DROP POLICY IF EXISTS "Users can view own plugin knowledge" ON plugin_knowledge;
ALTER TABLE plugin_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own plugin knowledge" ON plugin_knowledge FOR SELECT
  USING (user_id = app.current_user_id());

-- Plugin Actions
DROP POLICY IF EXISTS "Users can view own plugin actions" ON plugin_actions;
ALTER TABLE plugin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own plugin actions" ON plugin_actions FOR SELECT
  USING (user_id = app.current_user_id());

-- Plugin Sync Logs
DROP POLICY IF EXISTS "Users can view own plugin sync logs" ON plugin_sync_logs;
ALTER TABLE plugin_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own plugin sync logs" ON plugin_sync_logs FOR SELECT
  USING (user_id = app.current_user_id());

-- Conversations
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own conversations" ON conversations FOR SELECT
  USING (user_id = app.current_user_id());
CREATE POLICY "Users can manage own conversations" ON conversations FOR ALL
  USING (user_id = app.current_user_id());

-- User Preferences
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can manage own preferences" ON user_preferences;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own preferences" ON user_preferences FOR SELECT
  USING (user_id = app.current_user_id());
CREATE POLICY "Users can manage own preferences" ON user_preferences FOR ALL
  USING (user_id = app.current_user_id());

-- AI Insights
DROP POLICY IF EXISTS "Users can view own AI insights" ON ai_insights;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own AI insights" ON ai_insights FOR SELECT
  USING (user_id = app.current_user_id());

-- Prompt Chains (public for now)
DROP POLICY IF EXISTS "Users can view prompt chains" ON prompt_chains;
DROP POLICY IF EXISTS "Users can manage prompt chains" ON prompt_chains;
ALTER TABLE prompt_chains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view prompt chains" ON prompt_chains FOR SELECT USING (true);
CREATE POLICY "Users can manage prompt chains" ON prompt_chains FOR ALL USING (true);

-- Prompt Templates (public for now)
DROP POLICY IF EXISTS "Users can view prompt templates" ON prompt_templates;
DROP POLICY IF EXISTS "Users can manage prompt templates" ON prompt_templates;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view prompt templates" ON prompt_templates FOR SELECT USING (true);
CREATE POLICY "Users can manage prompt templates" ON prompt_templates FOR ALL USING (true);

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
-- NOTES
-- ==================================================================
-- If you get deadlock errors:
-- 1. Run Step 1 first
-- 2. Run each table section separately (copy/paste one at a time)
-- 3. Wait a few seconds between each section
-- 4. Service role bypasses RLS automatically
--


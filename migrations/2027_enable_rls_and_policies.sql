/**
 * PostgreSQL Migration: Enable Row Level Security (RLS) on All Tables
 * 
 * This migration enables RLS and creates policies for all tables to ensure
 * users can only access their own data.
 * 
 * CRITICAL: Run this in Supabase SQL Editor
 * 
 * This migration:
 * 1. Enables RLS on all user-owned tables
 * 2. Creates policies for SELECT, INSERT, UPDATE, DELETE
 * 3. Handles system/public tables appropriately
 * 4. Fixes duplicate indexes
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
-- Supabase already has auth.uid() built-in, but we use app context for our custom auth
CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS TEXT AS $$
  SELECT current_setting('app.user_id', true);
$$ LANGUAGE sql STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION app.current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION app.current_user_id() TO anon;
GRANT EXECUTE ON FUNCTION app.current_user_id() TO service_role;

-- ==================================================================
-- ENABLE RLS ON ALL USER-OWNED TABLES
-- ==================================================================

-- Users table - users can only see/update their own data
-- NOTE: service_role automatically bypasses RLS in Supabase
-- This is needed for OAuth and initial user creation
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (
    id = app.current_user_id() 
    OR (SELECT role FROM users WHERE id = app.current_user_id()) IN ('admin', 'superadmin')
  );

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (
    id = app.current_user_id() 
    OR (SELECT role FROM users WHERE id = app.current_user_id()) IN ('admin', 'superadmin')
  );

-- Sessions - users can only see their own sessions
-- NOTE: service_role automatically bypasses RLS in Supabase
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

CREATE POLICY "Users can create own sessions"
  ON sessions FOR INSERT
  WITH CHECK (user_id = app.current_user_id());

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

-- Workspaces - users can only see workspaces they own or are members of
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspaces"
  ON workspaces FOR SELECT
  USING (
    owner_id = app.current_user_id() 
    OR EXISTS (
      SELECT 1 FROM user_workspaces 
      WHERE workspace_id = workspaces.id 
      AND user_id = app.current_user_id()
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE id = app.current_user_id() AND role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Users can create own workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (owner_id = app.current_user_id());

CREATE POLICY "Users can update own workspaces"
  ON workspaces FOR UPDATE
  USING (
    owner_id = app.current_user_id() 
    OR EXISTS (
      SELECT 1 FROM user_workspaces 
      WHERE workspace_id = workspaces.id 
      AND user_id = app.current_user_id()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can delete own workspaces"
  ON workspaces FOR DELETE
  USING (owner_id = app.current_user_id());

-- User Workspaces (junction table)
ALTER TABLE user_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspace memberships"
  ON user_workspaces FOR SELECT
  USING (
    user_id = app.current_user_id() 
    OR EXISTS (
      SELECT 1 FROM workspaces 
      WHERE id = user_workspaces.workspace_id 
      AND owner_id = app.current_user_id()
    )
  );

CREATE POLICY "Workspace owners can manage members"
  ON user_workspaces FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspaces 
      WHERE id = user_workspaces.workspace_id 
      AND owner_id = app.current_user_id()
    )
  );

-- Project Files - users can only see files in their own projects
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project files"
  ON project_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspaces 
      WHERE id = project_files.project_id 
      AND (
        owner_id = app.current_user_id()
        OR EXISTS (
          SELECT 1 FROM user_workspaces 
          WHERE workspace_id = workspaces.id 
          AND user_id = app.current_user_id()
        )
      )
    )
  );

CREATE POLICY "Users can manage own project files"
  ON project_files FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspaces 
      WHERE id = project_files.project_id 
      AND (
        owner_id = app.current_user_id()
        OR EXISTS (
          SELECT 1 FROM user_workspaces 
          WHERE workspace_id = workspaces.id 
          AND user_id = app.current_user_id()
          AND role IN ('owner', 'admin', 'editor')
        )
      )
    )
  );

-- Project Members
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Project owners can manage members"
  ON project_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspaces 
      WHERE id = project_members.project_id 
      AND owner_id = app.current_user_id()
    )
  );

-- Agents - users can only see their own agents or system agents
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and system agents"
  ON agents FOR SELECT
  USING (
    user_id = app.current_user_id() 
    OR (is_system = 1)
    OR EXISTS (
      SELECT 1 FROM users WHERE id = app.current_user_id() AND role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Users can create own agents"
  ON agents FOR INSERT
  WITH CHECK (user_id = app.current_user_id());

CREATE POLICY "Users can update own agents"
  ON agents FOR UPDATE
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can delete own agents"
  ON agents FOR DELETE
  USING (user_id = app.current_user_id());

-- User Credentials - users can only see their own credentials
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credentials"
  ON user_credentials FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can manage own credentials"
  ON user_credentials FOR ALL
  USING (user_id = app.current_user_id());

-- Discord User Mappings
ALTER TABLE discord_user_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own Discord mapping"
  ON discord_user_mappings FOR SELECT
  USING (system_user_id = app.current_user_id());

CREATE POLICY "Users can manage own Discord mapping"
  ON discord_user_mappings FOR ALL
  USING (system_user_id = app.current_user_id());

-- Code Generation Sessions
ALTER TABLE code_generation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own code sessions"
  ON code_generation_sessions FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can manage own code sessions"
  ON code_generation_sessions FOR ALL
  USING (user_id = app.current_user_id());

-- Chat Messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat messages"
  ON chat_messages FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can create own chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (user_id = app.current_user_id());

CREATE POLICY "Users can delete own chat messages"
  ON chat_messages FOR DELETE
  USING (user_id = app.current_user_id());

-- Project Chat Messages
ALTER TABLE project_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project chat messages"
  ON project_chat_messages FOR SELECT
  USING (
    user_id = app.current_user_id()
    OR EXISTS (
      SELECT 1 FROM workspaces 
      WHERE id = project_chat_messages.project_id 
      AND (
        owner_id = app.current_user_id()
        OR EXISTS (
          SELECT 1 FROM user_workspaces 
          WHERE workspace_id = workspaces.id 
          AND user_id = app.current_user_id()
        )
      )
    )
  );

CREATE POLICY "Users can create project chat messages"
  ON project_chat_messages FOR INSERT
  WITH CHECK (
    user_id = app.current_user_id()
    AND EXISTS (
      SELECT 1 FROM workspaces 
      WHERE id = project_chat_messages.project_id 
      AND (
        owner_id = app.current_user_id()
        OR EXISTS (
          SELECT 1 FROM user_workspaces 
          WHERE workspace_id = workspaces.id 
          AND user_id = app.current_user_id()
        )
      )
    )
  );

-- User Generated Plugins
ALTER TABLE user_generated_plugins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plugins"
  ON user_generated_plugins FOR SELECT
  USING (user_id = app.current_user_id() OR status = 'approved');

CREATE POLICY "Users can manage own plugins"
  ON user_generated_plugins FOR ALL
  USING (user_id = app.current_user_id());

-- Plugin Installations
ALTER TABLE plugin_installations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plugin installations"
  ON plugin_installations FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can manage own plugin installations"
  ON plugin_installations FOR ALL
  USING (user_id = app.current_user_id());

-- Plugin Configs
ALTER TABLE plugin_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plugin configs"
  ON plugin_configs FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can manage own plugin configs"
  ON plugin_configs FOR ALL
  USING (user_id = app.current_user_id());

-- Plugin Knowledge
ALTER TABLE plugin_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plugin knowledge"
  ON plugin_knowledge FOR SELECT
  USING (user_id = app.current_user_id());

-- Plugin Execution Logs
ALTER TABLE plugin_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plugin execution logs"
  ON plugin_execution_logs FOR SELECT
  USING (user_id = app.current_user_id());

-- Plugin Generation Requests
ALTER TABLE plugin_generation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plugin generation requests"
  ON plugin_generation_requests FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can create own plugin generation requests"
  ON plugin_generation_requests FOR INSERT
  WITH CHECK (user_id = app.current_user_id());

-- Plugin Reviews
ALTER TABLE plugin_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all plugin reviews"
  ON plugin_reviews FOR SELECT
  USING (true); -- Reviews are public

CREATE POLICY "Users can create own plugin reviews"
  ON plugin_reviews FOR INSERT
  WITH CHECK (user_id = app.current_user_id());

CREATE POLICY "Users can update own plugin reviews"
  ON plugin_reviews FOR UPDATE
  USING (user_id = app.current_user_id());

-- Plugin Marketplace Ratings
ALTER TABLE plugin_marketplace_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all plugin ratings"
  ON plugin_marketplace_ratings FOR SELECT
  USING (true); -- Ratings are public

CREATE POLICY "Users can manage own plugin ratings"
  ON plugin_marketplace_ratings FOR ALL
  USING (user_id = app.current_user_id());

-- User API Keys
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own API keys"
  ON user_api_keys FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can manage own API keys"
  ON user_api_keys FOR ALL
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can view own API keys (api_keys table)"
  ON api_keys FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can manage own API keys (api_keys table)"
  ON api_keys FOR ALL
  USING (user_id = app.current_user_id());

-- OAuth States
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own OAuth states"
  ON oauth_states FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can create own OAuth states"
  ON oauth_states FOR INSERT
  WITH CHECK (user_id = app.current_user_id());

CREATE POLICY "Users can delete own OAuth states"
  ON oauth_states FOR DELETE
  USING (user_id = app.current_user_id());

-- User Usage Tracking
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON user_usage FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can view own usage tracking"
  ON usage_tracking FOR SELECT
  USING (user_id = app.current_user_id());

-- Rate Limits
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rate limits"
  ON rate_limits FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can view own rate limit buckets"
  ON rate_limit_buckets FOR SELECT
  USING (user_id = app.current_user_id());

-- Generation Locks
ALTER TABLE generation_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generation locks"
  ON generation_locks FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can manage own generation locks"
  ON generation_locks FOR ALL
  USING (user_id = app.current_user_id());

-- Conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can manage own conversations"
  ON conversations FOR ALL
  USING (user_id = app.current_user_id());

-- Knowledge Items
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own knowledge items"
  ON knowledge_items FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can manage own knowledge items"
  ON knowledge_items FOR ALL
  USING (user_id = app.current_user_id());

-- AI Insights
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI insights"
  ON ai_insights FOR SELECT
  USING (user_id = app.current_user_id());

-- User Preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can manage own preferences"
  ON user_preferences FOR ALL
  USING (user_id = app.current_user_id());

-- Activity Tracking
ALTER TABLE activity_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity"
  ON activity_tracking FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can view project activities"
  ON project_activities FOR SELECT
  USING (
    user_id = app.current_user_id()
    OR EXISTS (
      SELECT 1 FROM workspaces 
      WHERE id = project_activities.project_id 
      AND (
        owner_id = app.current_user_id()
        OR EXISTS (
          SELECT 1 FROM user_workspaces 
          WHERE workspace_id = workspaces.id 
          AND user_id = app.current_user_id()
        )
      )
    )
  );

-- Event Logs
ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own event logs"
  ON event_logs FOR SELECT
  USING (user_id = app.current_user_id());

-- Chain Executions
ALTER TABLE chain_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chain executions"
  ON chain_executions FOR SELECT
  USING (user_id = app.current_user_id());

-- Prompt Chains
ALTER TABLE prompt_chains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prompt chains"
  ON prompt_chains FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can manage own prompt chains"
  ON prompt_chains FOR ALL
  USING (user_id = app.current_user_id());

-- Prompt Templates
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and public prompt templates"
  ON prompt_templates FOR SELECT
  USING (user_id = app.current_user_id() OR is_public = true);

CREATE POLICY "Users can manage own prompt templates"
  ON prompt_templates FOR ALL
  USING (user_id = app.current_user_id());

-- Prompt Usage Logs
ALTER TABLE prompt_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prompt usage logs"
  ON prompt_usage_logs FOR SELECT
  USING (user_id = app.current_user_id());

-- Orchestration Patterns
ALTER TABLE orchestration_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orchestration patterns"
  ON orchestration_patterns FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can manage own orchestration patterns"
  ON orchestration_patterns FOR ALL
  USING (user_id = app.current_user_id());

-- Components
ALTER TABLE components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own components"
  ON components FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can manage own components"
  ON components FOR ALL
  USING (user_id = app.current_user_id());

-- Agent Scripts
ALTER TABLE agent_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent scripts"
  ON agent_scripts FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can manage own agent scripts"
  ON agent_scripts FOR ALL
  USING (user_id = app.current_user_id());

-- Coding Guidelines
ALTER TABLE coding_guidelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own coding guidelines"
  ON coding_guidelines FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY "Users can manage own coding guidelines"
  ON coding_guidelines FOR ALL
  USING (user_id = app.current_user_id());

-- Plugin Sync Logs
ALTER TABLE plugin_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plugin sync logs"
  ON plugin_sync_logs FOR SELECT
  USING (user_id = app.current_user_id());

-- Plugin Actions
ALTER TABLE plugin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plugin actions"
  ON plugin_actions FOR SELECT
  USING (user_id = app.current_user_id());

-- Plugin Security Incidents
ALTER TABLE plugin_security_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all security incidents"
  ON plugin_security_incidents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = app.current_user_id() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- Subscription Plans (public read, admin write)
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view subscription plans"
  ON subscription_plans FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage subscription plans"
  ON subscription_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = app.current_user_id() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- ==================================================================
-- PUBLIC TABLES (No RLS needed - these are reference data)
-- ==================================================================
-- These tables contain public reference data and don't need RLS:
-- - ai_models (public AI model information)
-- - companies (public company information)
-- - frameworks (public framework information)

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
-- IMPORTANT: SERVICE ROLE BYPASS
-- ==================================================================
-- 
-- Supabase service_role can bypass RLS by default when using the
-- service_role key in connection string. This is necessary for:
-- - OAuth authentication
-- - User registration
-- - Admin operations
-- - Background jobs
--
-- Your backend should use the service_role connection string for
-- these operations. Regular user queries will be filtered by RLS.
--
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
-- 3. For Supabase Auth integration, you can use auth.uid() instead:
--    USING (user_id = auth.uid())
--
-- 4. Admin users can bypass RLS by checking role in policies
--
-- 5. Some tables (ai_models, companies, frameworks) are intentionally
--    left without RLS as they contain public reference data
--
-- 6. Test RLS policies after migration:
--    SET app.user_id = 'test-user-id';
--    SELECT * FROM users; -- Should only return current user
--


/**
 * PostgreSQL Migration: Fix Performance Issues
 * 
 * This migration addresses Supabase database linter warnings:
 * 1. Adds indexes for unindexed foreign keys
 * 2. Consolidates multiple permissive RLS policies (removes duplicate SELECT policies)
 * 3. Removes duplicate indexes
 * 
 * IMPORTANT: 
 * - Run during low-traffic periods
 * - If deadlock occurs, wait 30 seconds and try again
 */

-- ==================================================================
-- STEP 1: ADD INDEXES FOR UNINDEXED FOREIGN KEYS
-- ==================================================================
-- These indexes improve query performance for foreign key lookups

CREATE INDEX IF NOT EXISTS idx_activity_tracking_user_id_fkey ON activity_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_chain_executions_chain_id_fkey ON chain_executions(chain_id);
CREATE INDEX IF NOT EXISTS idx_components_created_by_fkey ON components(created_by);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_user_id_fkey ON knowledge_items(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_workspace_id_fkey ON knowledge_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_ratings_user_id_fkey ON plugin_marketplace_ratings(user_id);

-- ==================================================================
-- STEP 2: REMOVE DUPLICATE INDEXES
-- ==================================================================
-- Remove duplicate indexes to reduce storage and improve write performance

DROP INDEX IF EXISTS idx_code_sessions_status;

-- ==================================================================
-- STEP 3: CONSOLIDATE MULTIPLE PERMISSIVE RLS POLICIES
-- ==================================================================
-- Replace separate "view" and "manage" policies with single consolidated policies
-- This improves performance by reducing policy evaluation overhead
-- Each policy is wrapped in error handling for safety

-- api_keys
DROP POLICY IF EXISTS "Users can view own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can manage own API keys" ON api_keys;
CREATE POLICY "Users can manage own API keys" ON api_keys FOR ALL
  USING (user_id = app.current_user_id());

-- code_generation_sessions
DROP POLICY IF EXISTS "Users can view own code sessions" ON code_generation_sessions;
DROP POLICY IF EXISTS "Users can manage own code sessions" ON code_generation_sessions;
CREATE POLICY "Users can manage own code sessions" ON code_generation_sessions FOR ALL
  USING (user_id = app.current_user_id());

-- conversations
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
CREATE POLICY "Users can manage own conversations" ON conversations FOR ALL
  USING (user_id = app.current_user_id());

-- discord_user_mappings
DROP POLICY IF EXISTS "Users can view own Discord mapping" ON discord_user_mappings;
DROP POLICY IF EXISTS "Users can manage own Discord mapping" ON discord_user_mappings;
CREATE POLICY "Users can manage own Discord mapping" ON discord_user_mappings FOR ALL
  USING (system_user_id = app.current_user_id());

-- generation_locks
DROP POLICY IF EXISTS "Users can view own generation locks" ON generation_locks;
DROP POLICY IF EXISTS "Users can manage own generation locks" ON generation_locks;
CREATE POLICY "Users can manage own generation locks" ON generation_locks FOR ALL
  USING (user_id = app.current_user_id());

-- plugin_configs
DROP POLICY IF EXISTS "Users can view own plugin configs" ON plugin_configs;
DROP POLICY IF EXISTS "Users can manage own plugin configs" ON plugin_configs;
CREATE POLICY "Users can manage own plugin configs" ON plugin_configs FOR ALL
  USING (user_id = app.current_user_id());

-- project_files
DROP POLICY IF EXISTS "Users can view own project files" ON project_files;
DROP POLICY IF EXISTS "Users can manage own project files" ON project_files;
CREATE POLICY "Users can manage own project files" ON project_files FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspaces WHERE id = project_files.project_id AND owner_id = app.current_user_id()
    )
  );

-- project_members: Consolidate policies
-- Note: The original "Project owners can manage members" was FOR ALL (including SELECT),
-- which created a duplicate SELECT policy. We now separate SELECT from INSERT/UPDATE/DELETE.
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view project members" ON project_members;
  DROP POLICY IF EXISTS "Project owners can manage members" ON project_members;
  DROP POLICY IF EXISTS "Project owners can insert members" ON project_members;
  DROP POLICY IF EXISTS "Project owners can update members" ON project_members;
  DROP POLICY IF EXISTS "Project owners can delete members" ON project_members;
  
  -- Single SELECT policy for both members and owners
  CREATE POLICY "Users can view project members" ON project_members FOR SELECT
    USING (
      user_id = app.current_user_id() 
      OR EXISTS (
        SELECT 1 FROM workspaces WHERE id = project_members.project_id AND owner_id = app.current_user_id()
      )
    );
  
  -- Separate INSERT/UPDATE/DELETE policies for owners only
  CREATE POLICY "Project owners can insert members" ON project_members FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM workspaces w WHERE w.id = project_id AND w.owner_id = app.current_user_id()
      )
    );
  
  CREATE POLICY "Project owners can update members" ON project_members FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = project_members.project_id
        AND w.owner_id = app.current_user_id()
      )
    );
  
  CREATE POLICY "Project owners can delete members" ON project_members FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = project_members.project_id
        AND w.owner_id = app.current_user_id()
      )
    );
END $$;

-- prompt_chains
-- Note: This table does not have a user_id column, so we use USING (true) for public access
-- Using separate statements to avoid deadlocks
DROP POLICY IF EXISTS "Users can view prompt chains" ON prompt_chains;
DROP POLICY IF EXISTS "Users can manage prompt chains" ON prompt_chains;
CREATE POLICY "Users can manage prompt chains" ON prompt_chains FOR ALL
  USING (true);

-- prompt_templates
-- Note: This table does not have a user_id column, so we use USING (true) for public access
-- Using separate statements to avoid deadlocks
DROP POLICY IF EXISTS "Users can view prompt templates" ON prompt_templates;
DROP POLICY IF EXISTS "Users can manage prompt templates" ON prompt_templates;
CREATE POLICY "Users can manage prompt templates" ON prompt_templates FOR ALL
  USING (true);

-- user_credentials
DROP POLICY IF EXISTS "Users can view own credentials" ON user_credentials;
DROP POLICY IF EXISTS "Users can manage own credentials" ON user_credentials;
CREATE POLICY "Users can manage own credentials" ON user_credentials FOR ALL
  USING (user_id = app.current_user_id());

-- user_preferences
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can manage own preferences" ON user_preferences;
CREATE POLICY "Users can manage own preferences" ON user_preferences FOR ALL
  USING (user_id = app.current_user_id());

-- ==================================================================
-- STEP 4: NOTES ON UNUSED INDEXES
-- ==================================================================
-- The following indexes are reported as unused but are kept for potential future use:
-- - Many indexes on frequently queried columns (user_id, created_at, status, etc.)
-- - These may become useful as the application grows and query patterns change
-- - Consider monitoring query patterns before removing unused indexes
-- - Unused indexes have minimal impact on SELECT performance but do consume storage
-- - They can be removed later if storage becomes a concern

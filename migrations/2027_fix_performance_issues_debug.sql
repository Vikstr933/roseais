/**
 * PostgreSQL Migration: Fix Performance Issues (DEBUG VERSION)
 * 
 * This version wraps each policy creation in error handling to identify which one fails.
 */

-- ==================================================================
-- STEP 1: ADD INDEXES FOR UNINDEXED FOREIGN KEYS
-- ==================================================================
CREATE INDEX IF NOT EXISTS idx_activity_tracking_user_id_fkey ON activity_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_chain_executions_chain_id_fkey ON chain_executions(chain_id);
CREATE INDEX IF NOT EXISTS idx_components_created_by_fkey ON components(created_by);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_user_id_fkey ON knowledge_items(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_workspace_id_fkey ON knowledge_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_ratings_user_id_fkey ON plugin_marketplace_ratings(user_id);

-- ==================================================================
-- STEP 2: REMOVE DUPLICATE INDEXES
-- ==================================================================
DROP INDEX IF EXISTS idx_code_sessions_status;

-- ==================================================================
-- STEP 3: CONSOLIDATE MULTIPLE PERMISSIVE RLS POLICIES (WITH ERROR HANDLING)
-- ==================================================================

-- api_keys
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own API keys" ON api_keys;
  DROP POLICY IF EXISTS "Users can manage own API keys" ON api_keys;
  CREATE POLICY "Users can manage own API keys" ON api_keys FOR ALL
    USING (user_id = app.current_user_id());
  RAISE NOTICE 'Success: api_keys policy created';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR on api_keys: %', SQLERRM;
END $$;

-- code_generation_sessions
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own code sessions" ON code_generation_sessions;
  DROP POLICY IF EXISTS "Users can manage own code sessions" ON code_generation_sessions;
  CREATE POLICY "Users can manage own code sessions" ON code_generation_sessions FOR ALL
    USING (user_id = app.current_user_id());
  RAISE NOTICE 'Success: code_generation_sessions policy created';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR on code_generation_sessions: %', SQLERRM;
END $$;

-- conversations
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
  DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
  CREATE POLICY "Users can manage own conversations" ON conversations FOR ALL
    USING (user_id = app.current_user_id());
  RAISE NOTICE 'Success: conversations policy created';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR on conversations: %', SQLERRM;
END $$;

-- discord_user_mappings
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own Discord mapping" ON discord_user_mappings;
  DROP POLICY IF EXISTS "Users can manage own Discord mapping" ON discord_user_mappings;
  CREATE POLICY "Users can manage own Discord mapping" ON discord_user_mappings FOR ALL
    USING (system_user_id = app.current_user_id());
  RAISE NOTICE 'Success: discord_user_mappings policy created';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR on discord_user_mappings: %', SQLERRM;
END $$;

-- generation_locks
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own generation locks" ON generation_locks;
  DROP POLICY IF EXISTS "Users can manage own generation locks" ON generation_locks;
  CREATE POLICY "Users can manage own generation locks" ON generation_locks FOR ALL
    USING (user_id = app.current_user_id());
  RAISE NOTICE 'Success: generation_locks policy created';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR on generation_locks: %', SQLERRM;
END $$;

-- plugin_configs
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own plugin configs" ON plugin_configs;
  DROP POLICY IF EXISTS "Users can manage own plugin configs" ON plugin_configs;
  CREATE POLICY "Users can manage own plugin configs" ON plugin_configs FOR ALL
    USING (user_id = app.current_user_id());
  RAISE NOTICE 'Success: plugin_configs policy created';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR on plugin_configs: %', SQLERRM;
END $$;

-- project_files
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own project files" ON project_files;
  DROP POLICY IF EXISTS "Users can manage own project files" ON project_files;
  CREATE POLICY "Users can manage own project files" ON project_files FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM workspaces WHERE id = project_files.project_id AND owner_id = app.current_user_id()
      )
    );
  RAISE NOTICE 'Success: project_files policy created';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR on project_files: %', SQLERRM;
END $$;

-- project_members
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view project members" ON project_members;
  DROP POLICY IF EXISTS "Project owners can manage members" ON project_members;
  DROP POLICY IF EXISTS "Project owners can insert members" ON project_members;
  DROP POLICY IF EXISTS "Project owners can update members" ON project_members;
  DROP POLICY IF EXISTS "Project owners can delete members" ON project_members;
  
  CREATE POLICY "Users can view project members" ON project_members FOR SELECT
    USING (
      user_id = app.current_user_id() 
      OR EXISTS (
        SELECT 1 FROM workspaces WHERE id = project_members.project_id AND owner_id = app.current_user_id()
      )
    );
  
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
  RAISE NOTICE 'Success: project_members policies created';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR on project_members: %', SQLERRM;
END $$;

-- prompt_chains
-- Note: This table does not have a user_id column, so we use USING (true) for public access
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view prompt chains" ON prompt_chains;
  DROP POLICY IF EXISTS "Users can manage prompt chains" ON prompt_chains;
  CREATE POLICY "Users can manage prompt chains" ON prompt_chains FOR ALL
    USING (true);
  RAISE NOTICE 'Success: prompt_chains policy created';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR on prompt_chains: %', SQLERRM;
END $$;

-- prompt_templates
-- Note: This table does not have a user_id column, so we use USING (true) for public access
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view prompt templates" ON prompt_templates;
  DROP POLICY IF EXISTS "Users can manage prompt templates" ON prompt_templates;
  CREATE POLICY "Users can manage prompt templates" ON prompt_templates FOR ALL
    USING (true);
  RAISE NOTICE 'Success: prompt_templates policy created';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR on prompt_templates: %', SQLERRM;
END $$;

-- user_credentials
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own credentials" ON user_credentials;
  DROP POLICY IF EXISTS "Users can manage own credentials" ON user_credentials;
  CREATE POLICY "Users can manage own credentials" ON user_credentials FOR ALL
    USING (user_id = app.current_user_id());
  RAISE NOTICE 'Success: user_credentials policy created';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR on user_credentials: %', SQLERRM;
END $$;

-- user_preferences
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
  DROP POLICY IF EXISTS "Users can manage own preferences" ON user_preferences;
  CREATE POLICY "Users can manage own preferences" ON user_preferences FOR ALL
    USING (user_id = app.current_user_id());
  RAISE NOTICE 'Success: user_preferences policy created';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR on user_preferences: %', SQLERRM;
END $$;


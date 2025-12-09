/**
 * PostgreSQL Migration: Enable RLS on Remaining Tables
 * 
 * This migration enables RLS on tables that were missed in the initial RLS migration.
 * 
 * IMPORTANT: 
 * - Run during low-traffic periods
 * - If deadlock occurs, wait 30 seconds and try again
 */

-- ==================================================================
-- USER-SPECIFIC TABLES (with user_id)
-- ==================================================================

-- project_chat_messages
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_chat_messages') THEN
    ALTER TABLE project_chat_messages ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view project chat messages" ON project_chat_messages;
    CREATE POLICY "Users can view project chat messages" ON project_chat_messages FOR SELECT
      USING (
        user_id = app.current_user_id()
        OR EXISTS (
          SELECT 1 FROM workspaces w
          WHERE w.id = project_chat_messages.project_id
          AND w.owner_id = app.current_user_id()
        )
        OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = project_chat_messages.project_id
          AND pm.user_id = app.current_user_id()
        )
      );
    
    DROP POLICY IF EXISTS "Users can create project chat messages" ON project_chat_messages;
    CREATE POLICY "Users can create project chat messages" ON project_chat_messages FOR INSERT
      WITH CHECK (
        user_id = app.current_user_id()
        AND (
          EXISTS (
            SELECT 1 FROM workspaces w
            WHERE w.id = project_id
            AND w.owner_id = app.current_user_id()
          )
          OR EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = project_id
            AND pm.user_id = app.current_user_id()
          )
        )
      );
    
    DROP POLICY IF EXISTS "Users can update own project chat messages" ON project_chat_messages;
    CREATE POLICY "Users can update own project chat messages" ON project_chat_messages FOR UPDATE
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can delete own project chat messages" ON project_chat_messages;
    CREATE POLICY "Users can delete own project chat messages" ON project_chat_messages FOR DELETE
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- chain_executions
-- Note: prompt_chains doesn't have user_id, so chain_executions is public
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chain_executions') THEN
    ALTER TABLE chain_executions ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view chain executions" ON chain_executions;
    CREATE POLICY "Users can view chain executions" ON chain_executions FOR SELECT
      USING (true);
    
    DROP POLICY IF EXISTS "Users can manage chain executions" ON chain_executions;
    CREATE POLICY "Users can manage chain executions" ON chain_executions FOR ALL
      USING (true);
  END IF;
END $$;

-- user_workspaces
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_workspaces') THEN
    ALTER TABLE user_workspaces ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own workspace memberships" ON user_workspaces;
    CREATE POLICY "Users can view own workspace memberships" ON user_workspaces FOR SELECT
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can manage own workspace memberships" ON user_workspaces;
    CREATE POLICY "Users can manage own workspace memberships" ON user_workspaces FOR ALL
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- user_usage
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_usage') THEN
    ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own usage" ON user_usage;
    CREATE POLICY "Users can view own usage" ON user_usage FOR SELECT
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can create own usage records" ON user_usage;
    CREATE POLICY "Users can create own usage records" ON user_usage FOR INSERT
      WITH CHECK (user_id = app.current_user_id());
  END IF;
END $$;

-- user_sessions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_sessions') THEN
    ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;
    CREATE POLICY "Users can view own sessions" ON user_sessions FOR SELECT
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can manage own sessions" ON user_sessions;
    CREATE POLICY "Users can manage own sessions" ON user_sessions FOR ALL
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- user_api_keys
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_api_keys') THEN
    ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own API keys" ON user_api_keys;
    CREATE POLICY "Users can view own API keys" ON user_api_keys FOR SELECT
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can manage own API keys" ON user_api_keys;
    CREATE POLICY "Users can manage own API keys" ON user_api_keys FOR ALL
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- project_activities
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_activities') THEN
    ALTER TABLE project_activities ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view project activities" ON project_activities;
    CREATE POLICY "Users can view project activities" ON project_activities FOR SELECT
      USING (
        user_id = app.current_user_id()
        OR EXISTS (
          SELECT 1 FROM workspaces w
          WHERE w.id = project_activities.project_id
          AND w.owner_id = app.current_user_id()
        )
        OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = project_activities.project_id
          AND pm.user_id = app.current_user_id()
        )
      );
    
    DROP POLICY IF EXISTS "Users can create project activities" ON project_activities;
    CREATE POLICY "Users can create project activities" ON project_activities FOR INSERT
      WITH CHECK (
        user_id = app.current_user_id()
        AND (
          EXISTS (
            SELECT 1 FROM workspaces w
            WHERE w.id = project_id
            AND w.owner_id = app.current_user_id()
          )
          OR EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = project_id
            AND pm.user_id = app.current_user_id()
          )
        )
      );
  END IF;
END $$;

-- knowledge_items (if not already enabled)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'knowledge_items') THEN
    ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own knowledge items" ON knowledge_items;
    CREATE POLICY "Users can view own knowledge items" ON knowledge_items FOR SELECT
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can manage own knowledge items" ON knowledge_items;
    CREATE POLICY "Users can manage own knowledge items" ON knowledge_items FOR ALL
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- activity_tracking
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_tracking') THEN
    ALTER TABLE activity_tracking ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own activity" ON activity_tracking;
    CREATE POLICY "Users can view own activity" ON activity_tracking FOR SELECT
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can manage own activity" ON activity_tracking;
    CREATE POLICY "Users can manage own activity" ON activity_tracking FOR ALL
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- agent_scripts
-- Note: This table doesn't have user_id or created_by, so it's public (system scripts)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_scripts') THEN
    ALTER TABLE agent_scripts ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view agent scripts" ON agent_scripts;
    CREATE POLICY "Users can view agent scripts" ON agent_scripts FOR SELECT
      USING (true);
    
    DROP POLICY IF EXISTS "Users can manage agent scripts" ON agent_scripts;
    CREATE POLICY "Users can manage agent scripts" ON agent_scripts FOR ALL
      USING (true);
  END IF;
END $$;

-- components
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'components') THEN
    ALTER TABLE components ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view components" ON components;
    CREATE POLICY "Users can view components" ON components FOR SELECT
      USING (
        is_public = TRUE
        OR created_by = app.current_user_id()
      );
    
    DROP POLICY IF EXISTS "Users can manage own components" ON components;
    CREATE POLICY "Users can manage own components" ON components FOR ALL
      USING (created_by = app.current_user_id());
  END IF;
END $$;

-- ==================================================================
-- PLUGIN-RELATED TABLES
-- ==================================================================

-- plugin_security_incidents
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plugin_security_incidents') THEN
    ALTER TABLE plugin_security_incidents ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own security incidents" ON plugin_security_incidents;
    CREATE POLICY "Users can view own security incidents" ON plugin_security_incidents FOR SELECT
      USING (
        user_id = app.current_user_id()
        OR EXISTS (
          SELECT 1 FROM users WHERE id = app.current_user_id() AND role IN ('admin', 'superadmin')
        )
      );
    
    DROP POLICY IF EXISTS "Admins can manage security incidents" ON plugin_security_incidents;
    CREATE POLICY "Admins can manage security incidents" ON plugin_security_incidents FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users WHERE id = app.current_user_id() AND role IN ('admin', 'superadmin')
        )
      );
  END IF;
END $$;

-- plugin_installations
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plugin_installations') THEN
    ALTER TABLE plugin_installations ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own plugin installations" ON plugin_installations;
    CREATE POLICY "Users can view own plugin installations" ON plugin_installations FOR SELECT
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can manage own plugin installations" ON plugin_installations;
    CREATE POLICY "Users can manage own plugin installations" ON plugin_installations FOR ALL
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- plugin_reviews
-- Note: Uses reviewer_id instead of user_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plugin_reviews') THEN
    ALTER TABLE plugin_reviews ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view plugin reviews" ON plugin_reviews;
    CREATE POLICY "Users can view plugin reviews" ON plugin_reviews FOR SELECT
      USING (true); -- Public reviews
    
    DROP POLICY IF EXISTS "Users can create own plugin reviews" ON plugin_reviews;
    CREATE POLICY "Users can create own plugin reviews" ON plugin_reviews FOR INSERT
      WITH CHECK (reviewer_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can update own plugin reviews" ON plugin_reviews;
    CREATE POLICY "Users can update own plugin reviews" ON plugin_reviews FOR UPDATE
      USING (reviewer_id = app.current_user_id());
  END IF;
END $$;

-- plugin_generation_requests
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plugin_generation_requests') THEN
    ALTER TABLE plugin_generation_requests ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own plugin generation requests" ON plugin_generation_requests;
    CREATE POLICY "Users can view own plugin generation requests" ON plugin_generation_requests FOR SELECT
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can manage own plugin generation requests" ON plugin_generation_requests;
    CREATE POLICY "Users can manage own plugin generation requests" ON plugin_generation_requests FOR ALL
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- plugin_execution_logs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plugin_execution_logs') THEN
    ALTER TABLE plugin_execution_logs ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own plugin execution logs" ON plugin_execution_logs;
    CREATE POLICY "Users can view own plugin execution logs" ON plugin_execution_logs FOR SELECT
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can create own plugin execution logs" ON plugin_execution_logs;
    CREATE POLICY "Users can create own plugin execution logs" ON plugin_execution_logs FOR INSERT
      WITH CHECK (user_id = app.current_user_id());
  END IF;
END $$;

-- plugin_marketplace_ratings
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plugin_marketplace_ratings') THEN
    ALTER TABLE plugin_marketplace_ratings ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view plugin ratings" ON plugin_marketplace_ratings;
    CREATE POLICY "Users can view plugin ratings" ON plugin_marketplace_ratings FOR SELECT
      USING (true); -- Public ratings
    
    DROP POLICY IF EXISTS "Users can manage own plugin ratings" ON plugin_marketplace_ratings;
    CREATE POLICY "Users can manage own plugin ratings" ON plugin_marketplace_ratings FOR ALL
      USING (user_id = app.current_user_id());
  END IF;
END $$;

-- ==================================================================
-- OTHER TABLES
-- ==================================================================

-- orchestration_patterns
-- Note: This table doesn't have user_id or is_public, so it's public (system patterns)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orchestration_patterns') THEN
    ALTER TABLE orchestration_patterns ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view orchestration patterns" ON orchestration_patterns;
    CREATE POLICY "Users can view orchestration patterns" ON orchestration_patterns FOR SELECT
      USING (true);
    
    DROP POLICY IF EXISTS "Users can manage orchestration patterns" ON orchestration_patterns;
    CREATE POLICY "Users can manage orchestration patterns" ON orchestration_patterns FOR ALL
      USING (true);
  END IF;
END $$;

-- coding_guidelines
-- Note: This table doesn't have user_id or is_public, so it's public (system guidelines)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coding_guidelines') THEN
    ALTER TABLE coding_guidelines ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view coding guidelines" ON coding_guidelines;
    CREATE POLICY "Users can view coding guidelines" ON coding_guidelines FOR SELECT
      USING (true);
    
    DROP POLICY IF EXISTS "Users can manage coding guidelines" ON coding_guidelines;
    CREATE POLICY "Users can manage coding guidelines" ON coding_guidelines FOR ALL
      USING (true);
  END IF;
END $$;

-- prompt_usage_logs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prompt_usage_logs') THEN
    ALTER TABLE prompt_usage_logs ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own prompt usage logs" ON prompt_usage_logs;
    CREATE POLICY "Users can view own prompt usage logs" ON prompt_usage_logs FOR SELECT
      USING (user_id = app.current_user_id());
    
    DROP POLICY IF EXISTS "Users can create own prompt usage logs" ON prompt_usage_logs;
    CREATE POLICY "Users can create own prompt usage logs" ON prompt_usage_logs FOR INSERT
      WITH CHECK (user_id = app.current_user_id());
  END IF;
END $$;

-- ==================================================================
-- PUBLIC REFERENCE TABLES (RLS explicitly NOT enabled)
-- ==================================================================
-- These tables contain public reference data and should remain accessible to all
-- subscription_plans, frameworks, companies, ai_models

-- Note: subscription_plans, frameworks, companies, and ai_models are intentionally
-- left without RLS as they contain public reference data that all users should access.

-- ==================================================================
-- SYSTEM TABLES (RLS explicitly NOT enabled)
-- ==================================================================
-- rate_limit_buckets - System table for rate limiting, managed by application

-- Note: rate_limit_buckets is a system table and should be managed by the application
-- with appropriate access controls at the application level.


-- ==================================================================
-- COMPLETE DATABASE SCHEMA - PART 3: PLUGINS AND MONITORING
-- Run this AFTER Part 2
-- ==================================================================

-- ==================================================================
-- RATE LIMITS TABLE (API rate limiting)
-- ==================================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  window_start TIMESTAMP NOT NULL,
  window_end TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_id ON rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_end ON rate_limits(window_end);

-- ==================================================================
-- USAGE TRACKING TABLE (Track API usage and costs)
-- ==================================================================

CREATE TABLE IF NOT EXISTS usage_tracking (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,  -- 'code_generation', 'chat', 'api_call'
  tokens_used INTEGER DEFAULT 0,
  cost_cents INTEGER DEFAULT 0,  -- Cost in cents
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_created_at ON usage_tracking(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_action_type ON usage_tracking(action_type);

-- ==================================================================
-- EVENT LOGS TABLE (System-wide event logging)
-- ==================================================================

CREATE TABLE IF NOT EXISTS event_logs (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,  -- 'user_login', 'generation_started', 'plugin_sync', etc.
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_logs_event_type ON event_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_event_logs_user_id ON event_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_created_at ON event_logs(created_at);

-- ==================================================================
-- PLUGIN CONFIGS TABLE (User plugin configurations)
-- ==================================================================

CREATE TABLE IF NOT EXISTS plugin_configs (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plugin_id TEXT NOT NULL,  -- 'gmail', 'google-calendar', 'github', etc.
  enabled BOOLEAN NOT NULL DEFAULT false,
  credentials JSONB,  -- Encrypted credentials
  settings JSONB DEFAULT '{}'::jsonb,
  last_sync TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plugin_configs_user_id ON plugin_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_plugin_configs_plugin_id ON plugin_configs(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_configs_enabled ON plugin_configs(enabled);

-- ==================================================================
-- PLUGIN KNOWLEDGE TABLE (Knowledge from external sources)
-- ==================================================================

CREATE TABLE IF NOT EXISTS plugin_knowledge (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plugin_id TEXT NOT NULL,
  external_id TEXT NOT NULL,  -- ID from external service
  type TEXT NOT NULL,  -- 'email', 'calendar_event', 'task', 'document'
  title TEXT NOT NULL,
  content TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  relevance_score REAL,  -- Score for search ranking
  timestamp TIMESTAMP NOT NULL,  -- When the item was created/modified externally
  synced_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plugin_knowledge_user_id ON plugin_knowledge(user_id);
CREATE INDEX IF NOT EXISTS idx_plugin_knowledge_plugin_id ON plugin_knowledge(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_knowledge_type ON plugin_knowledge(type);
CREATE INDEX IF NOT EXISTS idx_plugin_knowledge_timestamp ON plugin_knowledge(timestamp);
CREATE INDEX IF NOT EXISTS idx_plugin_knowledge_relevance_score ON plugin_knowledge(relevance_score);

-- ==================================================================
-- PLUGIN ACTIONS TABLE (Track plugin actions/executions)
-- ==================================================================

CREATE TABLE IF NOT EXISTS plugin_actions (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plugin_id TEXT NOT NULL,
  action_type TEXT NOT NULL,  -- 'send_email', 'create_event', 'update_task'
  parameters JSONB DEFAULT '{}'::jsonb,
  result JSONB,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'success', 'failed'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plugin_actions_user_id ON plugin_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_plugin_actions_plugin_id ON plugin_actions(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_actions_status ON plugin_actions(status);
CREATE INDEX IF NOT EXISTS idx_plugin_actions_created_at ON plugin_actions(created_at);

-- ==================================================================
-- PLUGIN SYNC LOGS TABLE (Track synchronization operations)
-- ==================================================================

CREATE TABLE IF NOT EXISTS plugin_sync_logs (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plugin_id TEXT NOT NULL,
  sync_type TEXT NOT NULL DEFAULT 'incremental',  -- 'full', 'incremental'
  items_synced INTEGER NOT NULL DEFAULT 0,
  items_created INTEGER NOT NULL DEFAULT 0,
  items_updated INTEGER NOT NULL DEFAULT 0,
  items_deleted INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress',  -- 'in_progress', 'success', 'failed'
  error_message TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER,  -- Duration in milliseconds
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_plugin_sync_logs_user_id ON plugin_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_plugin_sync_logs_plugin_id ON plugin_sync_logs(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_sync_logs_status ON plugin_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_plugin_sync_logs_started_at ON plugin_sync_logs(started_at);

SELECT 'Part 3 Complete: Plugin and monitoring tables created successfully!' AS status;
SELECT 'All database tables created! Your schema is now complete.' AS final_status;

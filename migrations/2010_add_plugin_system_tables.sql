-- Migration: Add Plugin System Tables
-- Description: Add tables for productivity plugin system (Gmail, Calendar, etc.)
-- Date: 2025-10-28

-- Plugin configurations table
-- Stores user-specific plugin settings and credentials
CREATE TABLE IF NOT EXISTS plugin_configs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  plugin_id VARCHAR(255) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  credentials JSONB,
  settings JSONB,
  last_sync TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_user_plugin UNIQUE(user_id, plugin_id),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_plugin_configs_user_id ON plugin_configs(user_id);
CREATE INDEX idx_plugin_configs_plugin_id ON plugin_configs(plugin_id);
CREATE INDEX idx_plugin_configs_enabled ON plugin_configs(enabled);

-- Plugin knowledge table
-- Stores knowledge items synced from external services
CREATE TABLE IF NOT EXISTS plugin_knowledge (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  plugin_id VARCHAR(255) NOT NULL,
  external_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'email', 'calendar_event', 'task', 'document', etc.
  title TEXT NOT NULL,
  content TEXT,
  metadata JSONB,
  embedding TEXT, -- For semantic search (will store as JSON string until pgvector is enabled)
  relevance_score FLOAT,
  timestamp TIMESTAMP NOT NULL,
  synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_external_item UNIQUE(user_id, plugin_id, external_id),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_plugin_knowledge_user_id ON plugin_knowledge(user_id);
CREATE INDEX idx_plugin_knowledge_plugin_id ON plugin_knowledge(plugin_id);
CREATE INDEX idx_plugin_knowledge_type ON plugin_knowledge(type);
CREATE INDEX idx_plugin_knowledge_timestamp ON plugin_knowledge(timestamp);
CREATE INDEX idx_plugin_knowledge_synced_at ON plugin_knowledge(synced_at);

-- For vector similarity search (if pgvector extension is available)
-- CREATE INDEX idx_plugin_knowledge_embedding ON plugin_knowledge USING ivfflat (embedding vector_cosine_ops);

-- Plugin actions table
-- Stores history of actions executed through plugins
CREATE TABLE IF NOT EXISTS plugin_actions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  plugin_id VARCHAR(255) NOT NULL,
  action_type VARCHAR(100) NOT NULL, -- 'send_email', 'create_event', etc.
  parameters JSONB,
  result JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,

  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_plugin_actions_user_id ON plugin_actions(user_id);
CREATE INDEX idx_plugin_actions_plugin_id ON plugin_actions(plugin_id);
CREATE INDEX idx_plugin_actions_status ON plugin_actions(status);
CREATE INDEX idx_plugin_actions_created_at ON plugin_actions(created_at);

-- Plugin sync logs table
-- Stores synchronization history and statistics
CREATE TABLE IF NOT EXISTS plugin_sync_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  plugin_id VARCHAR(255) NOT NULL,
  sync_type VARCHAR(50) NOT NULL DEFAULT 'incremental', -- 'full', 'incremental'
  items_synced INTEGER NOT NULL DEFAULT 0,
  items_created INTEGER NOT NULL DEFAULT 0,
  items_updated INTEGER NOT NULL DEFAULT 0,
  items_deleted INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'success', 'failed'
  error_message TEXT,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  metadata JSONB,

  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_plugin_sync_logs_user_id ON plugin_sync_logs(user_id);
CREATE INDEX idx_plugin_sync_logs_plugin_id ON plugin_sync_logs(plugin_id);
CREATE INDEX idx_plugin_sync_logs_status ON plugin_sync_logs(status);
CREATE INDEX idx_plugin_sync_logs_started_at ON plugin_sync_logs(started_at);

-- Add comment to document the schema
COMMENT ON TABLE plugin_configs IS 'Stores user-specific plugin configurations and credentials';
COMMENT ON TABLE plugin_knowledge IS 'Stores knowledge items synced from external productivity services';
COMMENT ON TABLE plugin_actions IS 'Stores history of actions executed through plugins';
COMMENT ON TABLE plugin_sync_logs IS 'Stores synchronization history and statistics for plugins';

-- Grant permissions (adjust based on your database user)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON plugin_configs TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON plugin_knowledge TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON plugin_actions TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON plugin_sync_logs TO your_app_user;

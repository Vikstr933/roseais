-- Migration: Add project_databases table for automatic database provisioning
-- Date: 2025-12-01
-- Purpose: Store database configurations for user projects (auto-provisioned or manual)

CREATE TABLE IF NOT EXISTS project_databases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  database_type TEXT NOT NULL, -- 'mongodb', 'postgresql', 'mysql'
  provider TEXT NOT NULL, -- 'supabase', 'neon', 'mongodb-atlas', 'manual'
  connection_string TEXT NOT NULL, -- Encrypted connection string
  database_url TEXT, -- Provider dashboard URL
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'pending', 'failed'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT project_databases_project_id_unique UNIQUE (project_id) -- One database per project
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_databases_user_id ON project_databases(user_id);
CREATE INDEX IF NOT EXISTS idx_project_databases_project_id ON project_databases(project_id);
CREATE INDEX IF NOT EXISTS idx_project_databases_status ON project_databases(status);

-- Add comment
COMMENT ON TABLE project_databases IS 'Stores database configurations for user projects. Connection strings are encrypted.';


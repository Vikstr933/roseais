-- ============================================================
-- Migration: Add Lovable-inspired features
-- Date: 2025-12-10
-- ============================================================

-- 1. Add isStarred field to workspaces
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_workspaces_is_starred ON workspaces(is_starred, owner_id);

-- 2. Add folder_id to workspaces for project organization
CREATE TABLE IF NOT EXISTS project_folders (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  color TEXT DEFAULT '#9333ea',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_folders_owner_id ON project_folders(owner_id);

ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES project_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workspaces_folder_id ON workspaces(folder_id);

-- 3. Add publishing_policy to workspaces for external publishing control
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS publishing_policy JSONB DEFAULT '{"allowExternalPublishing": true, "allowedRoles": ["admin", "owner"]}'::jsonb;

-- 4. Add tool_permissions table for plugin tool permissions
CREATE TABLE IF NOT EXISTS tool_permissions (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plugin_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'ask', -- 'allow', 'ask', 'deny'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, plugin_id, tool_id)
);

CREATE INDEX IF NOT EXISTS idx_tool_permissions_user_id ON tool_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_permissions_plugin_id ON tool_permissions(plugin_id);

-- 5. Add view_preference to users for grid/list view
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS view_preference TEXT DEFAULT 'grid'; -- 'grid' or 'list'

SELECT 'Migration complete: Lovable features added!' AS status;


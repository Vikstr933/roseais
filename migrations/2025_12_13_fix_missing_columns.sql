-- Migration: Fix missing columns for production
-- Date: 2025-12-13
-- Description: Add missing columns that are causing errors in production
-- This migration is safe to run multiple times (uses IF NOT EXISTS)

-- 1. Add is_starred to workspaces (if missing)
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_workspaces_is_starred ON workspaces(is_starred, owner_id);

-- 2. Add folder_id to workspaces (if missing)
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS folder_id INTEGER;

-- Create project_folders table if it doesn't exist
CREATE TABLE IF NOT EXISTS project_folders (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  color TEXT DEFAULT '#9333ea',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_folders_owner_id ON project_folders(owner_id);

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'workspaces_folder_id_fkey'
  ) THEN
    ALTER TABLE workspaces 
    ADD CONSTRAINT workspaces_folder_id_fkey 
    FOREIGN KEY (folder_id) REFERENCES project_folders(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workspaces_folder_id ON workspaces(folder_id);

-- 3. Add publishing_policy to workspaces (if missing)
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS publishing_policy JSONB DEFAULT '{"allowExternalPublishing": true, "allowedRoles": ["admin", "owner"]}'::jsonb;

-- 5. Ensure all other connector-related columns exist in api_keys
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS encrypted_key TEXT,
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS workspace_id TEXT,
ADD COLUMN IF NOT EXISTS configured_by TEXT REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS service_name TEXT,
ADD COLUMN IF NOT EXISTS key_type TEXT DEFAULT 'api_key',
ADD COLUMN IF NOT EXISTS connector_id TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_api_keys_shared ON api_keys(is_shared, workspace_id) WHERE is_shared = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_service ON api_keys(service_name) WHERE service_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_connector_id ON api_keys(connector_id) WHERE connector_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN workspaces.is_starred IS 'Whether this workspace is starred/favorited by the owner';
COMMENT ON COLUMN api_keys.encrypted_key IS 'The actual encrypted API key value';
COMMENT ON COLUMN api_keys.configured_by IS 'User ID who configured this shared connector (admin)';
COMMENT ON COLUMN api_keys.is_shared IS 'If true, this API key is workspace-wide and can be used by all users';
COMMENT ON COLUMN api_keys.workspace_id IS 'Workspace ID for shared connectors (null for personal)';
COMMENT ON COLUMN api_keys.service_name IS 'Service name (e.g., vercel, stripe, github)';
COMMENT ON COLUMN api_keys.key_type IS 'Type of key: api_key, secret, token, password';
COMMENT ON COLUMN api_keys.connector_id IS 'Optional: Links this API key to a specific connector configuration';
COMMENT ON COLUMN api_keys.metadata IS 'JSONB field for storing env variables and other connector metadata';

SELECT 'Migration complete: Missing columns added!' AS status;


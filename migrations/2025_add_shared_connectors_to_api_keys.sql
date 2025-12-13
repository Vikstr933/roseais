-- Migration: Add Shared Connectors support to API Keys
-- Created: 2025-01-XX
-- Description: Add support for workspace-wide (shared) API keys that can be used by all users

-- Add columns to api_keys table for shared connectors
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS workspace_id TEXT,
ADD COLUMN IF NOT EXISTS configured_by TEXT REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS service_name TEXT,
ADD COLUMN IF NOT EXISTS key_type TEXT DEFAULT 'api_key';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_shared ON api_keys(is_shared, workspace_id) WHERE is_shared = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_service ON api_keys(service_name) WHERE service_name IS NOT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN api_keys.is_shared IS 'If true, this API key is workspace-wide and can be used by all users';
COMMENT ON COLUMN api_keys.workspace_id IS 'Workspace ID for shared connectors (null for personal)';
COMMENT ON COLUMN api_keys.configured_by IS 'User ID who configured this shared connector (admin)';
COMMENT ON COLUMN api_keys.service_name IS 'Service name (e.g., vercel, stripe, github)';
COMMENT ON COLUMN api_keys.key_type IS 'Type of key: api_key, secret, token, password';


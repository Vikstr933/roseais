-- Migration: Add project-specific API keys support
-- This allows API keys to be associated with specific projects or be user-wide

-- Add projectId column to api_keys table (nullable - null means user-wide)
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add index for faster lookups by project
CREATE INDEX IF NOT EXISTS idx_api_keys_project_id ON api_keys(project_id) WHERE project_id IS NOT NULL;

-- Add index for user + project lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_user_project ON api_keys(user_id, project_id);

-- Add comment to document the column
COMMENT ON COLUMN api_keys.project_id IS 'If NULL, key is user-wide. If set, key is specific to this project.';


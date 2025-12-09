-- Migration: Add permissions column to project_members table
-- Date: 2025-10-31
-- Purpose: Fix workspace loading errors caused by missing permissions column

-- Add permissions column with default empty JSON object
ALTER TABLE project_members
ADD COLUMN IF NOT EXISTS permissions TEXT NOT NULL DEFAULT '{}';

-- Update existing rows to have default permissions
UPDATE project_members
SET permissions = '{}'
WHERE permissions IS NULL OR permissions = '';

-- Add comment for documentation
COMMENT ON COLUMN project_members.permissions IS 'JSON stored as text containing member permissions (canEdit, canDelete, canInvite)';

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'project_members' AND column_name = 'permissions';

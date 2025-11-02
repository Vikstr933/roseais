-- Migration: Add workspace_type distinction for personal vs team projects
-- Date: 2025-01-02
-- Description: Adds workspace_type column to clearly separate personal projects from team/collaborative workspaces

-- Add workspace_type column
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS workspace_type TEXT NOT NULL DEFAULT 'personal';

-- Set workspace_type to 'team' for workspaces with multiple members
UPDATE workspaces
SET workspace_type = 'team'
WHERE id IN (
  SELECT DISTINCT project_id
  FROM project_members
  GROUP BY project_id
  HAVING COUNT(*) > 1
);

-- Set workspace_type to 'team' for workspaces with an invite_code (intended for collaboration)
UPDATE workspaces
SET workspace_type = 'team'
WHERE invite_code IS NOT NULL AND workspace_type = 'personal';

-- Create index for faster filtering by workspace_type
CREATE INDEX IF NOT EXISTS idx_workspaces_type_owner ON workspaces(workspace_type, owner_id);

-- Add comment explaining the distinction
COMMENT ON COLUMN workspaces.workspace_type IS 'Type of workspace: "personal" for private solo work, "team" for collaborative projects with multiple members';

-- Log migration completion
SELECT 'Migration 2021_add_workspace_type_distinction.sql completed successfully' AS status;

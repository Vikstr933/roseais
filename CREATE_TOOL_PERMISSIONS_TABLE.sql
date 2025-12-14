-- ============================================================================
-- Migration: Create tool_permissions table
-- Date: 2025-12-14
-- Purpose: Fix missing tool_permissions table causing plugin permission errors
-- Database: PostgreSQL (Supabase/Render)
-- ============================================================================
-- Error: relation "tool_permissions" does not exist
-- This migration is safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================================

-- Create tool_permissions table for plugin tool permissions
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tool_permissions_user_id ON tool_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_permissions_plugin_id ON tool_permissions(plugin_id);
CREATE INDEX IF NOT EXISTS idx_tool_permissions_user_plugin_tool ON tool_permissions(user_id, plugin_id, tool_id);

-- Add comments for documentation
COMMENT ON TABLE tool_permissions IS 'Stores user permissions for plugin tools (allow/ask/deny)';
COMMENT ON COLUMN tool_permissions.user_id IS 'User ID who owns this permission';
COMMENT ON COLUMN tool_permissions.plugin_id IS 'Plugin ID (e.g., gmail, calendar)';
COMMENT ON COLUMN tool_permissions.tool_id IS 'Tool ID within the plugin (e.g., search_emails, send_email)';
COMMENT ON COLUMN tool_permissions.permission IS 'Permission level: allow (auto-execute), ask (require confirmation), deny (block)';

-- Verify table was created
SELECT 
  '✅ tool_permissions table created successfully!' AS status,
  COUNT(*) AS existing_rows
FROM tool_permissions;

SELECT 'Migration complete: tool_permissions table ready!' AS status;


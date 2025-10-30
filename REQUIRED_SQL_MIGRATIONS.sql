-- ================================================
-- REQUIRED SQL MIGRATIONS FOR SUPABASE
-- Run these in order to fix all database issues
-- Date: October 30, 2025
-- ================================================

-- ================================================
-- Migration 2017: Fix code_generation_sessions table
-- ================================================
-- This fixes: column "completed_at" does not exist
-- And ensures proper columns for the sessions table

ALTER TABLE code_generation_sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE code_generation_sessions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE code_generation_sessions DROP COLUMN IF EXISTS completed_at;

-- ================================================
-- Migration 2018: Cleanup orphaned chat messages
-- ================================================
-- This removes chat messages that reference deleted workspaces
-- And adds an index for better performance

DELETE FROM chat_messages WHERE project_id NOT IN (SELECT id FROM workspaces);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_project_id ON chat_messages(project_id);

-- ================================================
-- Migration 2019: Fix timestamp fields in users table
-- ================================================
-- This fixes the login error: value.toISOString is not a function
-- Ensures all timestamp fields have proper defaults

ALTER TABLE users ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ALTER COLUMN last_login_at SET DEFAULT NULL;

-- Fix any NULL timestamp values that shouldn't be NULL
UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;

-- ================================================
-- Migration 2020: Add missing columns
-- ================================================
-- Add any missing columns that might cause errors

-- Add file_type column if missing (for file management)
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'unknown';

-- Add missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);

-- ================================================
-- Migration 2021: Clean up orphaned code generation sessions
-- ================================================
-- Remove code generation sessions that reference deleted workspaces

DELETE FROM code_generation_sessions
WHERE workspace_id IS NOT NULL
AND workspace_id NOT IN (SELECT id FROM workspaces);

-- ================================================
-- Migration 2022: Add cascade delete rules
-- ================================================
-- Add foreign key constraints with CASCADE DELETE for automatic cleanup
-- NOTE: Only run this if your foreign keys don't already have CASCADE

-- First, drop existing foreign key constraints (if they exist)
-- Then recreate with CASCADE DELETE

-- For chat_messages
ALTER TABLE chat_messages
DROP CONSTRAINT IF EXISTS chat_messages_project_id_fkey;

ALTER TABLE chat_messages
ADD CONSTRAINT chat_messages_project_id_fkey
FOREIGN KEY (project_id)
REFERENCES workspaces(id)
ON DELETE CASCADE;

-- For code_generation_sessions
ALTER TABLE code_generation_sessions
DROP CONSTRAINT IF EXISTS code_generation_sessions_workspace_id_fkey;

ALTER TABLE code_generation_sessions
ADD CONSTRAINT code_generation_sessions_workspace_id_fkey
FOREIGN KEY (workspace_id)
REFERENCES workspaces(id)
ON DELETE CASCADE;

-- For project_members
ALTER TABLE project_members
DROP CONSTRAINT IF EXISTS project_members_project_id_fkey;

ALTER TABLE project_members
ADD CONSTRAINT project_members_project_id_fkey
FOREIGN KEY (project_id)
REFERENCES workspaces(id)
ON DELETE CASCADE;

-- ================================================
-- VERIFICATION QUERIES
-- Run these after migrations to verify everything worked
-- ================================================

-- Check if all columns exist
SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'code_generation_sessions'
ORDER BY ordinal_position;

-- Check for orphaned records
SELECT
    'chat_messages' as table_name,
    COUNT(*) as orphaned_count
FROM chat_messages
WHERE project_id NOT IN (SELECT id FROM workspaces)
UNION ALL
SELECT
    'code_generation_sessions' as table_name,
    COUNT(*) as orphaned_count
FROM code_generation_sessions
WHERE workspace_id IS NOT NULL
AND workspace_id NOT IN (SELECT id FROM workspaces);

-- Check indexes
SELECT
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('workspaces', 'chat_messages', 'code_generation_sessions', 'project_members')
ORDER BY tablename, indexname;

-- ================================================
-- HOW TO RUN THESE MIGRATIONS IN SUPABASE:
-- ================================================
-- 1. Go to your Supabase dashboard
-- 2. Navigate to SQL Editor
-- 3. Copy and paste each migration section one at a time
-- 4. Run each migration and verify it succeeds
-- 5. Run the verification queries at the end
-- 6. Test the application to ensure errors are resolved
-- ================================================
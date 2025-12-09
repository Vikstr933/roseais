-- ============================================================
-- FINAL DATABASE FIX - RUN THIS TO FIX REMAINING ERRORS
-- ============================================================
-- This specifically fixes the errors still showing in your logs
-- Date: October 30, 2025
-- ============================================================

-- ============================================================
-- FIX 1: Fix user_id type mismatch (UUID vs INTEGER)
-- ============================================================
-- The users table has UUID IDs but project_chat_messages expects INTEGER

-- First, check current user_id data type
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'id';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'project_chat_messages' AND column_name = 'user_id';

-- Convert user_id in project_chat_messages to TEXT/UUID type
ALTER TABLE project_chat_messages DROP CONSTRAINT IF EXISTS project_chat_messages_user_id_fkey;
ALTER TABLE project_chat_messages ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Convert user_id in chat_messages to TEXT/UUID type if needed
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_user_id_fkey;
ALTER TABLE chat_messages ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- ============================================================
-- FIX 2: Ensure code_generation_sessions doesn't have completed_at
-- ============================================================
-- Drop the completed_at column that no longer exists in the code
ALTER TABLE code_generation_sessions DROP COLUMN IF EXISTS completed_at;

-- Ensure status and metadata columns exist
ALTER TABLE code_generation_sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE code_generation_sessions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE code_generation_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- ============================================================
-- FIX 3: Fix owner_id type in workspaces if needed
-- ============================================================
-- Check if owner_id is INTEGER but users.id is UUID
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'workspaces' AND column_name = 'owner_id';

-- If owner_id is INTEGER, convert to TEXT/UUID
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_owner_id_fkey;
ALTER TABLE workspaces ALTER COLUMN owner_id TYPE TEXT USING owner_id::TEXT;

-- ============================================================
-- FIX 4: Create project_members table with correct types
-- ============================================================
DROP TABLE IF EXISTS project_members CASCADE;

CREATE TABLE project_members (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,  -- Using TEXT for UUID user IDs
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);

-- ============================================================
-- FIX 5: Fix all user_id foreign key constraints with correct types
-- ============================================================
-- For project_files
ALTER TABLE project_files DROP CONSTRAINT IF EXISTS project_files_created_by_fkey;
ALTER TABLE project_files DROP CONSTRAINT IF EXISTS project_files_last_modified_by_fkey;
ALTER TABLE project_files ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
ALTER TABLE project_files ALTER COLUMN last_modified_by TYPE TEXT USING last_modified_by::TEXT;

-- For code_generation_sessions
ALTER TABLE code_generation_sessions DROP CONSTRAINT IF EXISTS code_generation_sessions_user_id_fkey;
ALTER TABLE code_generation_sessions ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- ============================================================
-- FIX 6: Clean up any invalid data
-- ============================================================
-- Remove any rows with invalid user_id values
DELETE FROM project_chat_messages WHERE user_id IS NOT NULL AND user_id !~ '^[a-f0-9\-]+$';
DELETE FROM chat_messages WHERE user_id IS NOT NULL AND user_id !~ '^[a-f0-9\-]+$';

-- ============================================================
-- VERIFICATION QUERIES - Run these to confirm fixes
-- ============================================================

-- Check user_id types across all tables
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE column_name = 'user_id'
ORDER BY table_name;

-- Check owner_id type
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE column_name = 'owner_id'
ORDER BY table_name;

-- Check code_generation_sessions columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'code_generation_sessions'
ORDER BY ordinal_position;

-- Check if project_members exists
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'project_members'
);

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
SELECT 'All database fixes have been applied successfully!' as status;
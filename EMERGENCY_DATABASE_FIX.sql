-- ============================================================
-- EMERGENCY DATABASE FIX - RUN IMMEDIATELY IN SUPABASE
-- ============================================================
-- This fixes ALL critical database errors preventing workspace creation
-- Date: October 30, 2025
-- ============================================================

-- ============================================================
-- FIX 1: Add missing columns to users table
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Update any NULL values
UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;
UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
UPDATE users SET username = email WHERE username IS NULL;
UPDATE users SET display_name = COALESCE(name, email) WHERE display_name IS NULL;

-- ============================================================
-- FIX 2: Add missing columns to project_files table
-- ============================================================
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS created_by INTEGER;
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS last_modified_by INTEGER;
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'unknown';
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ============================================================
-- FIX 3: Fix project_chat_messages table
-- ============================================================
-- Check if user_id column is TEXT and needs to be converted to INTEGER
DO $$
BEGIN
    -- First, drop any existing foreign key constraints
    ALTER TABLE project_chat_messages DROP CONSTRAINT IF EXISTS project_chat_messages_user_id_fkey;

    -- Check if user_id is text type
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'project_chat_messages'
        AND column_name = 'user_id'
        AND data_type = 'text'
    ) THEN
        -- Add temporary column
        ALTER TABLE project_chat_messages ADD COLUMN user_id_int INTEGER;

        -- Convert text IDs to integers (handle non-numeric values)
        UPDATE project_chat_messages
        SET user_id_int = CASE
            WHEN user_id ~ '^\d+$' THEN user_id::INTEGER
            ELSE NULL
        END;

        -- Drop old column and rename new one
        ALTER TABLE project_chat_messages DROP COLUMN user_id;
        ALTER TABLE project_chat_messages RENAME COLUMN user_id_int TO user_id;
    END IF;
END $$;

-- Add missing columns if they don't exist
ALTER TABLE project_chat_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE project_chat_messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE project_chat_messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
ALTER TABLE project_chat_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;

-- ============================================================
-- FIX 4: Fix code_generation_sessions table
-- ============================================================
ALTER TABLE code_generation_sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE code_generation_sessions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE code_generation_sessions DROP COLUMN IF EXISTS completed_at;

-- ============================================================
-- FIX 5: Create missing project_members table if it doesn't exist
-- ============================================================
CREATE TABLE IF NOT EXISTS project_members (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(project_id, user_id)
);

-- ============================================================
-- FIX 6: Add indexes for better performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_project_id ON chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_project_chat_messages_project_id ON project_chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_chat_messages_created_at ON project_chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);

-- ============================================================
-- FIX 7: Clean up orphaned records
-- ============================================================
-- Delete chat messages for non-existent workspaces
DELETE FROM chat_messages WHERE project_id NOT IN (SELECT id FROM workspaces);
DELETE FROM project_chat_messages WHERE project_id NOT IN (SELECT id FROM workspaces);

-- Delete code generation sessions for non-existent workspaces
DELETE FROM code_generation_sessions
WHERE workspace_id IS NOT NULL
AND workspace_id NOT IN (SELECT id FROM workspaces);

-- Delete project files for non-existent workspaces
DELETE FROM project_files WHERE project_id NOT IN (SELECT id FROM workspaces);

-- ============================================================
-- FIX 8: Add foreign key constraints with CASCADE DELETE
-- ============================================================
-- Chat messages
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_project_id_fkey;
ALTER TABLE chat_messages
ADD CONSTRAINT chat_messages_project_id_fkey
FOREIGN KEY (project_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- Project chat messages
ALTER TABLE project_chat_messages DROP CONSTRAINT IF EXISTS project_chat_messages_project_id_fkey;
ALTER TABLE project_chat_messages
ADD CONSTRAINT project_chat_messages_project_id_fkey
FOREIGN KEY (project_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- Code generation sessions
ALTER TABLE code_generation_sessions DROP CONSTRAINT IF EXISTS code_generation_sessions_workspace_id_fkey;
ALTER TABLE code_generation_sessions
ADD CONSTRAINT code_generation_sessions_workspace_id_fkey
FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- Project files
ALTER TABLE project_files DROP CONSTRAINT IF EXISTS project_files_project_id_fkey;
ALTER TABLE project_files
ADD CONSTRAINT project_files_project_id_fkey
FOREIGN KEY (project_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- ============================================================
-- FIX 9: Create trigger for auto-updating updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to workspaces table
DROP TRIGGER IF EXISTS update_workspaces_updated_at ON workspaces;
CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- VERIFICATION QUERIES - Run these to verify fixes worked
-- ============================================================

-- Check users table columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('created_at', 'updated_at', 'last_login_at', 'username', 'display_name')
ORDER BY ordinal_position;

-- Check project_files columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'project_files'
AND column_name IN ('created_by', 'last_modified_by', 'file_type', 'version', 'is_active');

-- Check project_chat_messages user_id type
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'project_chat_messages'
AND column_name = 'user_id';

-- Check for orphaned records
SELECT
    'chat_messages' as table_name,
    COUNT(*) as orphaned_count
FROM chat_messages
WHERE project_id NOT IN (SELECT id FROM workspaces)
UNION ALL
SELECT
    'project_chat_messages' as table_name,
    COUNT(*) as orphaned_count
FROM project_chat_messages
WHERE project_id NOT IN (SELECT id FROM workspaces)
UNION ALL
SELECT
    'code_generation_sessions' as table_name,
    COUNT(*) as orphaned_count
FROM code_generation_sessions
WHERE workspace_id IS NOT NULL
AND workspace_id NOT IN (SELECT id FROM workspaces);

-- Check indexes
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('workspaces', 'chat_messages', 'project_chat_messages', 'project_files', 'project_members')
ORDER BY tablename, indexname;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
SELECT 'All database fixes have been applied successfully!' as status;
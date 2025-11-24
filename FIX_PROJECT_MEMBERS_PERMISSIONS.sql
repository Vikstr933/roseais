-- ============================================================================
-- Fix Project Members Permissions Column - Comprehensive Migration
-- ============================================================================
-- Purpose: Ensure project_members table exists with permissions column
-- Date: January 2025
-- Database: PostgreSQL (Supabase)
-- ============================================================================

-- Step 1: Create project_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS project_members (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'collaborator', -- owner, admin, editor, viewer, collaborator
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    permissions JSONB DEFAULT '{}', -- JSON for specific permissions (canEdit, canDelete, canInvite)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (project_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(project_id, user_id)
);

-- Step 2: Add permissions column if table exists but column doesn't
DO $$
BEGIN
    -- Check if permissions column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'project_members' 
        AND column_name = 'permissions'
    ) THEN
        -- Add permissions column as JSONB (PostgreSQL native type)
        ALTER TABLE project_members 
        ADD COLUMN permissions JSONB DEFAULT '{}';
        
        -- Update existing rows to have default permissions
        UPDATE project_members 
        SET permissions = '{}'::jsonb 
        WHERE permissions IS NULL;
        
        RAISE NOTICE 'Added permissions column to project_members table';
    ELSE
        RAISE NOTICE 'Permissions column already exists in project_members table';
    END IF;
END $$;

-- Step 3: Ensure is_active column exists (some migrations may have missed it)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'project_members' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE project_members 
        ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
        
        RAISE NOTICE 'Added is_active column to project_members table';
    ELSE
        RAISE NOTICE 'is_active column already exists in project_members table';
    END IF;
END $$;

-- Step 4: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_active ON project_members(is_active) WHERE is_active = TRUE;

-- Step 5: Verify the table structure
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'project_members' 
ORDER BY ordinal_position;

-- Step 6: Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Project members table migration completed successfully!';
    RAISE NOTICE '   - Table: project_members';
    RAISE NOTICE '   - Permissions column: JSONB with default {}';
    RAISE NOTICE '   - Indexes created for performance';
END $$;


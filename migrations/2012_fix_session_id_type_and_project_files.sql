-- Migration: Fix session ID type and add missing columns
-- Date: 2025-10-29
-- Description:
--   1. Change code_generation_sessions.id from INTEGER to TEXT to support string IDs
--   2. Add is_active column to project_files table

-- ============================================
-- PART 1: Fix code_generation_sessions.id type
-- ============================================

-- Step 1: Create a new temporary table with correct schema
CREATE TABLE IF NOT EXISTS code_generation_sessions_new (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  input_prompt TEXT,
  generated_code TEXT,
  agent_id TEXT,
  workspace_id INTEGER,
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Step 2: Copy data from old table to new table (convert INTEGER IDs to TEXT)
INSERT INTO code_generation_sessions_new (
  id, user_id, title, description, created_at, updated_at,
  input_prompt, generated_code, agent_id, workspace_id, status, metadata
)
SELECT
  CAST(id AS TEXT),
  user_id,
  title,
  description,
  created_at,
  updated_at,
  input_prompt,
  generated_code,
  agent_id,
  workspace_id,
  status,
  COALESCE(metadata, '{}'::jsonb)
FROM code_generation_sessions
WHERE id IS NOT NULL;

-- Step 3: Drop old table and rename new one
DROP TABLE code_generation_sessions;
ALTER TABLE code_generation_sessions_new RENAME TO code_generation_sessions;

-- Step 4: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_user_id
ON code_generation_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_updated_at
ON code_generation_sessions(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_workspace_id
ON code_generation_sessions(workspace_id);

-- ============================================
-- PART 2: Add is_active column to project_files
-- ============================================

-- Add is_active column if it doesn't exist
ALTER TABLE project_files
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_project_files_is_active
ON project_files(is_active);

-- Update existing records to be active
UPDATE project_files SET is_active = true WHERE is_active IS NULL;

-- ============================================
-- PART 3: Verify changes
-- ============================================

-- Log successful migration
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 2012 completed successfully';
  RAISE NOTICE '✅ code_generation_sessions.id changed from INTEGER to TEXT';
  RAISE NOTICE '✅ project_files.is_active column added';
END $$;

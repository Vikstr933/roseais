-- ============================================================
-- RUN THIS IN SUPABASE SQL EDITOR (Version without FK constraints)
-- ============================================================
-- This will create the missing code_generation_sessions table
-- WITHOUT foreign key constraints (since referenced tables don't exist)
-- ============================================================

-- 1. Create code_generation_sessions table with TEXT id (NO foreign keys)
CREATE TABLE IF NOT EXISTS code_generation_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL DEFAULT 'Untitled Session',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  input_prompt TEXT,
  generated_code TEXT,
  agent_id TEXT,
  workspace_id INTEGER,
  status TEXT DEFAULT 'completed',
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_user_id
ON code_generation_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_updated_at
ON code_generation_sessions(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_workspace_id
ON code_generation_sessions(workspace_id);

-- 3. Add is_active column to project_files (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_files') THEN
    ALTER TABLE project_files ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    CREATE INDEX IF NOT EXISTS idx_project_files_is_active ON project_files(is_active);
    UPDATE project_files SET is_active = true WHERE is_active IS NULL;
    RAISE NOTICE '✅ Updated project_files table';
  ELSE
    RAISE NOTICE '⚠️  project_files table does not exist, skipping';
  END IF;
END $$;

-- Done!
SELECT '✅ Migration completed successfully!' as status;

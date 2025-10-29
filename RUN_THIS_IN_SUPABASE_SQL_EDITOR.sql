-- ============================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================
-- This will create the missing code_generation_sessions table
-- and add the is_active column to project_files
-- ============================================================

-- 1. Create code_generation_sessions table with TEXT id
CREATE TABLE IF NOT EXISTS code_generation_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
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

-- 3. Add is_active column to project_files
ALTER TABLE project_files
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 4. Create index on project_files.is_active
CREATE INDEX IF NOT EXISTS idx_project_files_is_active
ON project_files(is_active);

-- 5. Update existing records
UPDATE project_files SET is_active = true WHERE is_active IS NULL;

-- Done!
SELECT '✅ Migration completed successfully!' as status;

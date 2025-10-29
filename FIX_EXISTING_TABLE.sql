-- ============================================================
-- FIX EXISTING code_generation_sessions TABLE
-- ============================================================
-- This will DROP the old table and recreate it with correct schema
-- ============================================================

-- OPTION 1: Drop and recreate (safest if table is empty)
DROP TABLE IF EXISTS code_generation_sessions CASCADE;

-- Recreate with correct schema (TEXT id, not INTEGER)
CREATE TABLE code_generation_sessions (
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

-- Create indexes
CREATE INDEX idx_code_generation_sessions_user_id ON code_generation_sessions(user_id);
CREATE INDEX idx_code_generation_sessions_updated_at ON code_generation_sessions(updated_at DESC);
CREATE INDEX idx_code_generation_sessions_workspace_id ON code_generation_sessions(workspace_id);

-- Verify the table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'code_generation_sessions'
ORDER BY ordinal_position;

SELECT '✅ Table recreated with TEXT id column!' as status;

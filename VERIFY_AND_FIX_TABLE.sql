-- ============================================================
-- STEP 1: Check current table structure
-- ============================================================
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'code_generation_sessions'
ORDER BY ordinal_position;

-- ============================================================
-- STEP 2: Drop and recreate with correct schema
-- ============================================================

-- Drop the table (this removes the bad schema)
DROP TABLE IF EXISTS code_generation_sessions CASCADE;

-- Recreate with TEXT id
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

-- ============================================================
-- STEP 3: Verify it's fixed
-- ============================================================
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'code_generation_sessions'
AND column_name = 'id';

-- Should show: id | text | NO

SELECT '✅ TABLE FIXED! id column is now TEXT' as result;

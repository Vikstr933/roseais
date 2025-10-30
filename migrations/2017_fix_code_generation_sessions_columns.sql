-- Fix code_generation_sessions table schema
-- Add missing columns that exist in code but not in database

-- Add status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_generation_sessions'
    AND column_name = 'status'
  ) THEN
    ALTER TABLE code_generation_sessions
    ADD COLUMN status TEXT DEFAULT 'completed';
  END IF;
END $$;

-- Add metadata column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_generation_sessions'
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE code_generation_sessions
    ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Remove completed_at column if it exists (not in schema definition)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_generation_sessions'
    AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE code_generation_sessions
    DROP COLUMN completed_at;
  END IF;
END $$;

-- Update existing rows to have default values
UPDATE code_generation_sessions
SET status = 'completed'
WHERE status IS NULL;

UPDATE code_generation_sessions
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_status
  ON code_generation_sessions(status);

CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_workspace_id
  ON code_generation_sessions(workspace_id);

CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_user_id
  ON code_generation_sessions(user_id);

-- Add userId to code_generation_sessions for proper user-based session management
-- First drop if exists with wrong type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_generation_sessions'
    AND column_name = 'user_id'
    AND data_type != 'text'
  ) THEN
    ALTER TABLE code_generation_sessions DROP COLUMN user_id;
  END IF;
END $$;

ALTER TABLE code_generation_sessions
ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- Add metadata column for storing session state (files, chat history, etc.)
ALTER TABLE code_generation_sessions
ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

-- Create index for faster user session queries
CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_user_id
ON code_generation_sessions(user_id);

-- Create index for faster date-based queries
CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_updated_at
ON code_generation_sessions(updated_at DESC);

-- Backfill user_id from workspaces if possible
UPDATE code_generation_sessions cgs
SET user_id = w.owner_id
FROM workspaces w
WHERE cgs.workspace_id = w.id AND cgs.user_id IS NULL;

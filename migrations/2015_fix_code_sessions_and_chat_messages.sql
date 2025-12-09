-- ==================================================================
-- FIX CODE GENERATION SESSIONS AND CHAT MESSAGES SCHEMA
-- Addresses missing completed_at column and session_id reference
-- ==================================================================

-- Add completedAt to code_generation_sessions if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_generation_sessions' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE code_generation_sessions ADD COLUMN completed_at TIMESTAMP;
    RAISE NOTICE 'Added completed_at column to code_generation_sessions';
  END IF;
END $$;

-- Add session_id to chat_messages for proper relationship
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN session_id TEXT;
    RAISE NOTICE 'Added session_id column to chat_messages';
  END IF;
END $$;

-- Create index on session_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);

-- Also ensure project_id column exists (for backward compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'project_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'projectId'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN project_id INTEGER;
    RAISE NOTICE 'Added project_id column to chat_messages';
  END IF;
END $$;

SELECT '✅ Code generation sessions and chat messages schema fixed!' AS status;

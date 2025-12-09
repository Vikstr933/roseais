-- Fix schema mismatches after database migration
-- Run this in Supabase SQL Editor

-- 1. Add is_active column to project_files if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_files' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE project_files ADD COLUMN is_active BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added is_active column to project_files';
  ELSE
    RAISE NOTICE 'is_active column already exists in project_files';
  END IF;
END $$;

-- 2. Fix code_generation_sessions.id to be TEXT instead of INTEGER
-- This is more complex since we need to recreate the table

-- First, check if id is already TEXT
DO $$
DECLARE
  id_type text;
BEGIN
  SELECT data_type INTO id_type
  FROM information_schema.columns
  WHERE table_name = 'code_generation_sessions' AND column_name = 'id';

  IF id_type = 'integer' THEN
    RAISE NOTICE 'Migrating code_generation_sessions.id from INTEGER to TEXT';

    -- Drop foreign key constraints that reference this table
    ALTER TABLE IF EXISTS project_files DROP CONSTRAINT IF EXISTS project_files_session_id_fkey;
    ALTER TABLE IF EXISTS chat_messages DROP CONSTRAINT IF EXISTS chat_messages_session_id_fkey;

    -- Create backup table with TEXT id
    CREATE TABLE code_generation_sessions_new (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL DEFAULT 'Untitled Session',
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      input_prompt TEXT,
      generated_code TEXT,
      agent_id TEXT,
      workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending',
      metadata JSONB DEFAULT '{}'::jsonb
    );

    -- Copy existing data (convert INTEGER ids to TEXT)
    INSERT INTO code_generation_sessions_new
    SELECT
      id::TEXT,
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
      metadata
    FROM code_generation_sessions;

    -- Drop old table
    DROP TABLE code_generation_sessions CASCADE;

    -- Rename new table
    ALTER TABLE code_generation_sessions_new RENAME TO code_generation_sessions;

    -- Recreate indexes
    CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_user_id ON code_generation_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_updated_at ON code_generation_sessions(updated_at);
    CREATE INDEX IF NOT EXISTS idx_code_gen_sessions_workspace ON code_generation_sessions(workspace_id);

    RAISE NOTICE 'Successfully migrated code_generation_sessions.id to TEXT';
  ELSE
    RAISE NOTICE 'code_generation_sessions.id is already TEXT type';
  END IF;
END $$;

-- 3. Update project_files if it has a session_id column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_files' AND column_name = 'session_id'
  ) THEN
    -- Change session_id to TEXT if it's not already
    ALTER TABLE project_files ALTER COLUMN session_id TYPE TEXT;
    RAISE NOTICE 'Updated project_files.session_id to TEXT';
  END IF;
END $$;

-- 4. Update chat_messages if it has a session_id column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'session_id'
  ) THEN
    -- Change session_id to TEXT if it's not already
    ALTER TABLE chat_messages ALTER COLUMN session_id TYPE TEXT;
    RAISE NOTICE 'Updated chat_messages.session_id to TEXT';
  END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Schema migration completed successfully';
  RAISE NOTICE 'Fixed:';
  RAISE NOTICE '  - Added is_active column to project_files';
  RAISE NOTICE '  - Changed code_generation_sessions.id from INTEGER to TEXT';
  RAISE NOTICE '  - Updated related foreign key columns';
END $$;

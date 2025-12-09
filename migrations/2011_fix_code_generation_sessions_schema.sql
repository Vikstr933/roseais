-- Fix code_generation_sessions schema to match expected schema
-- This migration renames and adds missing columns

-- Rename user_prompt to input_prompt
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'code_generation_sessions' 
    AND column_name = 'user_prompt'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'code_generation_sessions' 
    AND column_name = 'input_prompt'
  ) THEN
    ALTER TABLE code_generation_sessions 
    RENAME COLUMN user_prompt TO input_prompt;
    
    RAISE NOTICE 'Renamed user_prompt to input_prompt';
  END IF;
END $$;

-- Add agent_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'code_generation_sessions' 
    AND column_name = 'agent_id'
  ) THEN
    ALTER TABLE code_generation_sessions 
    ADD COLUMN agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL;
    
    RAISE NOTICE 'Added agent_id column to code_generation_sessions';
  END IF;
END $$;

-- Make sure generated_code is NOT NULL if it isn't already
DO $$ 
BEGIN
  -- First update any NULL values to empty string
  UPDATE code_generation_sessions 
  SET generated_code = '' 
  WHERE generated_code IS NULL;
  
  -- Then set NOT NULL constraint if column is nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'code_generation_sessions' 
    AND column_name = 'generated_code'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE code_generation_sessions 
    ALTER COLUMN generated_code SET NOT NULL;
    
    RAISE NOTICE 'Set generated_code to NOT NULL';
  END IF;
END $$;

-- Verify the updated table structure
DO $$
BEGIN
  RAISE NOTICE 'Updated code_generation_sessions columns:';
END $$;

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'code_generation_sessions'
ORDER BY ordinal_position;


-- Add missing columns to code_generation_sessions table
-- This migration adds columns that were missing from the initial table creation

-- Add title column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'code_generation_sessions' 
    AND column_name = 'title'
  ) THEN
    ALTER TABLE code_generation_sessions 
    ADD COLUMN title TEXT;
    
    -- Update existing rows with a default title
    UPDATE code_generation_sessions 
    SET title = 'Code Generation Session ' || id 
    WHERE title IS NULL;
    
    -- Make the column NOT NULL after setting default values
    ALTER TABLE code_generation_sessions 
    ALTER COLUMN title SET NOT NULL;
    
    RAISE NOTICE 'Added title column to code_generation_sessions';
  END IF;
END $$;

-- Add description column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'code_generation_sessions' 
    AND column_name = 'description'
  ) THEN
    ALTER TABLE code_generation_sessions 
    ADD COLUMN description TEXT;
    
    RAISE NOTICE 'Added description column to code_generation_sessions';
  END IF;
END $$;

-- Add updated_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'code_generation_sessions' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE code_generation_sessions 
    ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    
    -- Update existing rows with created_at value
    UPDATE code_generation_sessions 
    SET updated_at = created_at 
    WHERE updated_at IS NULL;
    
    -- Make the column NOT NULL after setting default values
    ALTER TABLE code_generation_sessions 
    ALTER COLUMN updated_at SET NOT NULL;
    
    RAISE NOTICE 'Added updated_at column to code_generation_sessions';
  END IF;
END $$;

-- Verify the table structure
DO $$
BEGIN
  RAISE NOTICE 'Current code_generation_sessions columns:';
END $$;

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'code_generation_sessions'
ORDER BY ordinal_position;


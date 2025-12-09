-- Add missing columns to project_members table
-- This migration adds the is_active column

-- Add is_active column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_members' 
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE project_members 
    ADD COLUMN is_active BOOLEAN DEFAULT true;
    
    -- Update existing rows to be active by default
    UPDATE project_members 
    SET is_active = true 
    WHERE is_active IS NULL;
    
    -- Make the column NOT NULL after setting default values
    ALTER TABLE project_members 
    ALTER COLUMN is_active SET NOT NULL;
    
    RAISE NOTICE 'Added is_active column to project_members';
  END IF;
END $$;

-- Verify the table structure
DO $$
BEGIN
  RAISE NOTICE 'Current project_members columns:';
END $$;

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'project_members'
ORDER BY ordinal_position;


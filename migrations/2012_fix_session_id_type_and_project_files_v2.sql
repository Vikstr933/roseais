-- Migration: Fix session ID type and add missing columns (v2 - Safer approach)
-- Date: 2025-10-29
-- Description:
--   1. Change code_generation_sessions.id from INTEGER to TEXT (using ALTER COLUMN)
--   2. Add is_active column to project_files table

-- ============================================
-- PART 1: Fix code_generation_sessions.id type
-- ============================================

-- Change id column type from INTEGER to TEXT
-- This will automatically convert existing integer IDs to text
ALTER TABLE code_generation_sessions
ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- ============================================
-- PART 2: Add is_active column to project_files
-- ============================================

-- Add is_active column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_files'
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE project_files ADD COLUMN is_active BOOLEAN DEFAULT true;
    RAISE NOTICE '✅ Added is_active column to project_files';
  ELSE
    RAISE NOTICE '⚠️  Column is_active already exists in project_files';
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_project_files_is_active
ON project_files(is_active);

-- Update existing records to be active
UPDATE project_files SET is_active = true WHERE is_active IS NULL;

-- ============================================
-- Verify changes
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 2012 v2 completed successfully';
  RAISE NOTICE '✅ code_generation_sessions.id changed from INTEGER to TEXT';
  RAISE NOTICE '✅ project_files.is_active column verified/added';
END $$;

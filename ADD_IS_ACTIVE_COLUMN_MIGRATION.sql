-- Migration: Add is_active column to project_members table
-- Date: 2025-10-31
-- Purpose: Fix workspace creation and loading errors

-- Add is_active column with default value 1 (active)
ALTER TABLE project_members
ADD COLUMN IF NOT EXISTS is_active INTEGER NOT NULL DEFAULT 1;

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'project_members' AND column_name IN ('permissions', 'is_active');

-- Expected result:
-- permissions | text    | '{}'::text
-- is_active   | integer | 1

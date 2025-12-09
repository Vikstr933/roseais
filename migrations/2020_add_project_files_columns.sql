-- Migration: Add missing columns to project_files table
-- Date: 2025-01-02
-- Description: Adds fileType, createdBy, lastModifiedBy, version columns and unique constraint

-- Add new columns to project_files table
ALTER TABLE project_files
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_modified_by TEXT REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Add unique constraint to prevent duplicate files in same project
-- Drop existing constraint if it exists (in case migration is re-run)
ALTER TABLE project_files
DROP CONSTRAINT IF EXISTS project_files_project_id_file_path_unique;

-- Create unique constraint
ALTER TABLE project_files
ADD CONSTRAINT project_files_project_id_file_path_unique
UNIQUE (project_id, file_path);

-- Update existing rows to set version = 1 if NULL
UPDATE project_files
SET version = 1
WHERE version IS NULL;

-- Create index on created_by for faster queries
CREATE INDEX IF NOT EXISTS idx_project_files_created_by ON project_files(created_by);

-- Create index on project_id and file_path for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_files_project_path ON project_files(project_id, file_path);

-- Log migration completion
SELECT 'Migration 2020_add_project_files_columns.sql completed successfully' AS status;

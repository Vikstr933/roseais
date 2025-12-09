-- Migration: Create project_members table in PostgreSQL
-- Run this in Supabase SQL Editor or via psql

-- Drop table if it exists with wrong schema (optional - remove if you want to keep existing data)
-- DROP TABLE IF EXISTS project_members CASCADE;

-- Create project_members table
CREATE TABLE IF NOT EXISTS project_members (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  permissions JSONB DEFAULT '{}',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT unique_project_user UNIQUE (project_id, user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
-- Note: Partial index for is_active removed to avoid type conflicts

-- Add comment to table
COMMENT ON TABLE project_members IS 'Tracks users who are members of projects/workspaces';

-- Verify table was created
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'project_members'
ORDER BY ordinal_position;

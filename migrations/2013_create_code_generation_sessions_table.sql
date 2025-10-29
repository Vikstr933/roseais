-- Migration: Create code_generation_sessions table with correct schema
-- Date: 2025-10-29
-- Description: Create the missing code_generation_sessions table with TEXT id

-- Create code_generation_sessions table
CREATE TABLE IF NOT EXISTS code_generation_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  input_prompt TEXT,
  generated_code TEXT,
  agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'completed',
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_user_id
ON code_generation_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_updated_at
ON code_generation_sessions(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_workspace_id
ON code_generation_sessions(workspace_id);

CREATE INDEX IF NOT EXISTS idx_code_generation_sessions_status
ON code_generation_sessions(status);

-- Add is_active column to project_files if missing
ALTER TABLE project_files
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create index for project_files.is_active
CREATE INDEX IF NOT EXISTS idx_project_files_is_active
ON project_files(is_active);

-- Update existing project_files records
UPDATE project_files SET is_active = true WHERE is_active IS NULL;

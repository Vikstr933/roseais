-- ==================================================================
-- CREATE MISSING PROJECT TABLES (if they don't exist)
-- Run this in Supabase SQL Editor if project_chat_messages or project_activities don't exist
-- ==================================================================

-- Project Chat Messages Table
-- Stores chat messages specific to projects (separate from general chat_messages)
CREATE TABLE IF NOT EXISTS project_chat_messages (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  message_type VARCHAR(50),
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  edited_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_project_chat_messages_project_id ON project_chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_chat_messages_user_id ON project_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_project_chat_messages_created_at ON project_chat_messages(created_at DESC);

-- Project Activities Table
-- Tracks user activities within projects (file changes, deployments, etc.)
CREATE TABLE IF NOT EXISTS project_activities (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_project_activities_project_id ON project_activities(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activities_user_id ON project_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_project_activities_created_at ON project_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_activities_activity_type ON project_activities(activity_type);

-- ==================================================================
-- VERIFICATION QUERIES (run these to check if tables exist)
-- ==================================================================

-- Check if project_chat_messages exists
-- SELECT EXISTS (
--   SELECT FROM information_schema.tables 
--   WHERE table_schema = 'public' 
--   AND table_name = 'project_chat_messages'
-- );

-- Check if project_activities exists
-- SELECT EXISTS (
--   SELECT FROM information_schema.tables 
--   WHERE table_schema = 'public' 
--   AND table_name = 'project_activities'
-- );


-- Migration: Fix Critical Schema Mismatches for PostgreSQL
-- Description: Add missing columns and tables that are causing 500 errors

-- Fix agents table - add missing columns
DO $$
BEGIN
    -- Add description column to agents table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'agents' AND column_name = 'description') THEN
        ALTER TABLE agents ADD COLUMN description TEXT;
    END IF;

    -- Add role column to agents table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'agents' AND column_name = 'role') THEN
        ALTER TABLE agents ADD COLUMN role TEXT DEFAULT 'assistant';
    END IF;

    -- Add custom_instructions column to agents table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'agents' AND column_name = 'custom_instructions') THEN
        ALTER TABLE agents ADD COLUMN custom_instructions TEXT;
    END IF;

    -- Add capabilities column to agents table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'agents' AND column_name = 'capabilities') THEN
        ALTER TABLE agents ADD COLUMN capabilities JSONB DEFAULT '[]';
    END IF;

    -- Add expertise column to agents table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'agents' AND column_name = 'expertise') THEN
        ALTER TABLE agents ADD COLUMN expertise JSONB DEFAULT '[]';
    END IF;

    -- Add frameworks column to agents table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'agents' AND column_name = 'frameworks') THEN
        ALTER TABLE agents ADD COLUMN frameworks JSONB DEFAULT '[]';
    END IF;

    -- Add libraries column to agents table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'agents' AND column_name = 'libraries') THEN
        ALTER TABLE agents ADD COLUMN libraries JSONB DEFAULT '[]';
    END IF;

    -- Add best_practices column to agents table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'agents' AND column_name = 'best_practices') THEN
        ALTER TABLE agents ADD COLUMN best_practices JSONB DEFAULT '[]';
    END IF;
END $$;

-- Create project_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS project_members (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'collaborator', -- owner, admin, editor, viewer
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    permissions JSONB DEFAULT '{}', -- JSON for specific permissions
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (project_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(project_id, user_id)
);

-- Create project_chat_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS project_chat_messages (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    message_type TEXT DEFAULT 'text', -- text, system, file_share, code_share
    metadata JSONB DEFAULT '{}', -- JSON for additional data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (project_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create project_activities table if it doesn't exist
CREATE TABLE IF NOT EXISTS project_activities (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    activity_type TEXT NOT NULL, -- file_added, file_modified, agent_used, chat_message, etc.
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}', -- JSON for additional data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (project_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Update workspaces table to add missing collaboration columns
DO $$
BEGIN
    -- Add owner_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'workspaces' AND column_name = 'owner_id') THEN
        ALTER TABLE workspaces ADD COLUMN owner_id TEXT;
    END IF;

    -- Add project_type column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'workspaces' AND column_name = 'project_type') THEN
        ALTER TABLE workspaces ADD COLUMN project_type TEXT DEFAULT 'web_app';
    END IF;

    -- Add project_status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'workspaces' AND column_name = 'project_status') THEN
        ALTER TABLE workspaces ADD COLUMN project_status TEXT DEFAULT 'active';
    END IF;

    -- Add invite_code column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'workspaces' AND column_name = 'invite_code') THEN
        ALTER TABLE workspaces ADD COLUMN invite_code TEXT UNIQUE;
    END IF;

    -- Add settings column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'workspaces' AND column_name = 'settings') THEN
        ALTER TABLE workspaces ADD COLUMN settings JSONB DEFAULT '{}';
    END IF;

    -- Add last_activity column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'workspaces' AND column_name = 'last_activity') THEN
        ALTER TABLE workspaces ADD COLUMN last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_chat_messages_project_id ON project_chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_chat_messages_created_at ON project_chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_project_activities_project_id ON project_activities(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activities_created_at ON project_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_invite_code ON workspaces(invite_code);

-- Update any existing agents to have proper default values
UPDATE agents SET
    description = name || ' - AI Assistant'
WHERE description IS NULL;

UPDATE agents SET
    role = 'assistant'
WHERE role IS NULL;

-- Generate invite codes for existing workspaces that don't have them
UPDATE workspaces SET
    invite_code = SUBSTR(MD5(RANDOM()::TEXT), 1, 10)
WHERE invite_code IS NULL;
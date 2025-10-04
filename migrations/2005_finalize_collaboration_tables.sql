-- Migration: Finalize Collaboration Tables
-- Description: Add remaining columns and create collaboration tables

-- Add remaining columns to workspaces table (only if they don't exist)
ALTER TABLE workspaces ADD COLUMN invite_code TEXT;
ALTER TABLE workspaces ADD COLUMN settings TEXT DEFAULT '{}';
ALTER TABLE workspaces ADD COLUMN last_activity TEXT DEFAULT 'CURRENT_TIMESTAMP';

-- Create unique index for invite_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_invite_code ON workspaces(invite_code);

-- Create project_members table for collaboration
CREATE TABLE IF NOT EXISTS project_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'collaborator', -- owner, collaborator, viewer
    joined_at TEXT NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
    permissions TEXT DEFAULT '{}', -- JSON for specific permissions
    is_active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (project_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(project_id, user_id)
);

-- Create project_chat_messages table
CREATE TABLE IF NOT EXISTS project_chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    message_type TEXT DEFAULT 'text', -- text, system, file_share, code_share
    metadata TEXT DEFAULT '{}', -- JSON for additional data
    created_at TEXT NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
    is_edited INTEGER DEFAULT 0,
    edited_at TEXT,
    FOREIGN KEY (project_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create project_activities table for tracking changes
CREATE TABLE IF NOT EXISTS project_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    activity_type TEXT NOT NULL, -- file_added, file_modified, agent_used, chat_message, etc.
    description TEXT NOT NULL,
    metadata TEXT DEFAULT '{}', -- JSON for additional data
    created_at TEXT NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
    FOREIGN KEY (project_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create project_files table for file management
CREATE TABLE IF NOT EXISTS project_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_content TEXT,
    file_type TEXT, -- component, style, config, etc.
    created_by TEXT NOT NULL,
    last_modified_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
    updated_at TEXT NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
    version INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (project_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (last_modified_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_chat_messages_project_id ON project_chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_chat_messages_created_at ON project_chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_project_activities_project_id ON project_activities(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activities_created_at ON project_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);

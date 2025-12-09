-- Migration: Add generation locks table
-- Purpose: Prevent multiple users from generating content simultaneously on the same project

CREATE TABLE IF NOT EXISTS generation_locks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    lock_type TEXT NOT NULL, -- 'component_generation', 'agent_generation', 'code_generation'
    session_id TEXT, -- Optional session identifier
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL, -- When the lock should expire
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'failed', 'expired'
    metadata TEXT DEFAULT '{}', -- JSON metadata about the generation
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (project_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Ensure only one active lock per project per type
    UNIQUE(project_id, lock_type, status) ON CONFLICT REPLACE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_generation_locks_project_id ON generation_locks(project_id);
CREATE INDEX IF NOT EXISTS idx_generation_locks_user_id ON generation_locks(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_locks_status ON generation_locks(status);
CREATE INDEX IF NOT EXISTS idx_generation_locks_expires_at ON generation_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_generation_locks_type_status ON generation_locks(lock_type, status);

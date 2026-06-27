CREATE TABLE IF NOT EXISTS preview_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  preview_url TEXT,
  build_dir TEXT,
  entry_path TEXT,
  source_hash TEXT,
  logs JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  last_accessed_at TIMESTAMP,
  CONSTRAINT preview_sessions_status_check
    CHECK (status IN ('queued', 'building', 'ready', 'failed', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_preview_sessions_user_id
  ON preview_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_preview_sessions_project_id
  ON preview_sessions(project_id);

CREATE INDEX IF NOT EXISTS idx_preview_sessions_status
  ON preview_sessions(status);

CREATE INDEX IF NOT EXISTS idx_preview_sessions_expires_at
  ON preview_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_preview_sessions_source_hash
  ON preview_sessions(source_hash);

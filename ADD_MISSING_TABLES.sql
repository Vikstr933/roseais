-- Add missing critical tables for authentication and workspace features

-- 1. Create sessions table (CRITICAL for login)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- 2. Create generation_locks table (for concurrent editing)
CREATE TABLE IF NOT EXISTS generation_locks (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  lock_type TEXT NOT NULL,
  session_id TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_generation_locks_project_id ON generation_locks(project_id);
CREATE INDEX IF NOT EXISTS idx_generation_locks_user_id ON generation_locks(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_locks_status ON generation_locks(status);
CREATE INDEX IF NOT EXISTS idx_generation_locks_expires_at ON generation_locks(expires_at);

SELECT '✅ Sessions and generation_locks tables created!' as status;

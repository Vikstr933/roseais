-- Create resume_creation_sessions table for CV creation via conversation
CREATE TABLE IF NOT EXISTS resume_creation_sessions (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  UNIQUE(user_id, session_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_resume_creation_sessions_user_session ON resume_creation_sessions(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_resume_creation_sessions_expires_at ON resume_creation_sessions(expires_at);

-- Add comment
COMMENT ON TABLE resume_creation_sessions IS 'Stores state for CV creation conversations. Sessions expire after 24 hours of inactivity.';


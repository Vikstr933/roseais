-- ==================================================================
-- COMPLETE DATABASE SCHEMA - PART 2: DEPENDENT TABLES
-- Run this AFTER Part 1
-- ==================================================================

-- ==================================================================
-- AGENTS TABLE (AI agents for code generation)
-- ==================================================================

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  model TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  temperature REAL DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4096,
  tools JSONB DEFAULT '[]'::jsonb,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_agents_created_by ON agents(created_by);
CREATE INDEX IF NOT EXISTS idx_agents_is_active ON agents(is_active);

-- ==================================================================
-- PROJECT FILES TABLE (Files within workspaces)
-- ==================================================================

CREATE TABLE IF NOT EXISTS project_files (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_is_active ON project_files(is_active);

-- ==================================================================
-- CHAT MESSAGES TABLE (Chat history for workspaces)
-- ==================================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  role TEXT NOT NULL,  -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_project_id ON chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- ==================================================================
-- GENERATION LOCKS TABLE (Prevent concurrent generations)
-- ==================================================================

CREATE TABLE IF NOT EXISTS generation_locks (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lock_type TEXT NOT NULL,  -- 'component_generation', 'agent_generation', 'code_generation'
  session_id TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'active',  -- 'active', 'completed', 'failed', 'expired'
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generation_locks_project_id ON generation_locks(project_id);
CREATE INDEX IF NOT EXISTS idx_generation_locks_user_id ON generation_locks(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_locks_status ON generation_locks(status);

-- ==================================================================
-- CODE GENERATION SESSIONS TABLE (History of code generation)
-- ==================================================================

CREATE TABLE IF NOT EXISTS code_generation_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  input_prompt TEXT NOT NULL,
  generated_code TEXT NOT NULL,
  agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'completed',  -- 'pending', 'in_progress', 'completed', 'failed'
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_code_gen_sessions_user_id ON code_generation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_code_gen_sessions_workspace_id ON code_generation_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_code_gen_sessions_updated_at ON code_generation_sessions(updated_at);

-- ==================================================================
-- API KEYS TABLE (User API keys for external services)
-- ==================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

SELECT 'Part 2 Complete: Dependent tables created successfully!' AS status;

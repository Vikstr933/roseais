-- Migration: Add Performance Indexes
-- Date: 2025-11-03
-- Description: Adds critical indexes to improve query performance across high-traffic tables
--              Part of Phase 2: Performance Optimizations

-- ============================================================================
-- WORKSPACE INDEXES
-- ============================================================================

-- Index for workspace ownership queries (frequently filtered by owner)
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id
ON workspaces(owner_id);

-- Index for workspace status and dates (for dashboard queries)
CREATE INDEX IF NOT EXISTS idx_workspaces_created_at
ON workspaces(created_at DESC);

-- ============================================================================
-- PROJECT MEMBERS INDEXES
-- ============================================================================

-- Composite index for membership checks (project access validation)
-- This eliminates table scans when checking "is user X a member of project Y?"
CREATE INDEX IF NOT EXISTS idx_project_members_project_user
ON project_members(project_id, user_id);

-- Reverse index for "find all projects for user X"
CREATE INDEX IF NOT EXISTS idx_project_members_user_project
ON project_members(user_id, project_id);

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_project_members_role
ON project_members(role);

-- ============================================================================
-- CHAT MESSAGES INDEXES
-- ============================================================================

-- Critical index for message pagination in projects
-- Ordered DESC for recent-first queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_project_created
ON chat_messages(project_id, created_at DESC);

-- Index for user's message history
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
ON chat_messages(user_id, created_at DESC);

-- Index for role-based filtering (user vs assistant messages)
CREATE INDEX IF NOT EXISTS idx_chat_messages_role
ON chat_messages(role);

-- ============================================================================
-- CODE GENERATION SESSIONS INDEXES
-- ============================================================================

-- Index for user's code generation sessions
CREATE INDEX IF NOT EXISTS idx_code_sessions_user_created
ON code_generation_sessions(user_id, created_at DESC);

-- Index for workspace-based session lookup (code_generation_sessions uses workspace_id, not project_id)
CREATE INDEX IF NOT EXISTS idx_code_sessions_workspace_created
ON code_generation_sessions(workspace_id, created_at DESC);

-- Index for status filtering (active, completed, failed)
CREATE INDEX IF NOT EXISTS idx_code_sessions_status
ON code_generation_sessions(status);

-- ============================================================================
-- USER GENERATED PLUGINS INDEXES
-- ============================================================================

-- Composite index for user's plugin listings filtered by status
CREATE INDEX IF NOT EXISTS idx_user_plugins_user_status
ON user_generated_plugins(user_id, status);

-- Index for plugin name searches
CREATE INDEX IF NOT EXISTS idx_user_plugins_name
ON user_generated_plugins(name);

-- Index for plugin creation date (for sorting)
CREATE INDEX IF NOT EXISTS idx_user_plugins_created
ON user_generated_plugins(created_at DESC);

-- ============================================================================
-- PLUGIN EXECUTION LOGS INDEXES
-- ============================================================================

-- Critical index for plugin execution history (recent executions) - uses created_at, not executed_at
CREATE INDEX IF NOT EXISTS idx_plugin_logs_plugin_created
ON plugin_execution_logs(plugin_id, created_at DESC);

-- Index for user's execution history
CREATE INDEX IF NOT EXISTS idx_plugin_logs_user_created
ON plugin_execution_logs(user_id, created_at DESC);

-- Index for status filtering (status column, not success boolean)
CREATE INDEX IF NOT EXISTS idx_plugin_logs_status
ON plugin_execution_logs(status);

-- ============================================================================
-- SESSIONS INDEXES
-- ============================================================================

-- Composite index for session cleanup and validation
-- Used to find expired sessions for cleanup jobs
CREATE INDEX IF NOT EXISTS idx_sessions_user_expires
ON sessions(user_id, expires_at);

-- Note: sessions.id is already the primary key (session token), so no additional index needed

-- ============================================================================
-- PROJECT FILES INDEXES
-- ============================================================================

-- Index for project file listings
CREATE INDEX IF NOT EXISTS idx_project_files_project_path
ON project_files(project_id, file_path);

-- Index for file updates (version control)
CREATE INDEX IF NOT EXISTS idx_project_files_updated
ON project_files(updated_at DESC);

-- ============================================================================
-- AGENTS INDEXES
-- ============================================================================

-- Index for active agent queries
CREATE INDEX IF NOT EXISTS idx_agents_is_active
ON agents(is_active);

-- Index for agent type filtering (column is 'type', not 'agent_type')
CREATE INDEX IF NOT EXISTS idx_agents_type
ON agents(type);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Log completion
SELECT 'Migration 2022_add_performance_indexes.sql completed successfully' AS status;

-- Display created indexes count
SELECT
  COUNT(*) AS total_indexes_created,
  'Performance optimization indexes added' AS message
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%';

-- Migration: Add User Isolation to Agents Table
-- CRITICAL SECURITY FIX: Prevent users from seeing each other's agents
-- Date: 2025-11-04

-- Add user_id and is_system columns to agents table
ALTER TABLE agents ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE agents ADD COLUMN is_system INTEGER DEFAULT 0; -- 1 = system agent (visible to all), 0 = user agent

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_is_system ON agents(is_system);

-- Mark existing agents as system agents (visible to all users)
-- These are the default agents that came with the system
UPDATE agents SET is_system = 1 WHERE user_id IS NULL;

COMMENT ON COLUMN agents.user_id IS 'Owner of this agent - NULL for system agents';
COMMENT ON COLUMN agents.is_system IS '1 = system agent (visible to all), 0 = user agent (visible only to owner)';

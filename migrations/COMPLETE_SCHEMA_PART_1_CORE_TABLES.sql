-- ==================================================================
-- COMPLETE DATABASE SCHEMA - PART 1: CORE TABLES
-- Run this first in Supabase SQL Editor
-- ==================================================================

-- Drop existing tables if you want a clean slate (CAREFUL - this deletes data!)
-- Uncomment the lines below ONLY if you want to start fresh
-- DROP TABLE IF EXISTS plugin_sync_logs CASCADE;
-- DROP TABLE IF EXISTS plugin_actions CASCADE;
-- DROP TABLE IF EXISTS plugin_knowledge CASCADE;
-- DROP TABLE IF EXISTS plugin_configs CASCADE;
-- DROP TABLE IF EXISTS event_logs CASCADE;
-- DROP TABLE IF EXISTS usage_tracking CASCADE;
-- DROP TABLE IF EXISTS rate_limits CASCADE;
-- DROP TABLE IF EXISTS api_keys CASCADE;
-- DROP TABLE IF EXISTS code_generation_sessions CASCADE;
-- DROP TABLE IF EXISTS generation_locks CASCADE;
-- DROP TABLE IF EXISTS chat_messages CASCADE;
-- DROP TABLE IF EXISTS project_files CASCADE;
-- DROP TABLE IF EXISTS agents CASCADE;
-- DROP TABLE IF EXISTS sessions CASCADE;
-- DROP TABLE IF EXISTS workspaces CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TABLE IF EXISTS frameworks CASCADE;
-- DROP TABLE IF EXISTS companies CASCADE;
-- DROP TABLE IF EXISTS ai_models CASCADE;

-- ==================================================================
-- REFERENCE TABLES (No dependencies)
-- ==================================================================

-- AI Models Table
CREATE TABLE IF NOT EXISTS ai_models (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  creator TEXT NOT NULL,
  description TEXT NOT NULL,
  capabilities JSONB NOT NULL,
  release_date TEXT NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  documentation_url TEXT,
  parameters JSONB NOT NULL
);

-- Companies Table
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  founded TEXT NOT NULL,
  website TEXT NOT NULL,
  logo_url TEXT,
  products JSONB NOT NULL
);

-- Frameworks Table
CREATE TABLE IF NOT EXISTS frameworks (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  language TEXT NOT NULL,
  github_url TEXT,
  documentation TEXT,
  features JSONB NOT NULL
);

-- ==================================================================
-- USERS TABLE (Core authentication table)
-- ==================================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,  -- UUID as text
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password TEXT,  -- For password changes
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  preferences JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  role TEXT DEFAULT 'user',  -- user, admin, superadmin
  tier TEXT DEFAULT 'free',  -- free, pro, enterprise
  stripe_customer_id TEXT,
  subscription_status TEXT DEFAULT 'inactive',
  subscription_id TEXT,
  trial_ends_at TIMESTAMP,
  -- Profile fields
  avatar_url TEXT,
  -- Company information
  company_name TEXT,
  vat_number TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'US',
  phone TEXT,
  website TEXT
);

-- Create indexes on users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users(updated_at);

-- ==================================================================
-- SESSIONS TABLE (User authentication sessions)
-- ==================================================================

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ==================================================================
-- WORKSPACES TABLE (Projects/workspaces for users)
-- ==================================================================

CREATE TABLE IF NOT EXISTS workspaces (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  agent_config JSONB DEFAULT '{}'::jsonb,
  test_cases JSONB DEFAULT '[]'::jsonb,
  collaborators JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  project_type TEXT NOT NULL DEFAULT 'web_app',
  project_status TEXT DEFAULT 'active',
  invite_code TEXT UNIQUE,
  settings JSONB DEFAULT '{}'::jsonb,
  last_activity TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);
CREATE INDEX IF NOT EXISTS idx_workspaces_updated_at ON workspaces(updated_at);

SELECT 'Part 1 Complete: Core tables created successfully!' AS status;

-- Migration: Create discord_user_mappings table in PostgreSQL
-- Run this in Supabase SQL Editor or via psql

-- Create discord_user_mappings table
CREATE TABLE IF NOT EXISTS discord_user_mappings (
  id SERIAL PRIMARY KEY,
  discord_user_id TEXT UNIQUE NOT NULL,
  discord_username TEXT,
  system_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verified BOOLEAN DEFAULT false,
  verification_code TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_discord_user UNIQUE (discord_user_id),
  CONSTRAINT unique_system_user UNIQUE (system_user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_discord_user_mappings_discord_user_id ON discord_user_mappings(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_discord_user_mappings_system_user_id ON discord_user_mappings(system_user_id);

-- Add comment to table
COMMENT ON TABLE discord_user_mappings IS 'Links Discord user IDs to system user IDs for project access via Discord bot';

-- Verify table was created
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'discord_user_mappings'
ORDER BY ordinal_position;


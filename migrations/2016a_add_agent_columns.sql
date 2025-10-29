-- ==================================================================
-- STEP 1: Add required columns to agents table
-- Run this FIRST before 2016b
-- ==================================================================

-- Add description column
ALTER TABLE agents ADD COLUMN IF NOT EXISTS description TEXT;

-- Add role column
ALTER TABLE agents ADD COLUMN IF NOT EXISTS role TEXT;

-- Add capabilities column
ALTER TABLE agents ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '{}'::jsonb;

-- Add expertise column
ALTER TABLE agents ADD COLUMN IF NOT EXISTS expertise JSONB DEFAULT '{}'::jsonb;

-- Add frameworks column
ALTER TABLE agents ADD COLUMN IF NOT EXISTS frameworks JSONB DEFAULT '{}'::jsonb;

-- Add libraries column
ALTER TABLE agents ADD COLUMN IF NOT EXISTS libraries JSONB DEFAULT '{}'::jsonb;

-- Add best_practices column
ALTER TABLE agents ADD COLUMN IF NOT EXISTS best_practices JSONB DEFAULT '{}'::jsonb;

-- Add enabled_plugins column
ALTER TABLE agents ADD COLUMN IF NOT EXISTS enabled_plugins JSONB DEFAULT '[]'::jsonb;

SELECT 'Agent columns added successfully! Now run 2016b_insert_improved_agents.sql' AS status;

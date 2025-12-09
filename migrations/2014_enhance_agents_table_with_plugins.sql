-- ==================================================================
-- ENHANCE AGENTS TABLE WITH PLUGIN SUPPORT AND BETTER FIELDS
-- Run this to add Personal Assistant agent and plugin selection
-- ==================================================================

-- Add new columns to agents table for enhanced functionality
DO $$
BEGIN
  -- Add description if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'description'
  ) THEN
    ALTER TABLE agents ADD COLUMN description TEXT;
    RAISE NOTICE 'Added description column';
  END IF;

  -- Add role if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'role'
  ) THEN
    ALTER TABLE agents ADD COLUMN role TEXT;
    RAISE NOTICE 'Added role column';
  END IF;

  -- Add enabled_plugins for plugin/skill selection
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'enabled_plugins'
  ) THEN
    ALTER TABLE agents ADD COLUMN enabled_plugins JSONB DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Added enabled_plugins column';
  END IF;

  -- Add capabilities
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'capabilities'
  ) THEN
    ALTER TABLE agents ADD COLUMN capabilities JSONB DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added capabilities column';
  END IF;

  -- Add expertise
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'expertise'
  ) THEN
    ALTER TABLE agents ADD COLUMN expertise JSONB DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added expertise column';
  END IF;

  -- Add frameworks
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'frameworks'
  ) THEN
    ALTER TABLE agents ADD COLUMN frameworks JSONB DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added frameworks column';
  END IF;

  -- Add libraries
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'libraries'
  ) THEN
    ALTER TABLE agents ADD COLUMN libraries JSONB DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added libraries column';
  END IF;

  -- Add best_practices
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'best_practices'
  ) THEN
    ALTER TABLE agents ADD COLUMN best_practices JSONB DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added best_practices column';
  END IF;

  -- Change system_prompt column name to systemPrompt for consistency
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'system_prompt'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'systemPrompt'
  ) THEN
    ALTER TABLE agents RENAME COLUMN system_prompt TO "systemPrompt";
    RAISE NOTICE 'Renamed system_prompt to systemPrompt';
  END IF;

  -- Ensure max_tokens exists as maxTokens
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'max_tokens'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'maxTokens'
  ) THEN
    ALTER TABLE agents RENAME COLUMN max_tokens TO "maxTokens";
    RAISE NOTICE 'Renamed max_tokens to maxTokens';
  END IF;

  -- Ensure is_active exists as isActive
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'is_active'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'isActive'
  ) THEN
    ALTER TABLE agents RENAME COLUMN is_active TO "isActive";
    RAISE NOTICE 'Renamed is_active to isActive';
  END IF;

  -- Ensure created_by exists as createdBy
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'created_by'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'createdBy'
  ) THEN
    ALTER TABLE agents RENAME COLUMN created_by TO "createdBy";
    RAISE NOTICE 'Renamed created_by to createdBy';
  END IF;

  -- Ensure created_at exists as createdAt
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'created_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'createdAt'
  ) THEN
    ALTER TABLE agents RENAME COLUMN created_at TO "createdAt";
    RAISE NOTICE 'Renamed created_at to createdAt';
  END IF;

  -- Ensure updated_at exists as updatedAt
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'updated_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE agents RENAME COLUMN updated_at TO "updatedAt";
    RAISE NOTICE 'Renamed updated_at to updatedAt';
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
CREATE INDEX IF NOT EXISTS idx_agents_isActive ON agents("isActive");
CREATE INDEX IF NOT EXISTS idx_agents_enabled_plugins ON agents USING gin(enabled_plugins);

SELECT '✅ Agents table enhanced with plugin support!' AS status;

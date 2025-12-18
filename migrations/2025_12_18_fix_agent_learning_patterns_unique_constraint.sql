-- ============================================================================
-- FIX: Add explicit unique constraint for agent_learning_patterns.pattern_name
-- ============================================================================
-- Problem: ON CONFLICT (pattern_name) fails because unique constraint doesn't exist
-- Solution: Add explicit unique constraint/index
-- ============================================================================

-- Drop existing unique constraint if it exists (from column definition)
-- Note: This might fail if constraint doesn't exist, that's okay
DO $$ 
BEGIN
    -- Try to drop the constraint if it exists
    ALTER TABLE agent_learning_patterns 
    DROP CONSTRAINT IF EXISTS agent_learning_patterns_pattern_name_key;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Create explicit unique constraint with a named constraint
-- This ensures ON CONFLICT (pattern_name) works correctly
ALTER TABLE agent_learning_patterns 
ADD CONSTRAINT agent_learning_patterns_pattern_name_unique 
UNIQUE (pattern_name);

-- Alternative: Create unique index if constraint doesn't work
-- (PostgreSQL can use unique indexes for ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_learning_patterns_pattern_name_unique 
ON agent_learning_patterns(pattern_name);

COMMENT ON CONSTRAINT agent_learning_patterns_pattern_name_unique 
ON agent_learning_patterns IS 'Ensures pattern_name is unique for ON CONFLICT clause';

COMMIT;


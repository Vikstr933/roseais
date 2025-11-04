/**
 * PostgreSQL Migration: Add User Isolation to Agents Table
 *
 * This migration adds user_id and is_system fields to the agents table
 * to enable proper user isolation and admin controls.
 *
 * CRITICAL: This migration is REQUIRED for production (PostgreSQL/Supabase)
 * Run this in Supabase SQL Editor
 */

-- Step 1: Add user_id column (nullable initially for data migration)
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- Step 2: Add is_system column (boolean in PostgreSQL, not integer)
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;

-- Step 3: Migrate existing data from created_by to user_id
-- Copy ownership information
UPDATE agents
SET user_id = created_by
WHERE created_by IS NOT NULL
AND user_id IS NULL;

-- Step 4: Mark existing agents without owner as system agents
-- This ensures backward compatibility - existing agents remain visible to all
UPDATE agents
SET is_system = TRUE
WHERE user_id IS NULL;

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_is_system ON agents(is_system);

-- Step 6: Verify migration
-- This query shows the distribution of agents
SELECT
  is_system,
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as unique_owners
FROM agents
GROUP BY is_system;

-- Expected output:
-- is_system | count | unique_owners
-- ----------|-------|---------------
-- true      | N     | 0 (system agents have no owner)
-- false     | M     | X (user agents have owners)

/**
 * ROLLBACK PROCEDURE (if needed):
 *
 * -- Remove indexes
 * DROP INDEX IF EXISTS idx_agents_user_id;
 * DROP INDEX IF EXISTS idx_agents_is_system;
 *
 * -- Remove columns
 * ALTER TABLE agents DROP COLUMN IF EXISTS user_id;
 * ALTER TABLE agents DROP COLUMN IF EXISTS is_system;
 */

/**
 * POST-MIGRATION CHECKLIST:
 *
 * 1. ✓ Run this migration in Supabase SQL Editor
 * 2. ✓ Verify the verification query shows correct distribution
 * 3. ✓ Deploy backend code that uses userId and isSystem fields
 * 4. ✓ Test that users only see system agents + their own agents
 * 5. ✓ Test that admins see all agents
 * 6. ✓ Monitor logs for any errors related to agent queries
 *
 * IMPORTANT: The created_by field is NOT removed for backward compatibility.
 * Future migrations can remove it after confirming user_id works correctly.
 */

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Please verify agent distribution using the SELECT query above.';
  RAISE NOTICE 'Next step: Deploy backend code and test user isolation.';
END $$;

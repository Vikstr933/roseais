-- Targeted Database Migration - Only Add Missing Columns
-- Date: 2025-10-31
-- Apply to: https://supabase.com/dashboard/project/hngwzhlhlaggzzmgcwys/editor

-- =====================================================
-- 1. Fix project_members - Add is_active (THIS IS CRITICAL)
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'project_members' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE project_members ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
        RAISE NOTICE 'Added is_active column to project_members';
    ELSE
        RAISE NOTICE 'Column is_active already exists in project_members';
    END IF;
END $$;

-- =====================================================
-- 2. Fix users table - Add only missing billing columns
-- =====================================================

-- Add subscription_plan (if missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'subscription_plan'
    ) THEN
        ALTER TABLE users ADD COLUMN subscription_plan TEXT DEFAULT 'free';
        UPDATE users SET subscription_plan = COALESCE(tier, 'free') WHERE subscription_plan IS NULL;
        ALTER TABLE users ALTER COLUMN subscription_plan SET NOT NULL;
        RAISE NOTICE 'Added subscription_plan column to users';
    ELSE
        RAISE NOTICE 'Column subscription_plan already exists in users';
    END IF;
END $$;

-- Add credits_remaining (if missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'credits_remaining'
    ) THEN
        ALTER TABLE users ADD COLUMN credits_remaining INTEGER NOT NULL DEFAULT 1000;
        RAISE NOTICE 'Added credits_remaining column to users';
    ELSE
        RAISE NOTICE 'Column credits_remaining already exists in users';
    END IF;
END $$;

-- Add subscription_period_end (if missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'subscription_period_end'
    ) THEN
        ALTER TABLE users ADD COLUMN subscription_period_end TIMESTAMP;
        RAISE NOTICE 'Added subscription_period_end column to users';
    ELSE
        RAISE NOTICE 'Column subscription_period_end already exists in users';
    END IF;
END $$;

-- Add stripe_subscription_id (if missing - different from subscription_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'stripe_subscription_id'
    ) THEN
        ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
        RAISE NOTICE 'Added stripe_subscription_id column to users';
    ELSE
        RAISE NOTICE 'Column stripe_subscription_id already exists in users';
    END IF;
END $$;

-- =====================================================
-- Verification - Show all relevant columns
-- =====================================================
SELECT
    'project_members columns:' as table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'project_members'
  AND column_name IN ('permissions', 'is_active')
ORDER BY column_name;

SELECT
    'users billing columns:' as table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN (
    'stripe_customer_id',
    'stripe_subscription_id',
    'subscription_id',
    'subscription_plan',
    'subscription_status',
    'credits_remaining',
    'subscription_period_end',
    'tier'
  )
ORDER BY column_name;

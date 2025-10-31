-- Simple Database Migration to Fix Critical Issues
-- Date: 2025-10-31
-- Apply to: https://supabase.com/dashboard/project/hngwzhlhlaggzzmgcwys/editor

-- =====================================================
-- 1. Fix project_members table - Add is_active column
-- =====================================================
ALTER TABLE project_members
ADD COLUMN IF NOT EXISTS is_active INTEGER NOT NULL DEFAULT 1;

-- =====================================================
-- 2. Fix users table - Add missing billing columns
-- =====================================================

-- Add subscription_plan column (alias for tier)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS subscription_plan TEXT;

-- Set subscription_plan from tier for existing users
UPDATE users
SET subscription_plan = COALESCE(tier, 'free')
WHERE subscription_plan IS NULL;

-- Make it NOT NULL after setting values
ALTER TABLE users
ALTER COLUMN subscription_plan SET NOT NULL;

ALTER TABLE users
ALTER COLUMN subscription_plan SET DEFAULT 'free';

-- Add credits_remaining column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS credits_remaining INTEGER NOT NULL DEFAULT 1000;

-- Add subscription_period_end column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMP;

-- Add stripe_subscription_id column (different from subscription_id)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- =====================================================
-- Verification
-- =====================================================

-- Check project_members
SELECT 'project_members columns:' as info;
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'project_members'
  AND column_name IN ('permissions', 'is_active')
ORDER BY column_name;

-- Check users billing columns
SELECT 'users billing columns:' as info;
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN (
    'stripe_customer_id',
    'stripe_subscription_id',
    'subscription_id',
    'subscription_plan',
    'subscription_status',
    'credits_remaining',
    'subscription_period_end'
  )
ORDER BY column_name;

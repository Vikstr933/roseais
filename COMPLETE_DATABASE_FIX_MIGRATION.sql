-- Complete Database Migration
-- Date: 2025-10-31
-- Purpose: Fix all missing columns for workspaces, preferences, and billing

-- =====================================================
-- 1. Fix project_members table
-- =====================================================

-- Add is_active column
ALTER TABLE project_members
ADD COLUMN IF NOT EXISTS is_active INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN project_members.is_active IS 'Whether the member is active in the project (1=active, 0=inactive)';

-- =====================================================
-- 2. Fix users table for billing/subscription
-- =====================================================

-- Add missing billing columns
ALTER TABLE users
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS credits_remaining INTEGER DEFAULT 1000;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMP;

-- Rename existing columns to match query expectations
ALTER TABLE users
RENAME COLUMN stripe_customer_id TO stripe_customer_id;

ALTER TABLE users
RENAME COLUMN subscription_id TO stripe_subscription_id;

COMMENT ON COLUMN users.subscription_plan IS 'Subscription plan: free, pro, or enterprise';
COMMENT ON COLUMN users.credits_remaining IS 'Number of API credits remaining';
COMMENT ON COLUMN users.subscription_period_end IS 'When the current subscription period ends';

-- Set default values for existing users
UPDATE users
SET
  subscription_plan = COALESCE(tier, 'free'),
  credits_remaining = COALESCE(credits_remaining, 1000),
  subscription_status = COALESCE(subscription_status, 'inactive')
WHERE subscription_plan IS NULL OR credits_remaining IS NULL;

-- =====================================================
-- Verification Queries
-- =====================================================

-- Verify project_members columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'project_members'
  AND column_name IN ('permissions', 'is_active')
ORDER BY column_name;

-- Verify users billing columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN (
    'stripe_customer_id',
    'stripe_subscription_id',
    'subscription_plan',
    'subscription_status',
    'credits_remaining',
    'subscription_period_end',
    'tier'
  )
ORDER BY column_name;

-- =====================================================
-- Expected Results:
-- =====================================================
-- project_members should have:
--   - permissions (text, default '{}')
--   - is_active (integer, default 1)
--
-- users should have:
--   - stripe_customer_id (text, nullable)
--   - stripe_subscription_id (text, nullable)
--   - subscription_plan (text, default 'free')
--   - subscription_status (text, default 'inactive')
--   - credits_remaining (integer, default 1000)
--   - subscription_period_end (timestamp, nullable)
--   - tier (text, default 'free')

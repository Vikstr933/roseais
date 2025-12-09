-- Add missing role column to users table
-- This migration adds the role column that was missing from the PostgreSQL schema

DO $$
BEGIN
    -- Add role column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'role') THEN
        ALTER TABLE users ADD COLUMN role text DEFAULT 'user';
    END IF;

    -- Update subscription_status default if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'users' AND column_name = 'subscription_status') THEN
        ALTER TABLE users ALTER COLUMN subscription_status SET DEFAULT 'inactive';
    END IF;

    -- Update any existing users that might have NULL role
    UPDATE users SET role = 'user' WHERE role IS NULL;

END $$;
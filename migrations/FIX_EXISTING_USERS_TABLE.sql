-- ==================================================================
-- FIX EXISTING USERS TABLE
-- Run this if you got "column updated_at does not exist" error
-- This adds missing columns to existing users table
-- ==================================================================

-- Add updated_at if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
    RAISE NOTICE 'Added updated_at column to users';
  ELSE
    RAISE NOTICE 'updated_at column already exists';
  END IF;
END $$;

-- Add password if missing (for password changes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'password'
  ) THEN
    -- Check if password_hash exists and copy it
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'password_hash'
    ) THEN
      ALTER TABLE users ADD COLUMN password TEXT;
      UPDATE users SET password = password_hash WHERE password_hash IS NOT NULL;
      RAISE NOTICE 'Added password column and copied from password_hash';
    ELSE
      ALTER TABLE users ADD COLUMN password TEXT;
      RAISE NOTICE 'Added password column';
    END IF;
  ELSE
    RAISE NOTICE 'password column already exists';
  END IF;
END $$;

-- Add avatar_url if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE users ADD COLUMN avatar_url TEXT;
    RAISE NOTICE 'Added avatar_url column';
  ELSE
    RAISE NOTICE 'avatar_url column already exists';
  END IF;
END $$;

-- Add company information columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'company_name') THEN
    ALTER TABLE users ADD COLUMN company_name TEXT;
    RAISE NOTICE 'Added company_name column';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'vat_number') THEN
    ALTER TABLE users ADD COLUMN vat_number TEXT;
    RAISE NOTICE 'Added vat_number column';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'address_line1') THEN
    ALTER TABLE users ADD COLUMN address_line1 TEXT;
    RAISE NOTICE 'Added address_line1 column';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'address_line2') THEN
    ALTER TABLE users ADD COLUMN address_line2 TEXT;
    RAISE NOTICE 'Added address_line2 column';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'city') THEN
    ALTER TABLE users ADD COLUMN city TEXT;
    RAISE NOTICE 'Added city column';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'state') THEN
    ALTER TABLE users ADD COLUMN state TEXT;
    RAISE NOTICE 'Added state column';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'zip_code') THEN
    ALTER TABLE users ADD COLUMN zip_code TEXT;
    RAISE NOTICE 'Added zip_code column';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'country') THEN
    ALTER TABLE users ADD COLUMN country TEXT DEFAULT 'US';
    RAISE NOTICE 'Added country column';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone') THEN
    ALTER TABLE users ADD COLUMN phone TEXT;
    RAISE NOTICE 'Added phone column';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'website') THEN
    ALTER TABLE users ADD COLUMN website TEXT;
    RAISE NOTICE 'Added website column';
  END IF;
END $$;

-- Fix preferences column type if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'preferences' AND data_type != 'jsonb'
  ) THEN
    ALTER TABLE users ALTER COLUMN preferences TYPE jsonb USING preferences::jsonb;
    RAISE NOTICE 'Converted preferences to jsonb type';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'preferences'
  ) THEN
    ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added preferences column';
  ELSE
    RAISE NOTICE 'preferences column is already jsonb';
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users(updated_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

SELECT '✅ Users table fixed successfully! All required columns added.' AS status;

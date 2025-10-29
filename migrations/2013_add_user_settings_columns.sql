-- Add user settings and profile columns to users table
-- Run this after the critical schema migration (2012)

-- Add avatar URL column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE users ADD COLUMN avatar_url TEXT;
    RAISE NOTICE 'Added avatar_url column to users';
  ELSE
    RAISE NOTICE 'avatar_url column already exists in users';
  END IF;
END $$;

-- Add password column (for password changes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'password'
  ) THEN
    -- If password_hash exists, copy it to password, otherwise add empty
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'password_hash'
    ) THEN
      ALTER TABLE users ADD COLUMN password TEXT;
      UPDATE users SET password = password_hash WHERE password_hash IS NOT NULL;
      RAISE NOTICE 'Added password column and copied from password_hash';
    ELSE
      ALTER TABLE users ADD COLUMN password TEXT;
      RAISE NOTICE 'Added password column to users';
    END IF;
  ELSE
    RAISE NOTICE 'password column already exists in users';
  END IF;
END $$;

-- Add company information columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE users ADD COLUMN company_name TEXT;
    RAISE NOTICE 'Added company_name column';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'vat_number'
  ) THEN
    ALTER TABLE users ADD COLUMN vat_number TEXT;
    RAISE NOTICE 'Added vat_number column';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'address_line1'
  ) THEN
    ALTER TABLE users ADD COLUMN address_line1 TEXT;
    RAISE NOTICE 'Added address_line1 column';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'address_line2'
  ) THEN
    ALTER TABLE users ADD COLUMN address_line2 TEXT;
    RAISE NOTICE 'Added address_line2 column';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'city'
  ) THEN
    ALTER TABLE users ADD COLUMN city TEXT;
    RAISE NOTICE 'Added city column';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'state'
  ) THEN
    ALTER TABLE users ADD COLUMN state TEXT;
    RAISE NOTICE 'Added state column';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'zip_code'
  ) THEN
    ALTER TABLE users ADD COLUMN zip_code TEXT;
    RAISE NOTICE 'Added zip_code column';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'country'
  ) THEN
    ALTER TABLE users ADD COLUMN country TEXT DEFAULT 'US';
    RAISE NOTICE 'Added country column';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'phone'
  ) THEN
    ALTER TABLE users ADD COLUMN phone TEXT;
    RAISE NOTICE 'Added phone column';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'website'
  ) THEN
    ALTER TABLE users ADD COLUMN website TEXT;
    RAISE NOTICE 'Added website column';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
    RAISE NOTICE 'Added updated_at column';
  END IF;
END $$;

-- Add index on updated_at for better query performance
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users(updated_at);

-- Update the schema for PostgreSQL to match expectations
DO $$
BEGIN
  -- Ensure preferences column exists and is jsonb
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'preferences' AND data_type != 'jsonb'
  ) THEN
    -- Convert text preferences to jsonb if needed
    ALTER TABLE users ALTER COLUMN preferences TYPE jsonb USING preferences::jsonb;
    RAISE NOTICE 'Converted preferences column to jsonb type';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'preferences'
  ) THEN
    ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added preferences column as jsonb';
  END IF;
END $$;

RAISE NOTICE '✅ User settings columns migration completed successfully';

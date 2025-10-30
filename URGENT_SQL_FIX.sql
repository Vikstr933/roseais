-- URGENT FIX: Add missing updated_at column to users table
-- Run this immediately in Supabase SQL Editor

-- Add the updated_at column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Also add created_at if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add last_login_at if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create a trigger to auto-update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to the users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update any existing rows that have NULL values
UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;
UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;

-- Verify the columns were added
SELECT
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('created_at', 'updated_at', 'last_login_at')
ORDER BY ordinal_position;
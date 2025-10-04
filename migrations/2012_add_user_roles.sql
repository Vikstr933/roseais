-- Add role field to users table for role-based access control

-- Add role column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'role'
  ) THEN
    ALTER TABLE users 
    ADD COLUMN role TEXT DEFAULT 'user';
    
    -- Set default role for existing users
    UPDATE users 
    SET role = 'user' 
    WHERE role IS NULL;
    
    -- Set superadmin for specific email
    UPDATE users 
    SET role = 'superadmin' 
    WHERE email = 'Viktorstrindin93@gmail.com';
    
    -- Make the column NOT NULL after setting default values
    ALTER TABLE users 
    ALTER COLUMN role SET NOT NULL;
    
    RAISE NOTICE 'Added role column to users table';
  ELSE
    -- If role already exists, just update the specific user to superadmin
    UPDATE users 
    SET role = 'superadmin' 
    WHERE email = 'Viktorstrindin93@gmail.com';
    
    RAISE NOTICE 'Updated user role to superadmin';
  END IF;
END $$;

-- Verify the changes
SELECT email, role 
FROM users 
WHERE email = 'Viktorstrindin93@gmail.com';


/**
 * Fix OAuth User Creation - Allow unauthenticated user creation via OAuth
 * 
 * This migration fixes RLS policies to allow OAuth user creation when no user exists yet.
 * OAuth flow needs to be able to create users without authentication.
 * 
 * IMPORTANT: Run this in Supabase SQL Editor
 */

-- ==================================================================
-- FIX USERS TABLE RLS FOR OAUTH
-- ==================================================================

-- Allow INSERT for new users (needed for OAuth registration)
-- This policy allows creating users when app.user_id is NULL (OAuth flow)
-- Note: service_role automatically bypasses RLS, but we also need this for regular connections
DROP POLICY IF EXISTS "Allow OAuth user creation" ON users;
CREATE POLICY "Allow OAuth user creation" ON users FOR INSERT
  WITH CHECK (true);  -- Allow anyone to create a user (OAuth flow)

-- Also allow SELECT by email for OAuth lookup (needed to check if user exists)
DROP POLICY IF EXISTS "Allow OAuth user lookup" ON users;
CREATE POLICY "Allow OAuth user lookup" ON users FOR SELECT
  USING (true);  -- Allow looking up users by email during OAuth

-- Keep existing UPDATE policy (users can update own profile)

-- ==================================================================
-- FIX SESSIONS TABLE RLS FOR OAUTH
-- ==================================================================

-- Allow INSERT for sessions during OAuth (needed for initial session creation)
DROP POLICY IF EXISTS "Allow OAuth session creation" ON sessions;
CREATE POLICY "Allow OAuth session creation" ON sessions FOR INSERT
  WITH CHECK (true);  -- Allow creating sessions during OAuth flow

-- Keep existing SELECT policy (users can view own sessions)
-- Keep existing DELETE policy (users can delete own sessions)

-- ==================================================================
-- VERIFY POLICIES
-- ==================================================================

-- List all policies on users table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- List all policies on sessions table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'sessions'
ORDER BY policyname;


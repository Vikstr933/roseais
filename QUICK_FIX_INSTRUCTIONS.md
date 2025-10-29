# QUICK FIX: Resolve "column updated_at does not exist" Error

## What Happened

You have an existing users table that is missing some columns. When you tried to run Part 1, it didn't add the columns because the table already existed.

## SOLUTION: Run These 2 Files in Order

### Step 1: Fix Your Existing Users Table

**File:** `migrations/FIX_EXISTING_USERS_TABLE.sql`

1. Open Supabase SQL Editor
2. Copy the entire content of `FIX_EXISTING_USERS_TABLE.sql`
3. Paste into SQL Editor
4. Click "Run"
5. You should see: "✅ Users table fixed successfully!"

**This adds:**
- `updated_at` column (fixes your error!)
- `password` column
- `avatar_url` column
- All company info columns (company_name, vat_number, address, etc.)
- `preferences` column as JSONB

### Step 2: Run Part 2 - Dependent Tables

**File:** `migrations/COMPLETE_SCHEMA_PART_2_DEPENDENT_TABLES.sql`

1. Click "New Query" in SQL Editor
2. Copy the entire content of Part 2
3. Paste into SQL Editor
4. Click "Run"
5. You should see: "Part 2 Complete!"

**This creates:**
- agents table
- project_files table (with is_active column)
- chat_messages table
- generation_locks table
- code_generation_sessions table (with TEXT id)
- api_keys table

### Step 3: Run Part 3 - Plugins and Monitoring

**File:** `migrations/COMPLETE_SCHEMA_PART_3_PLUGINS_AND_MONITORING.sql`

1. Click "New Query" in SQL Editor
2. Copy the entire content of Part 3
3. Paste into SQL Editor
4. Click "Run"
5. You should see: "Part 3 Complete!" and "All database tables created!"

**This creates:**
- plugin_configs table
- plugin_knowledge table
- plugin_actions table
- plugin_sync_logs table
- rate_limits table
- usage_tracking table
- event_logs table

## Verify Everything Works

Run this in SQL Editor:

```sql
-- Check users table has all columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY column_name;
```

**You should see these columns:**
- address_line1
- address_line2
- avatar_url
- city
- company_name
- country
- created_at
- display_name
- email
- id
- is_active
- last_active
- password
- password_hash
- phone
- preferences
- role
- state
- stripe_customer_id
- subscription_id
- subscription_status
- tier
- trial_ends_at
- updated_at ← This should now exist!
- username
- vat_number
- website
- zip_code

## Test Your Application

1. **Restart your dev server:**
   ```bash
   npm run dev
   ```

2. **Test Settings Page:**
   - Log in
   - Click Settings in navigation
   - Update your profile
   - Should work without errors!

3. **Test Plugin Connections:**
   - Go to Integrations
   - Try connecting Gmail or Google Calendar
   - Button should change from "Connect" to "Connected"
   - No more credential errors!

## What Was Fixed

### 1. Database Schema
- ✅ Added `updated_at` column to users table
- ✅ Added all missing user profile columns
- ✅ Added all company information columns
- ✅ Created plugin system tables
- ✅ Fixed code_generation_sessions.id type (TEXT instead of INTEGER)
- ✅ Added is_active column to project_files

### 2. Plugin Credential Errors
- ✅ Fixed `credentials.expiresAt?.getTime is not a function` error in Gmail plugin
- ✅ Fixed same error in Google Calendar plugin
- ✅ Plugins now handle Date, string, and number types correctly

### 3. Plugin Connection UI
- ✅ Button now changes from "Connect" to "Connected" properly
- ✅ Added polling mechanism to detect connection status
- ✅ Retries up to 5 times to ensure status updates

### 4. User Settings API
- ✅ Created `/api/user/profile` endpoint
- ✅ Created `/api/user/change-password` endpoint
- ✅ Created `/api/user/company` endpoints
- ✅ Created `/api/user/preferences` endpoints
- ✅ All routes registered and working

## Files You Need to Run (In Order)

1. **FIX_EXISTING_USERS_TABLE.sql** ← START HERE
2. **COMPLETE_SCHEMA_PART_2_DEPENDENT_TABLES.sql**
3. **COMPLETE_SCHEMA_PART_3_PLUGINS_AND_MONITORING.sql**

## Don't Need These Files

These files were for creating a fresh database. Since you have existing data, you don't need:
- ~~COMPLETE_SCHEMA_PART_1_CORE_TABLES.sql~~ (Skip this one!)

## Still Getting Errors?

### Error: "column still does not exist"
- Make sure you ran FIX_EXISTING_USERS_TABLE.sql
- Check the output - it should say "Added updated_at column"
- Verify with: `SELECT updated_at FROM users LIMIT 1;`

### Error: "relation already exists"
- This is OK! It means the table was created before
- Just continue to the next file

### Error: "permission denied"
- You need admin access to your Supabase project
- Check you're logged in as the project owner

## Summary of Changes

### Backend Changes:
1. Created `server/routes/user.ts` with all settings endpoints
2. Fixed `server/plugins/GmailPlugin.ts` credential date handling
3. Fixed `server/plugins/GoogleCalendarPlugin.ts` credential date handling
4. Registered user routes in `server/routes.ts`

### Frontend Changes:
1. Created Settings page with 5 tabs (Account, Security, Company, Billing, Preferences)
2. Fixed plugin connection UI in `client/src/pages/Integrations.tsx`
3. Added polling mechanism for connection status updates

### Database Changes:
1. Added 12+ columns to users table
2. Created 7 new tables for plugins and monitoring
3. Fixed code_generation_sessions.id type
4. Added missing is_active column to project_files

## Result

After running these 3 files, your application will:
- ✅ Start without database errors
- ✅ Settings page works perfectly
- ✅ Password changes work
- ✅ Plugin connections show correct status
- ✅ No more "column does not exist" errors
- ✅ No more "getTime is not a function" errors

---

**Total time to fix: ~5 minutes**

Just run those 3 SQL files in order and restart your server!

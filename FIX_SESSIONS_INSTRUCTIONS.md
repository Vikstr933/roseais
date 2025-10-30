# Fix Sessions Error - Database Migration Instructions

## Problem
The sessions endpoint is failing with error:
```
column "completed_at" does not exist
```

The `code_generation_sessions` table in Supabase is missing columns that exist in the code schema.

## Solution
Run the migration to add missing columns and remove obsolete ones.

## Steps to Fix

### Option 1: Run via Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard/project/hngwzhlhlaggzzmgcwys
   - Click on "SQL Editor" in the left sidebar

2. **Run the Migration**
   - Click "New Query"
   - Copy the entire contents of `migrations/2017_fix_code_generation_sessions_columns.sql`
   - Paste into the query editor
   - Click "Run" button

3. **Verify the Fix**
   - The query should complete successfully
   - Your sessions endpoint should now work
   - Refresh your app and check the Sessions tab

### Option 2: Using psql (Advanced)

If you have psql installed and want to run from command line:

```bash
# Get your Supabase connection string from:
# https://supabase.com/dashboard/project/hngwzhlhlaggzzmgcwys/settings/database

psql "your-connection-string-here" -f migrations/2017_fix_code_generation_sessions_columns.sql
```

## What This Migration Does

1. **Adds missing columns**:
   - `status` (TEXT, default: 'completed')
   - `metadata` (JSONB, default: '{}')

2. **Removes obsolete columns**:
   - `completed_at` (not in schema definition)

3. **Updates existing data**:
   - Sets default values for NULL rows

4. **Creates performance indexes**:
   - Index on `status` for filtering
   - Index on `workspace_id` for joins
   - Index on `user_id` for user-specific queries

## After Running

✅ Sessions tab will load without errors
✅ You can view all generated code sessions
✅ Workspace sessions will display correctly

## Need Help?

If you encounter any errors:
1. Check the Supabase logs for detailed error messages
2. Verify you're connected to the correct database
3. Make sure you have permissions to ALTER TABLE

# Database Migrations Required - Complete Fix Instructions

## Problems Fixed

### 1. Database Schema Issues
```
column "completed_at" does not exist
```

The `code_generation_sessions` table in Supabase is missing columns that exist in the code schema.

### 2. Foreign Key Type Mismatch
```
error: invalid input syntax for type integer: "session-1761849374080-s36isjdjk"
```

The code was using string session IDs to query `chat_messages.project_id` which expects integer workspace IDs.

## Solution
Run TWO migrations in order:
1. Fix code_generation_sessions schema
2. Clean up orphaned chat messages and add 24-hour retention

## Steps to Fix

### Option 1: Run via Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard/project/hngwzhlhlaggzzmgcwys
   - Click on "SQL Editor" in the left sidebar

2. **Run Migration #1: Fix Sessions Schema**
   - Click "New Query"
   - Copy the entire contents of `migrations/2017_fix_code_generation_sessions_columns.sql`
   - Paste into the query editor
   - Click "Run" button
   - Wait for success message

3. **Run Migration #2: Clean Up Chat Messages**
   - Click "New Query" again
   - Copy the entire contents of `migrations/2018_cleanup_orphaned_chat_messages.sql`
   - Paste into the query editor
   - Click "Run" button
   - You should see notice about how many orphaned messages were cleaned

4. **Verify the Fix**
   - Both queries should complete successfully
   - Your sessions endpoint should now work
   - Chat will now auto-delete after 24 hours
   - Refresh your app and test

### Option 2: Using psql (Advanced)

If you have psql installed and want to run from command line:

```bash
# Get your Supabase connection string from:
# https://supabase.com/dashboard/project/hngwzhlhlaggzzmgcwys/settings/database

psql "your-connection-string-here" -f migrations/2017_fix_code_generation_sessions_columns.sql
```

## What These Migrations Do

### Migration #1 (2017_fix_code_generation_sessions_columns.sql):
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

### Migration #2 (2018_cleanup_orphaned_chat_messages.sql):
1. **Cleans up orphaned chat messages**:
   - Removes messages referencing deleted workspaces
   - Prevents foreign key constraint errors

2. **Adds performance index**:
   - Index on `created_at` for efficient 24-hour cleanup

3. **Documents retention policy**:
   - Adds table comment about 24-hour auto-deletion

## What The Code Fix Does

✅ **workspace.ts** - Changed to use `session.workspaceId` (integer) instead of `session.id` (string) when querying chat messages
✅ This fix is already committed to your codebase and will deploy automatically to Render

## After Running the Migration

✅ Sessions tab will load without errors
✅ You can view all generated code sessions
✅ Workspace sessions will display correctly
✅ Chat history will load properly

## Storage Status

✅ **R2 Storage Configured** - Your generated files ARE being saved to Cloudflare R2 cloud storage
- Files persist across deployments
- Scalable and fast access
- Stored at: `{userId}/{componentName}-{timestamp}/`

## Chat Message Retention

✅ **Automatic 24-Hour Cleanup** - Chat messages are now automatically deleted after 24 hours
- Cleanup runs every hour
- Prevents database bloat
- Orphaned messages are cleaned up immediately
- No manual intervention needed

## Need Help?

If you encounter any errors:
1. Check the Supabase logs for detailed error messages
2. Verify you're connected to the correct database
3. Make sure you have permissions to ALTER TABLE

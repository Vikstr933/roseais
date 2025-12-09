# CRITICAL: Database Migration Required

## Status: BLOCKING APPLICATION FUNCTIONALITY

Your application is currently experiencing errors because a critical database migration has not been executed yet.

## Current Errors (Appearing Every 5 Seconds)

```
error: invalid input syntax for type integer: "session-1761732277629-eoah050z9"
error: column project_files.is_active does not exist
```

## What This Means

- Workspace creation is completely broken
- Session management is failing
- The app cannot function properly until this is fixed

## HOW TO FIX (Takes 2 minutes)

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com
2. Navigate to your project
3. Click on "SQL Editor" in the left sidebar

### Step 2: Run the Migration
1. Open the file: `migrations/2012_fix_schema_mismatches.sql`
2. Copy the ENTIRE contents of that file
3. Paste it into the Supabase SQL Editor
4. Click "Run" or press Ctrl+Enter

### Step 3: Verify Success
You should see messages like:
```
NOTICE: Added is_active column to project_files
NOTICE: Successfully migrated code_generation_sessions.id to TEXT
NOTICE: ✅ Schema migration completed successfully
```

### Step 4: Restart Your Application
1. Stop your development server
2. Run `npm run dev` again
3. The errors should be gone!

## What the Migration Does

1. **Fixes code_generation_sessions.id** - Changes from INTEGER to TEXT to support session IDs like "session-1761732277629-eoah050z9"
2. **Adds is_active column** - Adds missing column to project_files table
3. **Preserves existing data** - All your current data will be safely migrated

## Migration File Location

`migrations/2012_fix_schema_mismatches.sql`

## Need Help?

If you encounter any issues:
1. Check that you're logged into the correct Supabase project
2. Verify you have admin permissions
3. Make sure the SQL Editor is using the correct database
4. Check the Supabase logs for any error details

---

**DO THIS FIRST before continuing with any other development work!**

# 🔴 Issue #1: Database Schema Mismatch - FIX GUIDE

**Priority:** 🔴 **CRITICAL - BLOCKING**  
**Status:** ⚠️ **Needs Action**  
**Impact:** Workspace loading fails, project settings inaccessible

---

## Problem

The `project_members` table is missing the `permissions` column, causing workspace-related features to fail.

**Error:**
```
DrizzleQueryError: Failed query
cause: error: column project_members.permissions does not exist
```

**Affected Features:**
- ❌ Cannot load workspace list
- ❌ Cannot enter project settings
- ❌ Workspace features completely blocked

---

## Solution

Run the migration script to add the missing column.

### Option 1: Using Supabase SQL Editor (Recommended)

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com
   - Select your project
   - Click **"SQL Editor"** in the left sidebar

2. **Run the Migration**
   - Open file: `FIX_PROJECT_MEMBERS_PERMISSIONS.sql`
   - Copy ALL content (Ctrl+A, then Ctrl+C)
   - In Supabase SQL Editor, click **"New Query"**
   - Paste the SQL (Ctrl+V)
   - Click **"Run"** button or press Ctrl+Enter

3. **Verify Success**
   You should see output like:
   ```
   NOTICE: Added permissions column to project_members table
   NOTICE: ✅ Project members table migration completed successfully!
   ```

### Option 2: Using psql Command Line

```bash
# Connect to your database
psql "postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres"

# Run the migration
\i FIX_PROJECT_MEMBERS_PERMISSIONS.sql

# Or paste the SQL directly
```

---

## What the Migration Does

1. ✅ Creates `project_members` table if it doesn't exist
2. ✅ Adds `permissions` column (JSONB type) if missing
3. ✅ Adds `is_active` column if missing
4. ✅ Creates indexes for performance
5. ✅ Updates existing rows with default permissions
6. ✅ Verifies table structure

---

## Verification

After running the migration, verify it worked:

```sql
-- Check if permissions column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'project_members' 
AND column_name = 'permissions';

-- Should return:
-- column_name: permissions
-- data_type: jsonb
-- column_default: '{}'::jsonb
```

---

## Testing

After migration:

1. **Restart your dev server:**
   ```powershell
   # Stop server (Ctrl+C)
   npm run dev
   ```

2. **Test workspace loading:**
   - Navigate to `/workspaces`
   - Should load without errors
   - Should show your workspaces list

3. **Test project creation:**
   - Click "New Project"
   - Create a test project
   - Should work without errors

---

## Rollback (If Needed)

If something goes wrong, you can rollback:

```sql
-- Remove permissions column (only if needed)
ALTER TABLE project_members DROP COLUMN IF EXISTS permissions;
```

**Note:** This will lose any permission data, but the table will work.

---

## Next Steps

After fixing this issue:
1. ✅ Test workspace features
2. ✅ Move to Issue #2 (Missing Routes)
3. ✅ Continue with other issues

---

**Status:** Ready to fix  
**Estimated Time:** 2-3 minutes  
**Risk Level:** Low (migration is safe, uses IF NOT EXISTS)


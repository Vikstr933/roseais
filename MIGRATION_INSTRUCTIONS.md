# Database Migration Instructions

## ⚠️ IMPORTANT: Run This Migration Now

Your production database is missing several columns that are causing errors. You **must** run the migration file to fix this.

## Migration File
**File**: `migrations/2025_12_13_fix_missing_columns.sql`

## How to Run

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `migrations/2025_12_13_fix_missing_columns.sql`
5. Paste into the SQL Editor
6. Click **Run** (or press Ctrl+Enter)

### Option 2: Command Line (if you have psql access)
```bash
psql $DATABASE_URL -f migrations/2025_12_13_fix_missing_columns.sql
```

## What This Migration Adds

### Workspaces Table
- ✅ `is_starred` - For starring/favoriting projects
- ✅ `folder_id` - For project organization (with `project_folders` table)
- ✅ `publishing_policy` - For external publishing control

### API Keys Table
- ✅ `configured_by` - Tracks who configured shared connectors
- ✅ `is_shared` - Marks workspace-wide connectors
- ✅ `workspace_id` - Links connectors to workspaces
- ✅ `service_name` - Service identifier (e.g., 'vercel', 'stripe')
- ✅ `key_type` - Type of key ('api_key', 'secret', 'token', 'password')
- ✅ `connector_id` - Links to connector configurations
- ✅ `metadata` - JSONB field for env variables and metadata

## Safety

✅ **Safe to run multiple times** - Uses `IF NOT EXISTS` and `DO $$` blocks
✅ **Won't break existing data** - Only adds columns with defaults
✅ **Idempotent** - Can be run repeatedly without issues

## After Running

Once the migration is complete:
- ✅ All errors about missing columns will be resolved
- ✅ Shared connectors will work properly
- ✅ Project starring will work
- ✅ Publishing policies will work
- ✅ All new features will function correctly

## Verification

After running, you can verify by checking if the columns exist:
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'workspaces' 
AND column_name IN ('is_starred', 'folder_id', 'publishing_policy');
```

All three should return results.

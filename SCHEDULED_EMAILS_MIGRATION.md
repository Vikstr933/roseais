# Scheduled Emails Table Migration

## Problem
The `scheduled_emails` table doesn't exist in the database, causing errors in `EmailSchedulerService`.

## Solution
Run the migration file to create the table.

## Steps

### 1. Open Supabase SQL Editor
Go to: https://supabase.com/dashboard/project/hngwzhlhlaggzzmgcwys/sql

### 2. Run Migration
1. Click **"New Query"**
2. Open file: `migrations/2025_add_scheduled_emails_table.sql`
3. **Copy ALL content** (Ctrl+A, then Ctrl+C)
4. **Paste** into Supabase SQL Editor (Ctrl+V)
5. Click **"Run"** button

### 3. Verify Table Created
Run this query:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'scheduled_emails';
```

You should see `scheduled_emails` in the results.

### 4. Verify Columns
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'scheduled_emails'
ORDER BY ordinal_position;
```

Expected columns:
- `id` (integer, primary key)
- `user_id` (text, references users)
- `to` (text)
- `subject` (text)
- `body` (text)
- `scheduled_for` (timestamp)
- `sent` (boolean, default false)
- `sent_at` (timestamp, nullable)
- `created_at` (timestamp, default now)
- `error` (text, nullable)

## After Migration
The `EmailSchedulerService` will stop showing errors and will be able to:
- Schedule emails for future delivery
- Check for due emails every minute
- Send scheduled emails via Gmail plugin
- Track sent status and errors


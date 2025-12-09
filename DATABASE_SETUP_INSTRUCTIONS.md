# Complete Database Setup Instructions

## Overview

This guide will help you set up your complete database schema in Supabase. The schema has been divided into 3 parts to avoid size limits in the SQL Editor.

## Prerequisites

- Supabase account and project
- Access to Supabase SQL Editor
- **IMPORTANT:** Back up your current database if it contains important data!

## Migration Files (In Order)

1. **COMPLETE_SCHEMA_PART_1_CORE_TABLES.sql** - Core tables (users, workspaces, sessions)
2. **COMPLETE_SCHEMA_PART_2_DEPENDENT_TABLES.sql** - Tables that depend on core tables
3. **COMPLETE_SCHEMA_PART_3_PLUGINS_AND_MONITORING.sql** - Plugin system and monitoring tables

## Step-by-Step Instructions

### Step 1: Access Supabase SQL Editor

1. Go to https://supabase.com
2. Log in to your account
3. Select your project
4. Click **"SQL Editor"** in the left sidebar
5. Click **"New Query"** button

### Step 2: Run Part 1 - Core Tables

1. Open the file: `migrations/COMPLETE_SCHEMA_PART_1_CORE_TABLES.sql`
2. **Select all text** in the file (Ctrl+A or Cmd+A)
3. **Copy** the text (Ctrl+C or Cmd+C)
4. **Paste** into Supabase SQL Editor
5. Click **"Run"** button or press Ctrl+Enter
6. Wait for completion message: "Part 1 Complete: Core tables created successfully!"
7. **Verify success** - you should see no errors

**Tables Created in Part 1:**
- ai_models
- companies
- frameworks
- users (with ALL fields including updated_at, avatar_url, company_name, etc.)
- sessions
- workspaces

### Step 3: Run Part 2 - Dependent Tables

1. Click **"New Query"** in SQL Editor
2. Open the file: `migrations/COMPLETE_SCHEMA_PART_2_DEPENDENT_TABLES.sql`
3. **Select all text** and **copy**
4. **Paste** into Supabase SQL Editor
5. Click **"Run"**
6. Wait for completion message: "Part 2 Complete: Dependent tables created successfully!"

**Tables Created in Part 2:**
- agents
- project_files (with is_active column)
- chat_messages
- generation_locks
- code_generation_sessions (with TEXT id type)
- api_keys

### Step 4: Run Part 3 - Plugins and Monitoring

1. Click **"New Query"** in SQL Editor
2. Open the file: `migrations/COMPLETE_SCHEMA_PART_3_PLUGINS_AND_MONITORING.sql`
3. **Select all text** and **copy**
4. **Paste** into Supabase SQL Editor
5. Click **"Run"**
6. Wait for completion messages:
   - "Part 3 Complete: Plugin and monitoring tables created successfully!"
   - "All database tables created! Your schema is now complete."

**Tables Created in Part 3:**
- rate_limits
- usage_tracking
- event_logs
- plugin_configs
- plugin_knowledge
- plugin_actions
- plugin_sync_logs

### Step 5: Verify Installation

Run this query in SQL Editor to verify all tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**You should see all these tables:**
- agents
- ai_models
- api_keys
- chat_messages
- code_generation_sessions
- companies
- event_logs
- frameworks
- generation_locks
- plugin_actions
- plugin_configs
- plugin_knowledge
- plugin_sync_logs
- project_files
- rate_limits
- sessions
- usage_tracking
- users
- workspaces

### Step 6: Verify Users Table Columns

Run this query to confirm all users table columns exist:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY column_name;
```

**Critical columns that should exist:**
- id (text)
- username (text)
- email (text)
- display_name (text)
- password_hash (text)
- password (text)
- created_at (timestamp)
- updated_at (timestamp) ← This fixes your error!
- avatar_url (text)
- company_name (text)
- vat_number (text)
- address_line1 (text)
- address_line2 (text)
- city (text)
- state (text)
- zip_code (text)
- country (text)
- phone (text)
- website (text)
- preferences (jsonb)
- is_active (boolean)
- role (text)
- tier (text)
- stripe_customer_id (text)
- subscription_status (text)
- subscription_id (text)
- trial_ends_at (timestamp)
- last_active (timestamp)

## Complete Table Structure

### Users Table - Complete Definition
```sql
users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),  ← FIXES YOUR ERROR
  preferences JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  role TEXT DEFAULT 'user',
  tier TEXT DEFAULT 'free',
  stripe_customer_id TEXT,
  subscription_status TEXT DEFAULT 'inactive',
  subscription_id TEXT,
  trial_ends_at TIMESTAMP,
  avatar_url TEXT,
  company_name TEXT,
  vat_number TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'US',
  phone TEXT,
  website TEXT
)
```

## Troubleshooting

### Error: "relation already exists"

This means the table was created before. Options:

**Option A - Skip and Continue** (Safe)
- If you see this error, the table exists - just continue to next part

**Option B - Drop and Recreate** (DANGEROUS - DELETES DATA!)
```sql
DROP TABLE IF EXISTS table_name CASCADE;
-- Then re-run the creation script
```

### Error: "column does not exist"

This means a previous part wasn't run successfully. Solution:
1. Check which part failed
2. Re-run that part
3. Verify with the column check query above

### Error: "permission denied"

You need admin access to your Supabase project:
1. Check you're logged in as the project owner
2. Go to Project Settings > Database
3. Verify you have full access

## Post-Installation Steps

### 1. Restart Your Development Server

```bash
# Stop your server (Ctrl+C)
npm run dev
```

### 2. Test Database Connection

The app should start without database errors now.

### 3. Test Settings Page

1. Log in to your app
2. Click **Settings** in navigation
3. Try updating your profile
4. Should work without "updated_at does not exist" error

### 4. Test Plugin Connections

1. Go to Integrations page
2. Try connecting Gmail or Google Calendar
3. Should work without credential errors

## What This Fixes

### Primary Issues Fixed:
1. ✅ "column updated_at does not exist" error
2. ✅ "column is_active does not exist" error
3. ✅ "invalid input syntax for type integer" error (code_generation_sessions.id)
4. ✅ "credentials.expiresAt?.getTime is not a function" plugin error
5. ✅ Missing user profile columns
6. ✅ Missing company information columns
7. ✅ Complete plugin system tables

### Features Now Working:
- ✅ User settings and profile management
- ✅ Password changes
- ✅ Company information storage
- ✅ User preferences
- ✅ Plugin integrations (Gmail, Calendar)
- ✅ Workspace creation
- ✅ Code generation sessions
- ✅ Usage tracking
- ✅ Rate limiting
- ✅ Event logging

## Alternative: Single Large Script

If you prefer, you can combine all 3 parts into one file and run it. However, Supabase SQL Editor may have size limits.

To create a single file:
```bash
cat COMPLETE_SCHEMA_PART_1_CORE_TABLES.sql \
    COMPLETE_SCHEMA_PART_2_DEPENDENT_TABLES.sql \
    COMPLETE_SCHEMA_PART_3_PLUGINS_AND_MONITORING.sql \
    > COMPLETE_SCHEMA_ALL_IN_ONE.sql
```

Then run that single file in SQL Editor.

## Backup Before Running

**IMPORTANT:** If you have existing data, back it up first:

```sql
-- Example: Export users table
COPY users TO '/tmp/users_backup.csv' CSV HEADER;
```

Or use Supabase Dashboard:
1. Go to Database > Tables
2. Click on each table
3. Export to CSV

## Need Help?

If you encounter issues:

1. **Check the error message** - It usually tells you what's wrong
2. **Verify table exists**: `SELECT * FROM table_name LIMIT 1;`
3. **Check column exists**: Use the column verification query above
4. **Re-run the specific part** that failed
5. **Check Supabase logs** in Dashboard > Logs

## Success Indicators

After running all 3 parts, you should:
- ✅ See 19 tables in your database
- ✅ No errors when starting your app
- ✅ Settings page loads and works
- ✅ Can update profile information
- ✅ Plugins connect without errors
- ✅ Workspaces can be created
- ✅ Code generation works

---

**You're all set!** Your database schema is now complete and ready to use.

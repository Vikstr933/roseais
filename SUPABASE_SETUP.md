# Supabase Setup & Migration Guide

## 🔴 Your Current Issue

Your Supabase project is **PAUSED**. This is normal for free-tier projects after inactivity.

**Error**: `getaddrinfo ENOENT db.hngwzhlhlaggzzmgcwys.supabase.co`

---

## ✅ Solution: Restore Your Supabase Project

### Step 1: Go to Supabase Dashboard

1. **Open**: https://supabase.com/dashboard
2. **Sign in** to your account
3. Find your project: **hngwzhlhlaggzzmgcwys**

### Step 2: Restore the Project

You'll see a message like:
```
⏸️ Project Paused
This project has been paused due to inactivity
```

Click the **"Restore project"** or **"Unpause"** button.

Wait 1-2 minutes for the database to come back online.

### Step 3: Run the Migration

Once restored, run:

```bash
npm run migrate:plugins
```

You should see:

```
🚀 Running Plugin System Migration...

📍 Database: db.hngwzhlhlaggzzmgcwys.supabase.co:5432
🔌 Testing database connection...
✅ Connected successfully at: 2025-10-28T14:30:00.000Z

📖 Reading migration file...
✅ Migration file loaded

⚙️  Executing migration...
   Creating 4 tables:
   • plugin_configs
   • plugin_knowledge
   • plugin_actions
   • plugin_sync_logs

✅ Migration completed successfully!

🔍 Verifying tables...
✅ All 4 plugin tables verified:
   ✓ plugin_actions
   ✓ plugin_configs
   ✓ plugin_knowledge
   ✓ plugin_sync_logs

🎉 Plugin system database setup complete!
```

---

## 🎨 Alternative: Run Migration via Supabase Dashboard

If you prefer to use the Supabase UI:

### Method 1: SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New query"**
5. Copy the contents of `migrations/2010_add_plugin_system_tables.sql`
6. Paste into the editor
7. Click **"Run"**

### Method 2: Table Editor (Manual)

You can also create tables manually in the Table Editor, but the SQL method is faster.

---

## 📊 What the Migration Creates

The migration adds 4 new tables:

### 1. `plugin_configs`
Stores user plugin settings and credentials

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| user_id | varchar(255) | User ID (FK to users) |
| plugin_id | varchar(255) | Plugin identifier (e.g., 'gmail') |
| enabled | boolean | Whether plugin is active |
| credentials | jsonb | OAuth tokens, API keys |
| settings | jsonb | Plugin-specific settings |
| last_sync | timestamp | Last sync time |
| created_at | timestamp | When enabled |
| updated_at | timestamp | Last updated |

### 2. `plugin_knowledge`
Stores synced data from external services

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| user_id | varchar(255) | User ID (FK to users) |
| plugin_id | varchar(255) | Plugin identifier |
| external_id | varchar(255) | ID from external service |
| type | varchar(50) | Type: email, calendar_event, task, etc. |
| title | text | Item title |
| content | text | Item content |
| metadata | jsonb | Additional data (AI analysis, etc.) |
| relevance_score | float | Relevance score (0.0-1.0) |
| timestamp | timestamp | Item timestamp |
| synced_at | timestamp | When synced |

### 3. `plugin_actions`
Logs actions executed through plugins

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| user_id | varchar(255) | User ID (FK to users) |
| plugin_id | varchar(255) | Plugin identifier |
| action_type | varchar(100) | Action name (e.g., 'send_email') |
| parameters | jsonb | Action parameters |
| result | jsonb | Action result |
| status | varchar(50) | Status: pending, success, failed |
| error_message | text | Error if failed |
| created_at | timestamp | When initiated |
| completed_at | timestamp | When completed |

### 4. `plugin_sync_logs`
Tracks synchronization history

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| user_id | varchar(255) | User ID (FK to users) |
| plugin_id | varchar(255) | Plugin identifier |
| sync_type | varchar(50) | Type: full, incremental |
| items_synced | integer | Total items synced |
| items_created | integer | New items |
| items_updated | integer | Updated items |
| items_deleted | integer | Deleted items |
| status | varchar(50) | Status: in_progress, success, failed |
| error_message | text | Error if failed |
| started_at | timestamp | Sync start time |
| completed_at | timestamp | Sync end time |
| duration_ms | integer | Duration in milliseconds |
| metadata | jsonb | Additional sync metadata |

---

## 🔐 Security Notes

### Credential Storage

**Current**: Credentials are stored as plaintext JSONB
**TODO for Production**: Implement AES-256-CBC encryption

See `server/services/PluginRegistry.ts` lines 375-390 for placeholder encryption methods.

### Row Level Security (RLS)

Consider enabling RLS on Supabase:

```sql
-- Enable RLS on plugin tables
ALTER TABLE plugin_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_sync_logs ENABLE ROW LEVEL SECURITY;

-- Create policies (example for plugin_configs)
CREATE POLICY "Users can view their own plugin configs"
  ON plugin_configs FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can modify their own plugin configs"
  ON plugin_configs FOR ALL
  USING (auth.uid()::text = user_id);
```

---

## 🧪 Verify Migration Success

After running the migration, verify with:

```bash
# Check tables exist
psql $DATABASE_URL -c "\dt plugin_*"

# Check table structure
psql $DATABASE_URL -c "\d plugin_configs"

# Count rows (should be 0 initially)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM plugin_configs;"
```

Or use the Supabase dashboard Table Editor to browse the tables.

---

## 🚨 Common Issues

### Issue 1: "relation already exists"

**Cause**: Tables were already created
**Solution**: This is OK! Tables exist, migration successful

If you need to start fresh:
```sql
DROP TABLE IF EXISTS plugin_sync_logs, plugin_actions, plugin_knowledge, plugin_configs CASCADE;
```
Then re-run the migration.

### Issue 2: "permission denied"

**Cause**: Database user lacks CREATE TABLE permission
**Solution**: On Supabase, this shouldn't happen. Check you're using the correct connection string.

### Issue 3: Connection timeout

**Cause**: Project paused or internet issue
**Solution**:
1. Restore project on Supabase dashboard
2. Check internet connection
3. Verify DATABASE_URL in .env

---

## 📈 Next Steps After Migration

Once the migration is complete:

### 1. Restart Your Server

```bash
npm run dev
```

### 2. Verify Plugin System

Check that the plugins endpoint works:
```bash
curl http://localhost:3001/api/plugins
```

Should return:
```json
{
  "success": true,
  "plugins": [
    {
      "id": "gmail",
      "name": "Gmail",
      "description": "Integrate Gmail for email management...",
      "category": "communication",
      "icon": "📧",
      "requiresAuth": true,
      "capabilities": ["read_emails", "send_emails", ...]
    }
  ]
}
```

### 3. Connect Gmail

1. Go to: http://localhost:3000/integrations
2. Click "Connect Gmail"
3. Authorize with Google
4. Watch your emails sync!

### 4. Test Assistant

1. Click the floating assistant widget (bottom-right)
2. Try: "What are my high priority emails?"
3. Watch it query your Gmail plugin!

---

## 🆘 Still Having Issues?

### Check Supabase Connection

```bash
# Test direct connection
psql "postgresql://postgres:D1nm4mm4!123123321@db.hngwzhlhlaggzzmgcwys.supabase.co:5432/postgres" -c "SELECT NOW();"
```

### Check Server Logs

```bash
# Look for errors
tail -f server.log | grep -i plugin

# Or check console output when running dev server
npm run dev
```

### Database Status

Visit: https://supabase.com/dashboard/project/hngwzhlhlaggzzmgcwys/settings/database

Check:
- ✅ Project is **Active** (not paused)
- ✅ Connection pooler is enabled
- ✅ Database size is under limit

---

## 💡 Pro Tips

### Keep Project Active

Supabase pauses projects after 7 days of inactivity (free tier).

To prevent:
- Use the app regularly
- Set up a cron job to ping your API
- Upgrade to Pro tier ($25/month, no pausing)

### Monitor Database Size

Check: https://supabase.com/dashboard/project/hngwzhlhlaggzzmgcwys/settings/database

Email syncing can grow database quickly. Free tier includes:
- 500MB storage
- 2GB bandwidth/month

### Optimize Queries

Add indexes for performance (already included in migration):
```sql
-- Check indexes
SELECT * FROM pg_indexes WHERE tablename LIKE 'plugin_%';
```

---

## ✅ Summary

**Quick Steps**:
1. Go to https://supabase.com/dashboard
2. Find project **hngwzhlhlaggzzmgcwys**
3. Click **"Restore"** or **"Unpause"**
4. Wait 1-2 minutes
5. Run: `npm run migrate:plugins`
6. See success message! 🎉

Then you're ready to use the plugin system!

---

**Need More Help?**

- Supabase Docs: https://supabase.com/docs
- Supabase Support: https://supabase.com/dashboard/support
- Migration File: `migrations/2010_add_plugin_system_tables.sql`

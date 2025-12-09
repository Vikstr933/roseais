# 🚀 Run Plugin Migration via Supabase UI

## Issue: Command Line Connection Not Working

The `npm run migrate:plugins` command is having DNS issues connecting to Supabase. This is common on Windows.

**Solution**: Run the migration directly in the Supabase SQL Editor (easier and more reliable!)

---

## ✅ Step-by-Step Instructions

### Step 1: Open SQL Editor

1. Go to: https://supabase.com/dashboard/project/hngwzhlhlaggzzmgcwys/sql
2. You should see your project's SQL Editor

### Step 2: Open the Migration File

On your computer, open this file:
```
c:\Users\Viktor\Downloads\newai\migrations\2010_add_plugin_system_tables.sql
```

### Step 3: Copy the SQL

Select **ALL** the content (Ctrl+A) and copy it (Ctrl+C)

### Step 4: Paste in Supabase

1. In the Supabase SQL Editor, click **"New query"**
2. Paste the SQL (Ctrl+V)
3. Click **"Run"** button (or press Ctrl+Enter)

### Step 5: Wait for Success

You'll see messages like:
```
CREATE TABLE
CREATE INDEX
CREATE INDEX
...
Success. No rows returned
```

### Step 6: Verify Tables Created

Run this query in a new tab:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('plugin_configs', 'plugin_knowledge', 'plugin_actions', 'plugin_sync_logs')
ORDER BY table_name;
```

You should see 4 rows:
```
plugin_actions
plugin_configs
plugin_knowledge
plugin_sync_logs
```

---

## ✅ Alternative: Quick Copy-Paste

If you can't open the file, here's the full SQL to copy:

```sql
-- Migration: Add Plugin System Tables
-- Description: Add tables for productivity plugin system (Gmail, Calendar, etc.)
-- Date: 2025-10-28

-- Plugin configurations table
CREATE TABLE IF NOT EXISTS plugin_configs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  plugin_id VARCHAR(255) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  credentials JSONB,
  settings JSONB,
  last_sync TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_user_plugin UNIQUE(user_id, plugin_id)
);

CREATE INDEX idx_plugin_configs_user_id ON plugin_configs(user_id);
CREATE INDEX idx_plugin_configs_plugin_id ON plugin_configs(plugin_id);
CREATE INDEX idx_plugin_configs_enabled ON plugin_configs(enabled);

-- Plugin knowledge table
CREATE TABLE IF NOT EXISTS plugin_knowledge (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  plugin_id VARCHAR(255) NOT NULL,
  external_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  metadata JSONB,
  relevance_score FLOAT,
  timestamp TIMESTAMP NOT NULL,
  synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_external_item UNIQUE(user_id, plugin_id, external_id)
);

CREATE INDEX idx_plugin_knowledge_user_id ON plugin_knowledge(user_id);
CREATE INDEX idx_plugin_knowledge_plugin_id ON plugin_knowledge(plugin_id);
CREATE INDEX idx_plugin_knowledge_type ON plugin_knowledge(type);
CREATE INDEX idx_plugin_knowledge_timestamp ON plugin_knowledge(timestamp);
CREATE INDEX idx_plugin_knowledge_synced_at ON plugin_knowledge(synced_at);

-- Plugin actions table
CREATE TABLE IF NOT EXISTS plugin_actions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  plugin_id VARCHAR(255) NOT NULL,
  action_type VARCHAR(100) NOT NULL,
  parameters JSONB,
  result JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_plugin_actions_user_id ON plugin_actions(user_id);
CREATE INDEX idx_plugin_actions_plugin_id ON plugin_actions(plugin_id);
CREATE INDEX idx_plugin_actions_status ON plugin_actions(status);
CREATE INDEX idx_plugin_actions_created_at ON plugin_actions(created_at);

-- Plugin sync logs table
CREATE TABLE IF NOT EXISTS plugin_sync_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  plugin_id VARCHAR(255) NOT NULL,
  sync_type VARCHAR(50) NOT NULL DEFAULT 'incremental',
  items_synced INTEGER NOT NULL DEFAULT 0,
  items_created INTEGER NOT NULL DEFAULT 0,
  items_updated INTEGER NOT NULL DEFAULT 0,
  items_deleted INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
  error_message TEXT,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  metadata JSONB
);

CREATE INDEX idx_plugin_sync_logs_user_id ON plugin_sync_logs(user_id);
CREATE INDEX idx_plugin_sync_logs_plugin_id ON plugin_sync_logs(plugin_id);
CREATE INDEX idx_plugin_sync_logs_status ON plugin_sync_logs(status);
CREATE INDEX idx_plugin_sync_logs_started_at ON plugin_sync_logs(started_at);

-- Add comments
COMMENT ON TABLE plugin_configs IS 'Stores user-specific plugin configurations and credentials';
COMMENT ON TABLE plugin_knowledge IS 'Stores knowledge items synced from external productivity services';
COMMENT ON TABLE plugin_actions IS 'Stores history of actions executed through plugins';
COMMENT ON TABLE plugin_sync_logs IS 'Stores synchronization history and statistics for plugins';
```

---

## 🎉 Success!

After running the SQL, your database now has:
- ✅ 4 new plugin tables
- ✅ All indexes for performance
- ✅ Constraints for data integrity

### Next Steps

1. **Restart your dev server**:
   ```bash
   npm run dev
   ```

2. **Test the plugin API**:
   ```bash
   curl http://localhost:3001/api/plugins
   ```

3. **Go to integrations page**:
   ```
   http://localhost:3000/integrations
   ```

4. **Connect Gmail** and start using the assistant!

---

## 🐛 Troubleshooting

### "relation already exists"

**This means the tables were already created!** ✅

The migration uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times.

### Can't see tables in Supabase

1. Go to: https://supabase.com/dashboard/project/hngwzhlhlaggzzmgcwys/editor
2. Look in the "Tables" section (left sidebar)
3. You should see 4 new tables starting with `plugin_`

### Foreign key errors

The migration doesn't add foreign key constraints to the `users` table (commented out) to avoid issues. The app will still work correctly.

---

## 📊 Verify Migration

After running, check your tables:

```sql
-- List all plugin tables
SELECT * FROM information_schema.tables
WHERE table_name LIKE 'plugin_%';

-- Check indexes
SELECT * FROM pg_indexes
WHERE tablename LIKE 'plugin_%';

-- Count rows (should be 0)
SELECT
  'plugin_configs' as table_name, COUNT(*) as rows FROM plugin_configs
UNION ALL
SELECT 'plugin_knowledge', COUNT(*) FROM plugin_knowledge
UNION ALL
SELECT 'plugin_actions', COUNT(*) FROM plugin_actions
UNION ALL
SELECT 'plugin_sync_logs', COUNT(*) FROM plugin_sync_logs;
```

All counts should be 0 initially (no data yet).

---

**This method is actually EASIER than command line!** 🎉

Once done, proceed to test the system!

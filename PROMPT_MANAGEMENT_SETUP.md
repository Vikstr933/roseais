# 🚀 Prompt Management System Setup

## Overview

Your AI agents now use a **dynamic prompt management system** that allows you to:

- ✅ Update prompts without code deployment
- ✅ Automatically inject coding best practices
- ✅ A/B test different prompt variations
- ✅ Track prompt performance with analytics
- ✅ Version prompts and roll back if needed
- ✅ Customize prompts per user tier (free/pro/enterprise)

## 📋 What Was Implemented

### 1. Database Tables
- **`prompt_templates`** - Stores versioned AI prompts with A/B testing support
- **`coding_guidelines`** - 13 coding best practices (reusable across all agents)
- **`prompt_usage_logs`** - Tracks prompt performance metrics

### 2. PromptManager Service
- Loads prompts from database with caching
- Injects coding guidelines dynamically
- Handles prompt variable substitution
- Logs usage metrics for analytics

### 3. Updated Agents
- **PluginGeneratorAgent** - Both intent analysis & code generation
- **Agent Generator** - Meta-prompt for creating new agents
- All agents have fallback to hardcoded prompts if database is empty

### 4. Pre-Seeded Data
Your migration includes:
- **13 coding guidelines** (already in the SQL)
- **2 prompt templates** for PluginGeneratorAgent
- All your best practices from the requirements

---

## 🎯 IMPORTANT: Run the Migration

The backend is deployed, but the system needs the database tables. Follow these steps:

### Step 1: Open Supabase SQL Editor

Go to: https://supabase.com/dashboard/project/hngwzhlhlaggzzmgcwys/sql

### Step 2: Copy the Migration SQL

Open this file on your computer:
```
c:\Users\Viktor\Downloads\newai\migrations\2023_add_prompt_management_system.sql
```

**Select ALL** (Ctrl+A) and **Copy** (Ctrl+C)

### Step 3: Run in Supabase

1. In Supabase SQL Editor, click **"New query"**
2. **Paste** the SQL (Ctrl+V)
3. Click **"Run"** button (or press Ctrl+Enter)

### Step 4: Wait for Success

You should see messages like:
```
CREATE TABLE
CREATE INDEX
INSERT 0 13  (coding guidelines inserted)
INSERT 0 2   (prompt templates inserted)
CREATE FUNCTION
CREATE TRIGGER
CREATE VIEW
Success. No rows returned
```

### Step 5: Verify Tables Created

Run this query in a new tab:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('prompt_templates', 'coding_guidelines', 'prompt_usage_logs')
ORDER BY table_name;
```

You should see 3 rows:
```
coding_guidelines
prompt_templates
prompt_usage_logs
```

---

## ✅ Verify the Setup

### Check Coding Guidelines

```sql
SELECT name, category, priority
FROM coding_guidelines
WHERE enabled = true
ORDER BY priority DESC
LIMIT 5;
```

You should see your best practices like:
- `clear_directory_structure` (organization, priority 10)
- `descriptive_naming` (organization, priority 10)
- `self_explanatory_code` (readability, priority 9)
- `strong_typing` (typing, priority 9)
- `input_validation` (security, priority 10)

### Check Prompt Templates

```sql
SELECT prompt_key, version, agent_type, status, is_default
FROM prompt_templates
WHERE status = 'active';
```

You should see:
- `plugin_generator.intent_analysis` (v1, active, default)
- `plugin_generator.code_generation` (v1, active, default)

### View Guidelines Included in Prompts

```sql
SELECT * FROM active_prompts LIMIT 1;
```

This shows prompts with their applicable coding guidelines automatically attached!

---

## 🎉 What Happens Next

Once the migration runs:

1. **PluginGeneratorAgent will use database prompts**
   - Your 13 coding guidelines are automatically injected
   - Every Discord/Slack plugin generated will follow best practices
   - No more JSON parsing errors (cleaner prompts)

2. **Agent Generator will use database prompts**
   - When users create agents via "AI Create", guidelines are included
   - All generated agents follow your coding standards

3. **Analytics Start Tracking**
   - Every prompt usage is logged
   - You can see which prompts perform best
   - Track success rates, response times, security scores

4. **You Can Update Prompts Live**
   - No code deployment needed
   - Just update the `prompt_templates` table
   - Changes take effect immediately (5-minute cache)

---

## 📊 Example: Viewing Prompt Analytics

After the system runs for a while:

```sql
-- See most used prompts
SELECT
  pt.prompt_key,
  pt.usage_count,
  pt.avg_response_time_ms,
  pt.success_rate,
  pt.avg_security_score
FROM prompt_templates pt
WHERE pt.status = 'active'
ORDER BY pt.usage_count DESC;

-- See recent usage logs
SELECT
  agent_type,
  success,
  response_time_ms,
  tokens_used,
  created_at
FROM prompt_usage_logs
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🔧 Updating Prompts (Future)

### Option 1: Direct SQL Update

```sql
-- Update the system prompt for intent analysis
UPDATE prompt_templates
SET system_prompt = 'Your improved prompt here...',
    updated_at = NOW()
WHERE prompt_key = 'plugin_generator.intent_analysis'
  AND is_default = true;

-- Clear the cache to apply immediately
-- (Cache auto-expires in 5 minutes anyway)
```

### Option 2: Create New Version (A/B Testing)

```sql
-- Insert a new version to test
INSERT INTO prompt_templates (
  prompt_key,
  version,
  system_prompt,
  agent_type,
  prompt_type,
  status,
  is_default,
  variant_name,
  traffic_percentage
) VALUES (
  'plugin_generator.intent_analysis',
  2,
  'Your experimental prompt here...',
  'plugin_generator',
  'intent_analysis',
  'testing',
  false,
  'variant_a',
  20  -- Send 20% of traffic to this variant
);
```

### Option 3: Admin UI (Future Enhancement)

In the future, you can build an admin UI at `/admin/prompts` to:
- Edit prompts visually
- Compare versions side-by-side
- See analytics dashboards
- A/B test variants with traffic splitting

---

## 🐛 Troubleshooting

### "Relation already exists"
**This is OK!** Tables already created. The migration uses `CREATE TABLE IF NOT EXISTS`.

### Prompts still using fallback
1. Check if migration ran: `SELECT COUNT(*) FROM prompt_templates;` (should be 2+)
2. Check prompt status: `SELECT * FROM prompt_templates WHERE status = 'active';`
3. Check backend logs for "Database prompt not found" warnings

### Want to rollback
The PromptManager has built-in fallbacks. Even if tables don't exist, agents will work with hardcoded prompts.

---

## 📈 Benefits Summary

Before this system:
- ❌ Hardcoded prompts in TypeScript files
- ❌ Required deployment to update prompts
- ❌ No tracking of what works best
- ❌ Coding guidelines not consistently applied
- ❌ JSON parsing errors from markdown blocks

After this system:
- ✅ Database-driven prompts with versioning
- ✅ Live updates without deployment
- ✅ Full analytics on prompt performance
- ✅ **13 coding guidelines automatically injected**
- ✅ Robust fallback system
- ✅ A/B testing support

---

## 🎯 Next Steps

1. **Run the migration now** (Steps above)
2. **Test plugin generation** - Try creating a Discord plugin
3. **Check analytics** - After a few uses, run the analytics queries
4. **Iterate on prompts** - Update prompts based on metrics
5. **(Optional) Build admin UI** - Visual prompt editor

---

## 🔗 Related Files

- Migration: `migrations/2023_add_prompt_management_system.sql`
- PromptManager: `server/services/PromptManager.ts`
- PluginGeneratorAgent: `server/agents/PluginGeneratorAgent.ts`
- Agent Routes: `server/routes/agents.ts`

---

**Questions?** Check the backend logs for any issues with prompt loading. The system is designed to fail gracefully with fallbacks!

🎉 **Your AI is now more robust, maintainable, and follows best practices!**

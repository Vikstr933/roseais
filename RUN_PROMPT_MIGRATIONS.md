# 🚀 Run Prompt Management Migrations

## Step-by-Step Guide

### Step 1: Open Supabase SQL Editor

Go to: **https://supabase.com/dashboard/project/hngwzhlhlaggzzmgcwys/sql**

---

### Step 2: Run Migration 1 - Create Tables

1. Open file: `migrations/2023_prompt_management_SIMPLE.sql`
2. **Copy ALL content** (Ctrl+A, then Ctrl+C)
3. In Supabase SQL Editor, click **"New query"**
4. **Paste** (Ctrl+V)
5. Click **"Run"** button

**Expected Output:**
```
DROP TABLE
DROP TABLE
DROP TABLE
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
INSERT 0 26  ← (26 coding guidelines inserted)
CREATE FUNCTION
CREATE TRIGGER
CREATE TRIGGER
CREATE VIEW
Success. No rows returned
```

---

### Step 3: Verify Tables Created

Run this query in a new tab:

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('prompt_templates', 'coding_guidelines', 'prompt_usage_logs')
ORDER BY table_name;

-- Check coding guidelines count
SELECT COUNT(*) as guideline_count FROM coding_guidelines;
```

**Expected:**
- 3 tables (coding_guidelines, prompt_templates, prompt_usage_logs)
- 26 coding guidelines

---

### Step 4: Run Migration 2 - Add Agent Prompts

1. Open file: `migrations/2024_comprehensive_agent_prompts.sql`
2. **Copy ALL content** (Ctrl+A, then Ctrl+C)
3. In Supabase SQL Editor, click **"New query"**
4. **Paste** (Ctrl+V)
5. Click **"Run"** button

**Expected Output:**
```
INSERT 0 1  ← (Plugin Generator - Intent Analysis)
INSERT 0 1  ← (Plugin Generator - Code Generation)
INSERT 0 1  ← (Code Generator)
INSERT 0 1  ← (Requirements Analyst)
INSERT 0 1  ← (UI Designer)
INSERT 0 1  ← (Agent Generator)
SELECT 1    ← (Success message)
SELECT 1    ← (Total prompts count)
```

---

### Step 5: Verify Prompts Created

Run this query:

```sql
-- View all active prompts
SELECT
  prompt_key,
  version,
  agent_type,
  prompt_type,
  is_default,
  LENGTH(system_prompt) as prompt_length
FROM prompt_templates
WHERE status = 'active'
ORDER BY agent_type, prompt_key;

-- Count prompts by agent type
SELECT
  agent_type,
  COUNT(*) as prompt_count
FROM prompt_templates
WHERE status = 'active'
GROUP BY agent_type;
```

**Expected:**
- 6 total prompts
- plugin_generator: 2 prompts (intent_analysis, code_generation)
- code_generator: 1 prompt
- requirements_analyst: 1 prompt
- ui_designer: 1 prompt
- agent_generator: 1 prompt

---

### Step 6: View a Sample Prompt

```sql
-- See the Code Generator prompt
SELECT
  prompt_key,
  agent_type,
  model,
  temperature,
  max_tokens,
  coding_guidelines,
  LEFT(system_prompt, 500) || '...' as system_prompt_preview
FROM prompt_templates
WHERE prompt_key = 'code_generator.code_generator';
```

---

### Step 7: Test the System

Run this query to see coding guidelines that will be injected:

```sql
-- See coding guidelines for code generation
SELECT
  cg.name,
  cg.category,
  cg.priority,
  cg.guideline
FROM coding_guidelines cg
WHERE cg.enabled = true
  AND (cg.applies_to @> ARRAY['code_generator'] OR cg.applies_to @> ARRAY['*'])
ORDER BY cg.priority DESC, cg.category;
```

---

## ✅ Success Indicators

After both migrations, you should have:

1. ✅ **3 tables created**:
   - `coding_guidelines` (26 guidelines)
   - `prompt_templates` (6 prompts)
   - `prompt_usage_logs` (empty, will fill as system runs)

2. ✅ **26 coding guidelines** covering:
   - Organization & Structure (3 guidelines)
   - Readability & Maintainability (3 guidelines)
   - Scalability & Reusability (3 guidelines)
   - Typing & Validation (2 guidelines)
   - Security & Error Handling (4 guidelines)
   - Performance & Optimization (3 guidelines)
   - Testing & Quality (3 guidelines)
   - Accessibility (2 guidelines)
   - Documentation (2 guidelines)

3. ✅ **6 comprehensive agent prompts**:
   - Plugin Generator (Intent Analysis)
   - Plugin Generator (Code Generation)
   - Code Generator (React Components)
   - Requirements Analyst
   - UI Designer
   - Agent Generator (Meta-Prompt)

---

## 🎯 What Happens Next

Once migrations are complete:

### 1. Automatic Integration
- All agents will automatically try to load prompts from database
- If found, they use database prompts + coding guidelines
- If not found, they fall back to hardcoded prompts
- **No code changes needed!**

### 2. Coding Guidelines Injection
Every agent prompt automatically includes relevant guidelines based on `applies_to` field:
- `*` = applies to all agents
- `code_generator` = only code generation
- `plugin_generator` = only plugin generation

### 3. Analytics Start Tracking
Every prompt usage is logged:
- Response time
- Tokens used
- Success/failure
- Security scores (for plugin generator)

### 4. Live Updates Enabled
Update prompts anytime without deployment:

```sql
-- Example: Update code generator prompt
UPDATE prompt_templates
SET system_prompt = 'Your updated prompt here...',
    updated_at = NOW()
WHERE prompt_key = 'code_generator.code_generator'
  AND is_default = true;
```

Cache clears automatically after 5 minutes.

---

## 📊 Monitor System Performance

After some usage, check analytics:

```sql
-- See most used prompts
SELECT
  pt.prompt_key,
  pt.agent_type,
  pt.usage_count,
  pt.avg_response_time_ms,
  pt.success_rate
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
LIMIT 20;
```

---

## 🔧 Troubleshooting

### "relation already exists"
**Solution:** Tables already created! Skip migration 1, go to migration 2.

### "column does not exist"
**Solution:** Migration 1 didn't complete. Drop tables and rerun:
```sql
DROP TABLE IF EXISTS prompt_usage_logs;
DROP TABLE IF EXISTS prompt_templates;
DROP TABLE IF EXISTS coding_guidelines;
```
Then rerun migration 1.

### "constraint already exists"
**Solution:** Prompt already exists. This is OK - the `ON CONFLICT` clause will skip it.

### Backend still using fallback prompts
**Solution:**
1. Check if prompts exist: `SELECT COUNT(*) FROM prompt_templates WHERE status = 'active';`
2. Check backend logs for "Using database prompt" vs "Using hardcoded prompt"
3. Wait 5 minutes for cache to clear
4. Restart backend if needed

---

## 🎉 You're Done!

Your AI agent system is now running on **dynamic, database-driven prompts** with **comprehensive coding guidelines** automatically injected into every generated piece of code!

**Test it out:**
1. Generate a React component in Playground
2. Create a Discord plugin
3. Create a new agent via AI

Watch for cleaner code, better error handling, and automatic adherence to all 26 coding best practices!

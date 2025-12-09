# 🔍 Complete Prompt Audit & Fix Guide

## 🚨 CRITICAL ISSUE FOUND

### Problem: SQL Script Prepends Instead of Replaces

**File:** `fix-component-developer-syntax-patterns.sql:113`

```sql
system_prompt = '
...new syntax rules...
' || system_prompt,  -- ⚠️ THIS APPENDS OLD PROMPT!
```

**Impact:**
- New syntax rules are at the TOP ✅
- But OLD prompt instructions are still at the BOTTOM ❌
- Old prompt might have conflicting instructions
- AI might be confused by duplicate/conflicting rules
- Prompt is now VERY LONG (14,580+ chars) which might dilute the message

---

## 📋 All Prompt Locations

### 1. Database Prompts (PRIMARY - Used in Production)

#### A. Component-Developer Agent
- **Table:** `agents`
- **ID:** `component-developer`
- **Used By:** `IncrementalOrchestrator.getAgentConfig()`
- **Status:** ⚠️ **NEEDS FIX** - Currently prepends instead of replaces
- **Fix:** Use `fix-component-developer-prompt-REPLACE.sql`

#### B. Component-Architect Agent
- **Table:** `agents`
- **ID:** `component-architect`
- **Used By:** `AnalysisAgent.getAgentConfig()`
- **Status:** ✅ OK (only used for analysis, not code generation)

### 2. Hardcoded Prompts (FALLBACKS ONLY)

#### A. IncrementalOrchestrator.buildPhasePrompt()
- **Location:** `server/services/IncrementalOrchestrator.ts:325-403`
- **Status:** ✅ **HAS SYNTAX RULES**
- **Usage:** Adds to user prompt for each phase
- **Content:** Includes "CRITICAL SYNTAX RULES" section with forbidden patterns

#### B. IncrementalOrchestrator.getDefaultPrompt()
- **Location:** `server/services/IncrementalOrchestrator.ts:787-792`
- **Status:** ⚠️ **MINIMAL FALLBACK** - No syntax rules
- **Usage:** Only if agent not found in database
- **Fix Needed:** Add syntax rules to fallback

#### C. AICodeGenerator.buildHardcodedSystemPrompt()
- **Location:** `server/services/AICodeGenerator.ts:490-600+`
- **Status:** ✅ **HAS SYNTAX RULES** (but not used in production)
- **Usage:** Only if database prompt loading fails
- **Content:** Has "CRITICAL SYNTAX RULES" section

#### D. AICodeGenerator.buildSystemPrompt()
- **Location:** `server/services/AICodeGenerator.ts:331-418`
- **Status:** ⚠️ **LEGACY MODE ONLY** - Not used in incremental generation
- **Usage:** Only when `orchestrated: false`

---

## 🔧 Fixes Required

### Fix #1: Replace Database Prompt (CRITICAL)
**File:** `fix-component-developer-prompt-REPLACE.sql`
**Action:** Run this SQL script in Supabase to REPLACE the entire prompt

**Key Changes:**
- ✅ Removes `|| system_prompt` (no longer appends old prompt)
- ✅ Complete prompt with syntax rules at top
- ✅ Includes comprehensive checklist
- ✅ Clear examples of correct vs wrong code

### Fix #2: Improve Fallback Prompt
**File:** `server/services/IncrementalOrchestrator.ts:787-792`
**Action:** Add syntax rules to `getDefaultPrompt()`

### Fix #3: Strengthen Phase Prompt
**File:** `server/services/IncrementalOrchestrator.ts:325-403`
**Action:** Make syntax rules MORE prominent (move to top, add more examples)

---

## 📊 Prompt Flow (Current)

```
User Request
    ↓
AnalysisAgent (uses component-architect from DB)
    ↓
IncrementalOrchestrator.generateIncrementally()
    ↓
For each phase:
    ├─ buildPhasePrompt() → Adds syntax rules to USER prompt ✅
    ├─ getAgentConfig() → Loads component-developer from DB
    │   └─ Returns: systemPrompt (from DB) ⚠️ MIGHT HAVE OLD CONFLICTING RULES
    └─ AICodeGenerator.generateComponent()
        ├─ Uses: systemPrompt from DB (component-developer)
        ├─ Uses: userPrompt from buildPhasePrompt()
        └─ Sends both to AI
```

**Issue:** System prompt (from DB) is processed FIRST. If it has old conflicting rules, AI might follow those instead of the new rules in the user prompt.

---

## ✅ Verification Steps

1. **Run `inspect-all-prompts.sql`** in Supabase to see current state
2. **Run `fix-component-developer-prompt-REPLACE.sql`** to fix database prompt
3. **Verify** the prompt was replaced (check length, check for old content)
4. **Test** generation to see if errors decrease
5. **Monitor** logs to see if syntax rules are being followed

---

## 🎯 Expected Results After Fix

1. ✅ Database prompt REPLACED (not prepended)
2. ✅ No old conflicting instructions
3. ✅ Syntax rules at the VERY TOP of system prompt
4. ✅ Clear, unambiguous instructions
5. ✅ Fewer `{;` patterns generated
6. ✅ Better AI compliance with syntax rules


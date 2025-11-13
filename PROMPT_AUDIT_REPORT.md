# 🔍 Complete Prompt Audit Report

## Problem Statement
The AI is still generating syntax errors like `{;` and `return {;` despite having syntax rules in prompts. This audit identifies ALL places where prompts are set and where errors might originate.

---

## 1. Database Prompts (Primary Source)

### 1.1 Component-Developer Agent (`component-developer`)
**Location:** `agents` table, `id = 'component-developer'`
**Status:** ⚠️ **CRITICAL ISSUE FOUND**

**Problem:** The SQL script `fix-component-developer-syntax-patterns.sql` is **PREPENDING** new rules instead of **REPLACING** the prompt:

```sql
system_prompt = '
🚨🚨🚨 CRITICAL OUTPUT FORMAT - READ THIS FIRST 🚨🚨🚨
...
' || system_prompt,  -- ⚠️ THIS APPENDS OLD PROMPT!
```

**Impact:** 
- New syntax rules are at the TOP ✅
- But OLD prompt instructions are still at the BOTTOM ❌
- Old prompt might have conflicting instructions
- AI might be confused by duplicate/conflicting rules

**Fix Required:** Replace the entire prompt, not prepend:
```sql
UPDATE agents
SET system_prompt = '...NEW PROMPT...'  -- No || system_prompt!
WHERE id = 'component-developer';
```

### 1.2 Component-Architect Agent (`component-architect`)
**Location:** `agents` table, `id = 'component-architect'`
**Status:** ✅ Used for analysis only (doesn't generate code)

---

## 2. Hardcoded Prompts in Code

### 2.1 IncrementalOrchestrator.buildPhasePrompt()
**Location:** `server/services/IncrementalOrchestrator.ts:325-403`
**Status:** ✅ **HAS SYNTAX RULES**

**Content:**
- ✅ Has "CRITICAL SYNTAX RULES" section
- ✅ Lists FORBIDDEN patterns: `interface Name {;`, `return {;`, etc.
- ✅ Has CRITICAL CHECKLIST with search instructions
- ✅ Position: In user prompt (phase-specific)

**Issue:** This is ADDED to the user prompt, but the system prompt (from database) is what the AI sees first. If database prompt has conflicting instructions, this might be ignored.

### 2.2 AICodeGenerator.buildSystemPrompt()
**Location:** `server/services/AICodeGenerator.ts:331-418`
**Status:** ⚠️ **LEGACY MODE ONLY**

**Usage:** Only used when `orchestrated: false` (legacy mode)
**Current System:** Uses `orchestrated: true`, so this is NOT used ✅

**Content:**
- Has basic syntax rules but less comprehensive
- Not the active prompt path

### 2.3 AICodeGenerator.buildHardcodedSystemPrompt()
**Location:** `server/services/AICodeGenerator.ts:490-600+`
**Status:** ⚠️ **FALLBACK ONLY**

**Usage:** Only used if database prompt loading fails
**Content:**
- Has syntax rules: "CRITICAL SYNTAX RULES - VERIFY ALL CODE"
- Lists forbidden patterns
- Not the primary path (should use database)

### 2.4 IncrementalOrchestrator.getDefaultPrompt()
**Location:** `server/services/IncrementalOrchestrator.ts:787-792`
**Status:** ⚠️ **FALLBACK ONLY**

**Usage:** Only used if agent not found in database
**Content:**
```typescript
"You are an expert code generator. You MUST respond with ONLY a JSON array of files..."
```
**Issue:** ❌ **NO SYNTAX RULES** - This is a minimal fallback

---

## 3. Prompt Flow Analysis

### Current Flow (Incremental Generation):
```
1. User Request
   ↓
2. AnalysisAgent.analyzeAndPlan()
   - Uses: component-architect agent (from database)
   - Creates: GenerationPlan with phases
   ↓
3. IncrementalOrchestrator.generateIncrementally()
   For each phase:
   ↓
4. IncrementalOrchestrator.buildPhasePrompt()
   - Adds: Phase-specific instructions
   - Adds: CRITICAL SYNTAX RULES ✅
   - Adds: Existing files context
   ↓
5. IncrementalOrchestrator.getAgentConfig()
   - Loads: component-developer agent from database
   - Returns: systemPrompt, model, temperature
   ↓
6. AICodeGenerator.generateComponent()
   - Uses: systemPrompt from database (component-developer)
   - Uses: userPrompt from buildPhasePrompt()
   ↓
7. MultiModelAIService.generate()
   - Sends: systemPrompt + userPrompt to AI
   ↓
8. AI Response
   ↓
9. AICodeGenerator.autoFixCommonSyntaxIssues()
   - Fixes: {; patterns, return {; patterns, etc.
   ↓
10. IncrementalOrchestrator.fixPhase()
    - Applies: Additional fixes
```

---

## 4. Root Cause Analysis

### Issue #1: SQL Script Appends Instead of Replaces
**File:** `fix-component-developer-syntax-patterns.sql:113`
```sql
' || system_prompt,  -- ⚠️ WRONG: Appends old prompt
```

**Fix:** Should be:
```sql
WHERE id = 'component-developer';
-- No || system_prompt!
```

### Issue #2: Old Prompt Might Have Conflicting Instructions
If the old prompt had instructions that encouraged semicolons or had examples with `{;`, those would still be present after the prepend.

### Issue #3: Prompt Order Matters
- System prompt is processed FIRST by AI
- User prompt (with syntax rules) is processed SECOND
- If system prompt has conflicting instructions, AI might follow those instead

### Issue #4: Syntax Rules Are Split
- System prompt (database): Has syntax rules ✅
- User prompt (buildPhasePrompt): Also has syntax rules ✅
- But if system prompt has OLD conflicting rules, they might override

---

## 5. Validation Logic

### 5.1 IncrementalOrchestrator.validateSyntax()
**Location:** `server/services/IncrementalOrchestrator.ts:456-508`
**Status:** ✅ Detects `{;` patterns

**Checks:**
- `/\{\s*;/g` - Detects `{;` patterns
- `/return\s*\(;/` - Detects `return (;`
- `/return\s*{;/` - Detects `return {;`
- `/return\s*\[;/` - Detects `return [;`

**Issue:** Only checks for CRITICAL errors, treats imports/TS as warnings ✅

### 5.2 AICodeGenerator.autoFixCommonSyntaxIssues()
**Location:** `server/services/AICodeGenerator.ts:991-1300+`
**Status:** ✅ Has comprehensive fixing logic

**Fixes:**
- Multiple patterns for `{;`
- `return {;`, `return (;`, `return [;`
- Arrow functions: `() => {;`
- Multiple passes to catch all variations

**Issue:** Regex `lastIndex` was causing misses (FIXED ✅)

---

## 6. Recommendations

### Priority 1: Fix Database Prompt (CRITICAL)
1. **Replace** the component-developer prompt entirely (don't prepend)
2. Ensure syntax rules are at the VERY TOP
3. Remove any old conflicting instructions
4. Verify the prompt in database after update

### Priority 2: Strengthen Phase Prompts
1. Make syntax rules MORE prominent in phase prompts
2. Add examples of CORRECT code (not just forbidden patterns)
3. Add a final reminder right before output format section

### Priority 3: Improve Validation
1. Make validation MORE strict for `{;` patterns
2. Fail generation if `{;` patterns are found (don't just warn)
3. Add validation BEFORE fixing (catch issues earlier)

### Priority 4: Enhance Fixer
1. Add more aggressive pattern matching
2. Add validation AFTER fixing to ensure fixes worked
3. Log when fixes fail to help debug

---

## 7. Files to Check

### Database:
- ✅ `agents` table - Check `component-developer` system_prompt
- ✅ Run `inspect-all-prompts.sql` to see current state

### Code:
- ✅ `server/services/IncrementalOrchestrator.ts` - Phase prompts
- ✅ `server/services/AICodeGenerator.ts` - Fallback prompts
- ✅ `server/services/AnalysisAgent.ts` - Analysis prompts

### SQL Scripts:
- ⚠️ `fix-component-developer-syntax-patterns.sql` - **NEEDS FIX** (line 113)

---

## 8. Next Steps

1. **Run `inspect-all-prompts.sql`** in Supabase to see current prompt state
2. **Fix SQL script** to REPLACE instead of PREPEND
3. **Verify** the new prompt is correct in database
4. **Test** generation to see if errors decrease
5. **Monitor** logs to see if syntax rules are being followed


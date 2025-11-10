# Coding Standards & Best Practices

**Last Updated:** 2025-11-04
**Purpose:** Track patterns, standards, and common pitfalls to avoid future production issues

---

## 🚨 Critical Rules - ALWAYS Follow These

### 1. API Calls in Frontend
**❌ NEVER DO THIS:**
```typescript
fetch('/api/endpoint', { ... })
```

**✅ ALWAYS DO THIS:**
```typescript
import { apiFetch } from '@/lib/api';
apiFetch('/api/endpoint', { ... })
```

**Why:** `apiFetch` automatically:
- Routes to correct backend (Render in production, localhost in dev)
- Adds authentication headers from localStorage
- Includes credentials for CORS
- Handles API base URL from `VITE_API_URL`

**Alternative:** If you need just the URL without fetching:
```typescript
import { getApiUrl } from '@/lib/api';
const url = getApiUrl('/api/endpoint');
```

---

### 2. Authentication Headers
**❌ NEVER DO THIS:**
```typescript
fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
  }
})
```

**✅ ALWAYS DO THIS:**
```typescript
import { apiFetch } from '@/lib/api';
apiFetch('/api/endpoint') // Auth header added automatically
```

**Why:** `apiFetch` automatically reads `sessionToken` from localStorage and adds the Authorization header.

---

### 3. CORS Configuration
**Backend (server/index.ts):**
- ✅ ALWAYS apply CORS to ALL routes (including health checks)
- ✅ Allow requests without origin (monitoring services)
- ✅ Use regex patterns for Vercel preview URLs
- ✅ Log blocked origins for debugging

**Frontend:**
- ✅ Set `credentials: 'include'` in all API calls
- ✅ Use `apiFetch` which handles this automatically

---

### 4. WebContainer Configuration (Playground Feature)

**Vercel Configuration (vercel.json):**
WebContainer requires cross-origin isolation to enable SharedArrayBuffer support.

**✅ REQUIRED HEADERS:**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "require-corp"
        }
      ]
    }
  ]
}
```

**Why:** Without these headers:
- SharedArrayBuffer is not available
- WebContainer fails with: `DataCloneError: Failed to execute 'postMessage' on 'Worker'`
- Playground feature cannot boot WebContainer

**Fixed:** Commit `eddb3e5` (2025-11-04)

---

### 5. Environment Variables

**Frontend (Vercel):**
```bash
# .env.production
VITE_API_URL=https://ai-library-backend.onrender.com
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_ANON_KEY=...
```

**CRITICAL:** Must be set in Vercel Dashboard → Settings → Environment Variables
- Not just in `.env.production` file
- Must be set for: Production, Preview, AND Development
- Rebuild required after adding/changing

**Backend (Render):**
```bash
ALLOWED_ORIGINS=https://newai-sigma.vercel.app,https://newai.vercel.app
DATABASE_URL=postgresql://...
SUPABASE_URL=...
# etc.
```

---

### 6. User Authentication & Authorization

**Always return complete user data from auth endpoints:**

**✅ REQUIRED FIELDS:**
```typescript
{
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin' | 'superadmin';  // ← CRITICAL!
  createdAt: string;
  lastActive: string;
  preferences: object;
}
```

**Endpoints that MUST return role:**
- `/api/auth/login` ✅
- `/api/auth/register` ✅
- `/api/auth/oauth` ✅ (FIXED 2025-11-04)
- `/api/auth/me` ✅

---

### 7. Admin Route Protection

**Backend:**
```typescript
import { authenticateUser } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

router.use(authenticateUser);  // ← Authenticate first
router.use(requireAdmin);       // ← Then check role

router.get('/admin/stats', async (req, res) => {
  // Only authenticated admins reach here
});
```

**Frontend:**
```typescript
const { user, isLoading } = useAuth();

// Redirect non-admins
useEffect(() => {
  if (!isLoading && (!user || (user.role !== 'admin' && user.role !== 'superadmin'))) {
    navigate('/');
  }
}, [user, isLoading]);
```

---

### 8. Database Schema Consistency

**PostgreSQL vs SQLite differences:**
- ✅ Use `INTEGER` for boolean-like fields in PostgreSQL (not BOOLEAN)
- ✅ `isSystem: INTEGER` (0 or 1), not BOOLEAN
- ✅ Always test migrations on both databases if dual-support

**PostgreSQL Array Type Casting:**
- ✅ Match array type cast to column type exactly
- ✅ If column is `text[]`, use `::text[]` not `::varchar[]`
- ❌ `ARRAY[value]::varchar[]` on `text[]` column causes: `operator does not exist: text[] @> character varying[]`
- ✅ `ARRAY[value]::text[]` on `text[]` column works correctly

**Example:**
```typescript
// ❌ WRONG - type mismatch
sql`... applies_to @> ARRAY[${val}]::varchar[]`  // Column is text[]

// ✅ CORRECT - types match
sql`... applies_to @> ARRAY[${val}]::text[]`     // Column is text[]
```

**User Isolation:**
- ✅ Every resource should have `userId` field
- ✅ Every system resource should have `isSystem` field
- ✅ Always verify ownership before allowing access

---

### 9. Error Handling Patterns

**Backend:**
```typescript
try {
  // Operation
  res.json({ success: true, data });
} catch (error) {
  logger.error('Operation failed', error);
  res.status(500).json({
    error: 'User-friendly message',
    code: 'ERROR_CODE'
  });
}
```

**Frontend:**
```typescript
try {
  const res = await apiFetch('/api/endpoint');
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Operation failed');
  }
  const data = await res.json();
  // Use data
} catch (err) {
  console.error('Error:', err);
  setError(err instanceof Error ? err.message : 'Unknown error');
}
```

---

### 10. Security Best Practices

**Input Validation:**
- ✅ Validate all user input before using
- ✅ Use Drizzle ORM queries (prevents SQL injection)
- ✅ Never trust client-side validation alone

**Credential Storage:**
- ✅ Always encrypt credentials with CredentialVault
- ✅ Validate encrypted data before decrypting:
  ```typescript
  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new Error('Invalid encrypted data');
  }
  ```

**Session Management:**
- ✅ Store session tokens in localStorage (not cookies for SPA)
- ✅ Set expiration (30 days default)
- ✅ Clean up expired sessions regularly

---

### 11. Component Imports

**✅ ALWAYS use path aliases:**
```typescript
import { apiFetch } from '@/lib/api';          // ✅
import { useAuth } from '@/contexts/AuthContext'; // ✅
import Button from '@/components/ui/button';    // ✅
```

**❌ NEVER use relative imports:**
```typescript
import { apiFetch } from '../../../lib/api';   // ❌
import { useAuth } from '../../contexts/AuthContext'; // ❌
```

**Configured in:** `vite.config.ts` and `tsconfig.json`

---

## 🐛 Common Production Issues & Solutions

### Issue: CORS Errors
**Symptoms:** `Access to fetch... has been blocked by CORS policy`

**Root Causes:**
1. ✅ Backend not applying CORS to all routes
2. ✅ Frontend not using `apiFetch` (sends requests to wrong domain)
3. ✅ `ALLOWED_ORIGINS` not set in Render
4. ✅ Browser cache after CORS fix deployed

**Solutions:**
1. Use `app.use(cors({...}))` for ALL routes in `server/index.ts`
2. Replace all `fetch()` with `apiFetch()` in frontend
3. Set `ALLOWED_ORIGINS` env var in Render dashboard
4. Clear browser cache + hard refresh

---

### Issue: 404 for Admin Routes
**Symptoms:** Admin dashboard shows 404 errors

**Root Causes:**
1. ✅ Frontend using relative URLs instead of `apiFetch`
2. ✅ `VITE_API_URL` not set in Vercel
3. ✅ Routes not mounted in `server/index.ts`

**Solutions:**
1. Use `apiFetch()` instead of `fetch()` in admin pages
2. Set `VITE_API_URL` in Vercel environment variables
3. Rebuild frontend after environment variable changes

---

### Issue: User Role Not Showing
**Symptoms:** Admin sees regular UI, no admin features

**Root Causes:**
1. ✅ OAuth endpoint not returning `role` field
2. ✅ User role not set in database
3. ✅ Frontend not checking `user.role`

**Solutions:**
1. Ensure ALL auth endpoints return complete user object with role
2. Run: `npx tsx scripts/make-superadmin.ts <email>`
3. Check `user.role` in AuthContext and components

---

### Issue: Credential Decryption Errors
**Symptoms:** `TypeError: encryptedData.split is not a function`

**Root Causes:**
1. ✅ Encrypted data stored as object instead of string
2. ✅ No validation before decryption

**Solutions:**
1. Validate input type in `decrypt()` method:
   ```typescript
   if (!encryptedData || typeof encryptedData !== 'string') {
     throw new Error('Invalid encrypted data');
   }
   ```

---

### Issue: JSON Parsing Errors in Plugin Generator
**Symptoms:** `SyntaxError: Unexpected non-whitespace character after JSON`

**Root Causes:**
1. ✅ Claude API returns JSON in various formats (markdown, code blocks, trailing commas)

**Solutions:**
1. Use multi-strategy JSON parser with 6 fallback strategies (already implemented in `PluginGeneratorAgent.ts`)

---

## 📝 Pre-Deployment Checklist

Before deploying ANY changes:

### Backend (Render)
- [ ] All tests pass locally
- [ ] Database migrations tested on both PostgreSQL and SQLite
- [ ] Environment variables set in Render dashboard
- [ ] CORS configuration includes all frontend domains
- [ ] No hardcoded secrets in code

### Frontend (Vercel)
- [ ] `VITE_API_URL` set in Vercel environment variables
- [ ] All API calls use `apiFetch` or `getApiUrl`
- [ ] No `fetch()` calls with relative URLs to API endpoints
- [ ] Build succeeds locally with `npm run build`
- [ ] No console errors in development mode

### Both
- [ ] Git commit pushed to main branch
- [ ] Auto-deploy configured and working
- [ ] Monitor deployment logs for errors
- [ ] Test in incognito/private window after deployment
- [ ] Clear browser cache if CORS or routing changed

---

## 🔍 Quick Debugging Commands

**Check deployed backend version:**
```bash
curl -s https://ai-library-backend.onrender.com/api/health | grep gitCommit
```

**Test CORS from command line:**
```bash
curl -I -H "Origin: https://newai-sigma.vercel.app" https://ai-library-backend.onrender.com/api/health | grep -i access-control
```

**Check if admin route exists:**
```bash
curl -s https://ai-library-backend.onrender.com/api/admin/stats
# Should return: {"error":"Authentication required"}
# NOT: 404 Not Found
```

**Test API URL configuration in browser console:**
```javascript
import { API_BASE_URL } from '@/lib/api';
console.log('API Base URL:', API_BASE_URL);
```

---

## 🔄 When Things Break in Production

1. **Check Render Logs** - See what errors backend is throwing
2. **Check Vercel Logs** - See if frontend build succeeded
3. **Test Backend Health** - `curl https://ai-library-backend.onrender.com/api/health`
4. **Check Environment Variables** - In both Render and Vercel dashboards
5. **Verify Git Commits Match** - Compare commit hashes in dashboards vs local
6. **Clear Browser Cache** - Often the issue after CORS/routing fixes
7. **Test in Incognito** - Eliminates cache and extension issues

---

## 📚 Key Files to Remember

### Frontend
- `client/src/lib/api.ts` - API helpers (apiFetch, getApiUrl)
- `client/src/contexts/AuthContext.tsx` - Authentication state
- `.env.production` - Environment variables (must also be in Vercel dashboard)

### Backend
- `server/index.ts` - Express app, CORS, middleware, route mounting
- `server/middleware/auth.ts` - Authentication middleware
- `server/middleware/admin.ts` - Admin role checking
- `server/routes/oauth.ts` - OAuth callback (must return user.role)
- `server/services/CredentialVault.ts` - Credential encryption/decryption

### Configuration
- `vite.config.ts` - Frontend build config, path aliases, proxy
- `render.yaml` - Render deployment config
- `vercel.json` - Vercel deployment config (SPA routing)

---

## 🎯 Files That Need Fixing (As of 2025-11-04)

### High Priority - API Calls Using fetch() Instead of apiFetch()
1. ✅ `client/src/pages/AdminDashboard.tsx` - FIXED
2. ❌ `client/src/pages/CredentialVault.tsx` - 5 fetch calls
3. ❌ `client/src/pages/PluginGenerator.tsx` - 2 fetch calls
4. ❌ `client/src/components/KnowledgeSelector.tsx` - 1 fetch call
5. ❌ `client/src/components/GitHubKnowledgeManager.tsx` - 1 fetch call
6. ❌ `client/src/components/ChatAutocomplete.tsx` - 1 fetch call
7. ⚠️ `client/src/components/AssistantWidget.tsx` - 1 fetch call (external geocode API, OK)
8. ⚠️ `client/src/pages/Integrations.tsx` - Using getApiUrl, OK
9. ⚠️ `client/src/services/VercelDeploymentService.ts` - External API, OK

---

**Next Steps:**
1. Fix all ❌ files to use apiFetch
2. Test each fix locally
3. Commit and deploy
4. Update this document as patterns evolve

---

## 🔥 CRITICAL BUG FIXED (2025-11-04)

### Issue: Admin Endpoints Returning 403 Even for Superadmins

**Symptoms:**
- User is superadmin in database
- OAuth login succeeds
- Admin endpoints return 403 Forbidden (not 401 Unauthorized)

**Root Cause:**
The `authenticateUser` middleware was not including the `role` field in `req.user`.

**Code Location:** `server/middleware/auth.ts`

**Before (BROKEN):**
```typescript
req.user = {
  id: user.id,
  username: user.username,
  email: user.email,
  displayName: user.displayName,
  tier: user.tier || 'free',
  // ❌ role is MISSING!
};
```

**After (FIXED):**
```typescript
req.user = {
  id: user.id,
  username: user.username,
  email: user.email,
  displayName: user.displayName,
  tier: user.tier || 'free',
  role: user.role || 'user',  // ✅ NOW INCLUDED
};
```

**Why This Broke:**
- The `requireAdmin` middleware checks `req.user.role`
- But `authenticateUser` middleware wasn't setting it
- So `req.user.role` was `undefined`
- Which failed the admin check: `role !== 'admin' && role !== 'superadmin'`
- Resulting in 403 Forbidden

**Fix Applied:** Commit `bfdcb4c`
- Added `role` to TypeScript Request interface
- Added `role` to `req.user` in `authenticateUser`
- Added `role` to `req.user` in `optionalAuth`

**Lesson Learned:**
- ✅ ALWAYS include ALL user fields needed by downstream middleware
- ✅ Check both TypeScript interfaces AND runtime assignments
- ✅ Test admin endpoints after any auth middleware changes

---

## 🔥 CRITICAL: AI Code Generation Syntax Errors (2025-11-09)

### Issue: AI Consistently Generates Invalid Syntax Patterns

**Symptoms:**
- Generated React components fail to compile
- Syntax errors like `return (;`, `return {;`, `return [;`
- Multi-pass syntax fixer detects errors but regex fails to fix them

**Root Causes:**
1. ✅ AI ignores prompt warnings (even with ⚠️ symbols and examples)
2. ✅ Regex patterns fail due to whitespace encoding issues (CRLF vs LF)
3. ✅ Database prompts override hardcoded prompt fixes
4. ✅ No literal string matching as fallback

### Architecture: Prompt Loading Flow

**How the system loads prompts:**
```
CodeGeneratorAgent → PromptBuilder → PromptManager → prompt_templates (database)
                                                    ↓ (fallback)
                                        UltimateAgentPrompts.ts (hardcoded)
```

**Key Insight:** Database prompts ALWAYS override hardcoded prompts!

**File Locations:**
- `server/services/PromptBuilder.ts` - Builds final prompts
- `server/services/PromptManager.ts` - Fetches from database
- `server/prompts/UltimateAgentPrompts.ts` - Fallback prompts
- `prompt_templates` table in PostgreSQL - Primary source

### Solution 1: Update Database Prompts (Not Hardcoded Files)

**❌ WRONG APPROACH:**
```typescript
// Editing server/prompts/UltimateAgentPrompts.ts
// This will be IGNORED if database has the prompt!
```

**✅ CORRECT APPROACH:**
```sql
-- Create SQL script to update database
UPDATE prompt_templates
SET
  system_prompt = '⚠️⚠️⚠️ CRITICAL SYNTAX RULES - YOU MUST READ THIS FIRST ⚠️⚠️⚠️

ABSOLUTELY FORBIDDEN SYNTAX PATTERNS:
❌ NEVER write: return (;
❌ NEVER write: return {;
❌ NEVER write: return [;

' || system_prompt,
  updated_at = NOW()
WHERE
  prompt_key = 'code_generator.code_generator'
  AND is_default = true;
```

**How to Apply:**
1. Create `.sql` file with UPDATE statement
2. Run via Supabase SQL Editor or `psql`
3. Verify: `SELECT prompt_key, LEFT(system_prompt, 500) FROM prompt_templates WHERE prompt_key = 'code_generator.code_generator'`

**Fixed:** Commit `18d2451` (fix-database-prompt.sql)

### Solution 2: Ultra-Aggressive Multi-Pass Syntax Fixer

**Why Needed:** AI ignores warnings, so post-generation fixing is the ONLY reliable defense.

**Code Location:** `server/services/AICodeGenerator.ts:982-1057`

**Implementation - Three Layers of Protection:**

**Layer 1: Regex with Whitespace Handling**
```typescript
// Catches various whitespace patterns
content = content.replace(/return\s*\(\s*;+/g, (match) => {
  console.log(`🔧 [Pass ${passNumber}] Fixing return(; : "${match}"`);
  fixesApplied++;
  return 'return (';
});
```

**Layer 2: Literal String Replacement (NEW - CRITICAL)**
```typescript
// Bypasses regex issues by matching exact string
if (content.includes('return (;')) {
  console.log(`🔧 [Pass ${passNumber}] ULTRA-AGGRESSIVE: Found literal "return (;"`);
  const beforeCount = (content.match(/return \(;/g) || []).length;
  content = content.replace(/return \(;/g, 'return (');
  const afterCount = (content.match(/return \(;/g) || []).length;
  console.log(`🔧 Replaced ${beforeCount - afterCount} instances`);
  fixesApplied += (beforeCount - afterCount);
}
```

**Layer 3: Variant Patterns (Backup)**
```typescript
// Catches different whitespace encodings
content = content.replace(/return\s*\(\s*;/g, (match) => {
  console.log(`🔧 [Pass ${passNumber}] Fixing return(; (variant)`);
  fixesApplied++;
  return 'return (';
});
```

**Applied to ALL Three Patterns:**
- `return (;` → `return (` (lines 982-1007)
- `return {;` → `return {` (lines 1009-1032)
- `return [;` → `return [` (lines 1034-1057)

**Fixed:** Commit `feec08b`

### Solution 3: Array Method Syntax Error Fixes (2025-11-09)

**New Pattern Discovered:** AI also generates invalid array method calls!

**Error Example:**
```typescript
return !snakeBody.slice(1).some(;
  segment => segment.x === pos.x && segment.y === pos.y
)
```

Should be:
```typescript
return !snakeBody.slice(1).some(
  segment => segment.x === pos.x && segment.y === pos.y
)
```

**Code Location:** `server/services/AICodeGenerator.ts:1059-1081`

**Implementation - Two Layers:**

**Layer 1: Specific Array Method Patterns**
```typescript
const arrayMethods = ['some', 'map', 'filter', 'forEach', 'reduce', 'find', 'findIndex', 'every', 'flatMap', 'sort'];
arrayMethods.forEach(method => {
  const pattern = `.${method}(;`;
  if (content.includes(pattern)) {
    content = content.replace(new RegExp(`\\.${method}\\(;`, 'g'), `.${method}(`);
  }
});
```

**Layer 2: General Function/Method Call Pattern**
```typescript
// Catches ANY identifier followed by (;
content = content.replace(/(\w+)\(\s*;/g, (match, identifier) => {
  return `${identifier}(`;
});
```

**Patterns Fixed:**
- `.some(;` → `.some(`
- `.map(;` → `.map(`
- `.filter(;` → `.filter(`
- `.forEach(;` → `.forEach(`
- `functionName(;` → `functionName(`
- Any identifier + `(;` pattern

**Fixed:** Commit `fe66a27`

### Solution 4: AI Not Returning Valid JSON (2025-11-10)

**Critical Issue Discovered:** AI was not generating complete applications - only 1-4 files instead of all required files.

**Symptoms:**
```
[AICodeGenerator] WARNING: AI did not generate src/App.tsx - creating fallback
[AICodeGenerator] Extracted 1 files from markdown
```

Generated apps had stub components like:
```typescript
// Auto-generated stub
export function App(props: AppProps) {
  return <div>This component is under development.</div>
}
```

**Root Cause Chain:**
1. Database prompt didn't specify JSON output format
2. AI returned markdown or unstructured text instead of JSON
3. JSON parsing failed → fallback to markdown extraction
4. Markdown extraction only found 1-4 files
5. System created stub fallbacks for missing files (App.tsx, etc.)
6. Generated apps were incomplete and broken

**Investigation:**
```
JSON parsing failed, trying markdown extraction
Extracted 1 files from markdown
AI did not generate src/App.tsx - creating fallback
Ensured all required files. Total files: 11 (mostly stubs!)
```

**The Fix: Explicit JSON Output Format Instructions**

Added to database prompt:
```
# 🎯 OUTPUT FORMAT - CRITICAL!

**YOU MUST RESPOND WITH A JSON ARRAY** containing all files.

**Required Format:**
[
  {
    "path": "src/App.tsx",
    "content": "import React from 'react'\n\nexport default function App() {\n  return <div>Hello</div>;\n}"
  },
  {
    "path": "src/main.tsx",
    "content": "..."
  }
]

**CRITICAL RULES:**
1. ✅ MUST be a valid JSON array
2. ✅ Each object MUST have "path" and "content" keys
3. ✅ File paths MUST start with "src/"
4. ✅ Include ALL necessary files
5. ❌ NO markdown formatting around the JSON
6. ❌ NO explanatory text before or after

**RESPOND WITH THE JSON ARRAY ONLY - NOTHING ELSE!**
```

**SQL Script:** `fix-database-prompt-output-format.sql`

**Result:**
- Prompt length: 4208 → 5690 characters
- AI now returns proper JSON arrays
- All files are extracted correctly
- No more stub fallbacks

**How to Verify Fix:**
1. Generate any component
2. Check backend logs for: `Successfully parsed N files from JSON`
3. Should NOT see: `JSON parsing failed, trying markdown extraction`
4. Should NOT see: `AI did not generate src/App.tsx - creating fallback`

**Fixed:** Commit `0909eaa`

### Why Regex Alone Failed

**Problem:**
```typescript
// This regex SHOULD match "return (;" but often doesn't
/return\s*\(\s*;+/g
```

**Suspected Causes:**
1. Whitespace encoding differences (CRLF vs LF)
2. Special characters in AI output
3. Unexpected unicode characters between tokens

**Why Literal String Works:**
```typescript
// Simple string matching is immune to encoding issues
if (content.includes('return (;')) {
  content = content.replace(/return \(;/g, 'return (');
}
```

### Multi-Pass Syntax Fixer Details

**How It Works:**
1. Runs up to 10 passes iteratively
2. Each pass applies ALL syntax fixes
3. Stops when no fixes applied in a pass
4. Logs each fix for debugging

**Console Output When Working:**
```
🔧 [Pass 1] ULTRA-AGGRESSIVE: Found literal "return (;" - replacing ALL occurrences
🔧 [Pass 1] Replaced 5 instances of "return (;"
🔧 [Pass 1] Applied 5 fixes total
🔧 [Pass 2] Applied 0 fixes total (converged)
✅ Syntax validation completed after 2 passes
```

**File Processing:**
- Processes ALL TypeScript/JavaScript files: `.tsx`, `.ts`, `.jsx`, `.js`
- Runs AFTER AI generates code but BEFORE writing to disk
- Updates file content in memory, then writes once

### Lesson Learned

**❌ DON'T:**
- Rely on AI to follow syntax rules (it ignores warnings)
- Edit hardcoded prompts without checking database
- Use regex alone for syntax fixing (encoding issues)
- Assume one-pass fixing is enough (cascading errors)

**✅ DO:**
- Update database prompts via SQL scripts
- Use literal string matching as fallback after regex
- Log all fixes for debugging
- Run multi-pass fixing (up to 10 passes)
- Test with actual AI generation, not just unit tests

**✅ ALWAYS:**
- Check if prompt exists in database before editing hardcoded files
- Use three-layer defense: regex + literal + variant patterns
- Monitor console logs during code generation
- Verify fixes in deployed environment

### Testing the Fix

**1. Generate a Component:**
```
Generate a Snake game with score tracking
```

**2. Watch Console for:**
```
🔧 [Pass 1] ULTRA-AGGRESSIVE: Found literal "return (;" - replacing ALL occurrences
🔧 [Pass 1] Replaced N instances of "return (;"
```

**3. Verify No Syntax Errors:**
- Component compiles successfully
- No `SyntaxError: Unexpected token` errors
- Code runs in browser without errors

**4. If Errors Still Occur:**
- Check console for which pass detected the error
- Check if pattern is in literal replacement list
- Add new pattern if needed (follow three-layer approach)

### Related Files

**Backend:**
- `server/services/AICodeGenerator.ts:982-1081` - Multi-pass syntax fixer with array method fixes
- `server/services/PromptBuilder.ts` - Prompt assembly
- `server/services/PromptManager.ts` - Database prompt fetching
- `server/agents/CodeGeneratorAgent.ts` - Uses PromptBuilder

**Database:**
- `prompt_templates` table - Primary prompt source
- `fix-database-prompt.sql` - SQL script for syntax warnings
- `fix-database-prompt-output-format.sql` - SQL script for JSON output format

**Git Commits:**
- `0909eaa` - JSON output format fix (2025-11-10) ⭐ CRITICAL
- `fe66a27` - Array method syntax error fixes (2025-11-09)
- `613bee0` - Documentation update for syntax error fixes
- `feec08b` - Ultra-aggressive syntax fixer for return statements
- `18d2451` - SQL script for database prompt syntax warnings
- `ea17d36` - Initial attempt (hardcoded prompts, didn't work)
- `7846f2b` - Another hardcoded attempt (also didn't work)

---

## 🔥 COMPREHENSIVE FIX APPLIED (2025-11-10)

### Issue: AI Still Generating Broken Code Despite All Previous Fixes

**Symptoms:**
- AI returns markdown instead of JSON (triggers fallback parser)
- Generated code still has syntax errors like `return (;`, `return {;`, `;}` patterns
- Multi-pass syntax fixer detects 28+ errors but can't fix all of them
- Logs show: "JSON parsing failed, trying markdown extraction"

**Root Causes Identified:**
1. ✅ **Prompt not aggressive enough** - AI ignores polite instructions
2. ✅ **Temperature too high (0.7)** - Makes output less deterministic
3. ✅ **No pre-validation** - System accepts non-JSON responses and tries to parse them
4. ✅ **Literal pattern matching incomplete** - Regex fails on some whitespace encodings

### Solution 1: ULTRA-AGGRESSIVE Database Prompt (2025-11-10)

**File:** `fix-ai-code-generator-prompt.sql`

**Changes:**
```sql
UPDATE prompt_templates
SET system_prompt = '
🚨🚨🚨 CRITICAL: READ THIS BEFORE WRITING ANY CODE 🚨🚨🚨

===============================================================================
                    ⚠️ JSON OUTPUT FORMAT REQUIREMENT ⚠️
===============================================================================

YOU MUST RESPOND WITH **ONLY** A JSON ARRAY. NO OTHER FORMAT IS ACCEPTABLE.

Your response MUST start with:  [
Your response MUST end with:    ]

❌ DO NOT write explanations
❌ DO NOT use markdown code blocks
❌ DO NOT add text before or after the JSON

START YOUR RESPONSE WITH [ NOW!
...'
WHERE prompt_key = 'code_generator.code_generator';
```

**Key Improvements:**
- 🚨 Triple emoji warning at top (visual attention grabber)
- ✅ EXPLICIT format requirement in giant banner
- ✅ Multiple "DO NOT" prohibitions
- ✅ Example of exact expected output
- ✅ "START YOUR RESPONSE WITH [ NOW!" command at end
- ✅ Moved from bottom to TOP of prompt (AI sees it first)

**Prompt Length:** 5690 → 7800+ characters (more comprehensive)

**Applied:** Via Supabase migration `fix_ai_code_generator_json_output`

### Solution 2: Temperature Reduction (2025-11-10)

**File:** `server/services/AICodeGenerator.ts` (line 103)

**Before:**
```typescript
temperature: 0.7,  // Too creative, inconsistent output
```

**After:**
```typescript
temperature: 0.3,  // LOWERED: More deterministic for structured JSON output
```

**Why:** Lower temperature = more predictable, structured output. Perfect for JSON generation.

### Solution 3: Pre-Validation to Reject Non-JSON (2025-11-10)

**File:** `server/services/AICodeGenerator.ts` (lines 118-159)

**New Validation Logic:**
```typescript
// CRITICAL VALIDATION: Check if response is valid JSON array BEFORE processing
const trimmedContent = response.content.trim();
const startsWithArray = trimmedContent.startsWith('[');
const endsWithArray = trimmedContent.endsWith(']');
const containsMarkdown = response.content.includes('```');
const containsExplanation = /^(Here|I|The|Let|This)/i.test(trimmedContent);

// REJECT non-JSON responses immediately
if (!startsWithArray || !endsWithArray) {
  throw new Error('AI returned invalid format. Expected JSON array but got: ' + 
    (containsMarkdown ? 'Markdown' : containsExplanation ? 'Text explanation' : 'Unknown format'));
}
```

**Benefits:**
- ✅ Fails fast if AI ignores instructions
- ✅ Clear error messages indicating what went wrong
- ✅ Prevents fallback parser from accepting broken output
- ✅ Logs detailed diagnostics for debugging

### Solution 4: Enhanced Literal Pattern Matching (2025-11-10)

**File:** `server/services/AICodeGenerator.ts` (lines 1115-1142)

**New Code:**
```typescript
// Fix 0e2: ULTRA-AGGRESSIVE - Literal string replacements for common patterns
const literalPatterns = [
  { from: ';\n}', to: '\n}' },
  { from: ';\n  }', to: '\n  }' },
  { from: ';\n    }', to: '\n    }' },
  { from: ';\n      }', to: '\n      }' },
  { from: ';\n        }', to: '\n        }' },
  { from: '; )', to: ' )' },
  { from: ';)', to: ')' },
  { from: '; ]', to: ' ]' },
  { from: ';]', to: ']' },
  { from: '; }', to: ' }' },
  { from: ';}', to: '}' }
];

literalPatterns.forEach(({ from, to }) => {
  if (content.includes(from)) {
    const beforeCount = content.split(from).length - 1;
    content = content.split(from).join(to);
    const afterCount = content.split(from).length - 1;
    const replaced = beforeCount - afterCount;
    if (replaced > 0) {
      console.log(`🔧 [Pass ${passNumber}] LITERAL FIX: Replaced ${replaced} instances`);
      fixesApplied += replaced;
    }
  }
});
```

**Why Literal String Matching:**
- ✅ Bypasses regex complexity and encoding issues
- ✅ Catches exact patterns that regex misses
- ✅ Works with different whitespace encodings (CRLF vs LF)
- ✅ Covers most common indentation levels (2, 4, 6, 8 spaces)

### Combined Defense Strategy

**Layer 1: Aggressive Prompt (Database)**
- Makes it VERY clear what format is required
- Visual emphasis with emojis and banners
- Multiple examples and prohibitions

**Layer 2: Pre-Validation (AICodeGenerator)**
- Rejects non-JSON responses immediately
- Fails fast with clear error messages
- Logs diagnostics for debugging

**Layer 3: Temperature Control**
- Lower temperature = more consistent output
- Better for structured data generation

**Layer 4: Multi-Layer Syntax Fixer**
- Regex patterns for most cases
- Literal string matching for edge cases
- Array method patterns (`.map(;`, `.filter(;`)
- Up to 10 passes to catch cascading errors

### How to Verify the Fix

**1. Check Database Prompt Updated:**
```sql
SELECT 
  prompt_key,
  LENGTH(system_prompt) as length,
  LEFT(system_prompt, 200) as preview
FROM prompt_templates
WHERE prompt_key = 'code_generator.code_generator';
```
Should show length > 7000 and start with "🚨🚨🚨 CRITICAL"

**2. Clear Prompt Cache:**
```typescript
// In backend, the PromptManager has 5-minute cache
// Wait 5 minutes OR restart backend server to ensure new prompt is used
```

**3. Generate Test Component:**
```
Generate a todo list app with add, delete, and mark complete
```

**4. Check Logs For:**
```
✅ [AICodeGenerator] Using DATABASE prompt for code generation
✅ Starts with [: true
✅ Ends with ]: true
✅ Successfully parsed N files from JSON
```

**5. Should NOT See:**
```
❌ JSON parsing failed, trying markdown extraction
❌ AI did not generate src/App.tsx - creating fallback
❌ Contains markdown: true
```

### Expected Results After Fix

**Before Fix:**
- ❌ "JSON parsing failed, trying markdown extraction"
- ❌ "Extracted 8 files from markdown"
- ❌ "28 instances of ';}'  found in src/App.tsx"
- ❌ Incomplete apps with stub components
- ❌ Syntax errors that fixer can't fix

**After Fix:**
- ✅ "Successfully parsed 10+ files from JSON"
- ✅ "Starts with [: true"
- ✅ "0-5 syntax fixes applied" (much fewer errors)
- ✅ Complete, working applications
- ✅ All files generated correctly

### Files Changed

**Backend:**
- `server/services/AICodeGenerator.ts` - Temperature, pre-validation, literal pattern matching
- `prompt_templates` table - Ultra-aggressive prompt

**Scripts:**
- `fix-ai-code-generator-prompt.sql` - SQL migration for new prompt

### Monitoring & Debugging

**If issues persist, check:**
1. **Prompt cache** - Wait 5 minutes or restart backend
2. **Database prompt** - Verify it's actually updated in database
3. **Temperature** - Should be 0.3 in logs
4. **AI response logs** - Check "=== AI RESPONSE DEBUG ===" section
5. **Model used** - Some models ignore instructions better than others

**Debug Commands:**
```sql
-- Verify prompt is updated
SELECT prompt_key, LENGTH(system_prompt), 
       LEFT(system_prompt, 100) as first_100_chars
FROM prompt_templates 
WHERE prompt_key = 'code_generator.code_generator';

-- Check prompt usage
SELECT created_at, success, error_message
FROM prompt_usage_logs
WHERE prompt_template_id = (
  SELECT id FROM prompt_templates 
  WHERE prompt_key = 'code_generator.code_generator'
)
ORDER BY created_at DESC
LIMIT 10;
```

### Lesson Learned

**The Problem:**
AI models don't follow instructions reliably, especially when:
- Instructions are mixed with other content
- Format requirements are not emphasized
- Temperature is too high
- No validation enforces compliance

**The Solution:**
- ✅ Make critical instructions IMPOSSIBLE to miss (🚨 emojis, banners, ALL CAPS)
- ✅ Put format requirements at TOP and BOTTOM of prompt
- ✅ Lower temperature for structured output
- ✅ Validate output format BEFORE accepting it
- ✅ Have multiple fallback layers (literal string matching, multi-pass fixing)
- ✅ Fail fast with clear errors instead of limping along with broken output

**Key Insight:** 
Relying solely on AI to follow instructions is insufficient. You need:
1. Extremely aggressive prompts
2. Lower temperature for determinism
3. Pre-validation to reject bad output
4. Post-processing to fix remaining issues
5. Clear error messages for debugging

**Applied:** 2025-11-10


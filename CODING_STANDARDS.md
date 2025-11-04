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


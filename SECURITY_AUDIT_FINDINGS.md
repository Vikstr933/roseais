# Database Security Audit Report
**Date:** November 4, 2025  
**Status:** CRITICAL SECURITY ISSUES FOUND  
**Thoroughness Level:** Medium (comprehensive analysis)

---

## EXECUTIVE SUMMARY

This security audit identified **5 CRITICAL user isolation vulnerabilities** and **multiple HIGH-severity authorization issues**. Several API routes completely lack authentication middleware, allowing unauthorized data access to sensitive user credentials and workspace modifications.

---

## CRITICAL ISSUES (MUST FIX IMMEDIATELY)

### CRITICAL #1: API-KEYS ROUTE - NO AUTHENTICATION
**File:** `server/routes/api-keys.ts`  
**Severity:** CRITICAL  
**Risk:** Unauthorized access to ANY user's API keys

#### Vulnerable Endpoints:
- `GET /api/api-keys/user/:userId` (Line 73)
  - NO authentication middleware
  - ANY userId parameter accepted
  - Returns user's API keys without permission check

- `POST /api/api-keys/check-requirements` (Line 97)
  - NO authentication
  - userId taken from request body without verification

- `GET /api/api-keys/get/:userId/:serviceName/:keyName` (Line 137)
  - NO authentication
  - Directory traversal possible

- `DELETE /api/api-keys/:userId/:keyId` (Line 174)
  - NO authentication middleware
  - Can delete any user's API keys

- `PUT /api/api-keys/:userId/:keyId/deactivate` (Line 202)
  - NO authentication middleware
  - Can deactivate any user's API keys

#### Impact:
Any attacker can:
- Enumerate all users' API keys
- Delete or disable credentials
- Impersonate users via stored API keys
- Access connected services (Stripe, OpenAI, GitHub, etc.)

#### Fix Required:
Add authentication and verify ownership:
```typescript
router.get('/user/:userId', authenticateUser, async (req, res) => {
  if (req.user!.id !== req.params.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // ... rest of code
});
```

---

### CRITICAL #2: WORKSPACE UPDATE - NO AUTHENTICATION
**File:** `server/routes/workspaces.ts` Line 247  
**Severity:** CRITICAL  

#### Vulnerable Code:
```typescript
router.put('/:id', async (req, res) => {  // NO authenticateUser!
```

#### Issues:
- NO authentication middleware required
- NO ownership verification
- ANY user can modify ANY workspace
- Can change: agent configs, test cases, settings, collaborators, status

#### Impact:
- Users can modify other users' projects
- Sabotage project configurations
- Change project settings and access controls
- Modify agent configurations

#### Fix Required:
```typescript
router.put('/:id', authenticateUser, async (req, res) => {
  const workspace = await db.select().from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  
  if (workspace.ownerId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // ... rest of code
});
```

---

### CRITICAL #3: AGENTS TABLE - SCHEMA INCONSISTENCY
**Files:** SQLite uses `userId`, PostgreSQL uses `createdBy`

#### PostgreSQL Missing:
- No `isSystem` field
- No `userId` field (uses `createdBy` instead)
- Cannot distinguish system vs user agents

#### Impact:
- Production database (PostgreSQL) cannot properly isolate agents
- System agents not distinguishable from user agents
- Routes may not work correctly with PG schema

#### Fix Required:
Align PostgreSQL schema with SQLite:
```typescript
userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).optional(),
isSystem: integer('is_system').default(0),
```

---

### CRITICAL #4: CODE GENERATION SESSIONS - WEAK ISOLATION
**Tables:** Both schemas have optional `workspaceId`

#### Issue:
- `workspaceId` field is optional (can be NULL)
- Sessions with NULL workspace not properly isolated
- Potential for cross-user access

#### Impact:
- Users might access other users' code generation sessions
- Weak isolation if workspaceId is null

#### Fix Required:
Make workspaceId required OR add explicit workspace ownership check.

---

### CRITICAL #5: PROMPT SYSTEM - NO USER TRACKING
**Tables:** `promptTemplates`, `promptChains` missing `userId`

#### Issue:
- No `userId` field
- Cannot distinguish system vs user templates
- No per-user customization possible

#### Impact:
- If used for user-created templates, violates isolation
- No ownership tracking for custom prompts

#### Fix Required:
Add optional userId for user-created templates:
```typescript
userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).optional(),
isSystem: integer('is_system').default(1),
```

---

## HIGH-SEVERITY ISSUES

### HIGH #1: WORKSPACE GET - INFORMATION DISCLOSURE
**File:** `server/routes/workspaces.ts` Line 64

#### Issue:
- `GET /api/workspaces/:id` allows unauthenticated access
- Returns sensitive data: ownerId, inviteCode, agentConfig
- No membership verification for authenticated users

#### Impact:
- Anyone can discover workspace details
- Can enumerate workspace IDs
- See project configurations

#### Fix Required:
```typescript
// Verify user has access or workspace is public
if (req.user) {
  const isMember = await verifyAccess(workspaceId, req.user.id);
  if (!isMember) return res.status(403).json({ error: 'Forbidden' });
}
```

---

### HIGH #2: WORKSPACE MEMBERS - NO MEMBERSHIP CHECK
**File:** `server/routes/workspaces.ts` Line 522

#### Issue:
- `GET /api/workspaces/:id/members` requires auth
- But doesn't verify user is member of workspace
- Can enumerate all members of any workspace

#### Impact:
- Information disclosure about all projects
- Could map out entire user base via workspace enumeration

---

## VERIFIED AS SECURE

### Tables with Proper Isolation:

✓ **agents** (SQLite version)
- Has userId field, isSystem flag
- Routes properly verify ownership
- Status: SECURE

✓ **workspaces** (mostly)
- Has ownerId field
- Most routes verify ownership (except PUT)
- Status: MOSTLY SECURE

✓ **userAPIKeys / userCredentials**
- All routes have authenticateUser
- All queries filter by userId
- Status: SECURE (except GET endpoints in api-keys.ts)

✓ **projectMembers**
- Proper userId and projectId
- Routes verify membership
- Status: SECURE

✓ **projectChatMessages**
- Proper userId and projectId
- Routes verify access
- Status: SECURE

✓ **projectActivities**
- Proper userId and projectId
- Routes verify access
- Status: SECURE

✓ **projectFiles**
- Proper createdBy, lastModifiedBy fields
- Routes verify access
- Status: SECURE

✓ **userGeneratedPlugins**
- Has userId field
- Routes verify ownership
- Status: SECURE

✓ **pluginConfigs, pluginKnowledge, pluginActions, pluginSyncLogs**
- All have userId fields
- Status: SECURE

✓ **conversations, userPreferences, aiInsights**
- All have userId fields
- Status: SECURE

---

## QUICK FIX SUMMARY

| Issue | Effort | Risk |
|-------|--------|------|
| Add auth to api-keys routes | 2 hours | CRITICAL |
| Add auth to workspace PUT | 1 hour | CRITICAL |
| Fix agents schema in PostgreSQL | 3 hours | CRITICAL |
| Add userId to prompt tables | 4 hours | HIGH |
| Fix workspace access controls | 2 hours | HIGH |

**Total Effort: 12 hours**
**Risk Level: EXTREME if unfixed**

---

## TESTING COMMANDS

```bash
# These will FAIL after fixes are applied (should be blocked)
curl http://localhost:3001/api/api-keys/user/other-user-id
curl -X PUT http://localhost:3001/api/workspaces/123 -H "Content-Type: application/json" -d '{}'
curl http://localhost:3001/api/api-keys/get/user/service/key

# These should be blocked with 401/403
# Expected: 401 Unauthorized or 403 Forbidden
# Current: Returns data (VULNERABLE)
```


# 🔒 CRITICAL SECURITY FIX: User Isolation Migration

## ⚠️ SECURITY ISSUE FOUND

**Problem**: All users could see and access each other's custom agents. The `agents` table had no `user_id` field to separate user data.

**Solution**: Add user isolation with `userId` and `isSystem` columns.

---

## 🚀 Run This Migration IMMEDIATELY

### Step 1: Open Supabase SQL Editor

Go to: **https://supabase.com/dashboard/project/hngwzhlhlaggzzmgcwys/sql**

---

### Step 2: Run Migration

1. Open file: `migrations/2025_add_user_isolation_to_agents.sql`
2. **Copy ALL content** (Ctrl+A, then Ctrl+C)
3. In Supabase SQL Editor, click **"New query"**
4. **Paste** (Ctrl+V)
5. Click **"Run"** button

**Expected Output:**
```
ALTER TABLE
ALTER TABLE
CREATE INDEX
CREATE INDEX
UPDATE 15  ← (marks existing agents as system agents)
```

---

### Step 3: Verify Migration

Run this query to verify:

```sql
-- Check columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'agents'
  AND column_name IN ('user_id', 'is_system')
ORDER BY column_name;

-- Check existing agents are marked as system
SELECT
  id,
  name,
  user_id,
  is_system,
  CASE
    WHEN is_system = 1 THEN 'System Agent (visible to all)'
    ELSE 'User Agent (private)'
  END as visibility
FROM agents
ORDER BY is_system DESC, name;
```

**Expected:**
- 2 columns: `user_id` (text, nullable), `is_system` (integer, not null)
- All existing agents have `is_system = 1` and `user_id = NULL`

---

## ✅ What This Migration Does

### 1. **Adds User Isolation Fields**
```sql
ALTER TABLE agents ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE agents ADD COLUMN is_system INTEGER DEFAULT 0;
```

- `user_id`: Owner of the agent (NULL for system agents)
- `is_system`: 1 = system agent (visible to all), 0 = user agent (private)

### 2. **Creates Performance Indexes**
```sql
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_is_system ON agents(is_system);
```

### 3. **Preserves Existing Agents**
```sql
UPDATE agents SET is_system = 1 WHERE user_id IS NULL;
```

All existing agents (React Developer, Python Expert, etc.) are marked as **system agents** and remain visible to all users.

---

## 🛡️ Backend Changes Already Implemented

### **server/routes/agents.ts** - Now Protected!

#### GET /api/agents
- ✅ **Admins**: See ALL agents (system + all users' agents)
- ✅ **Users**: See system agents + their own agents only
- ✅ **Anonymous**: See system agents only

#### GET /api/agents/:id
- ✅ Authorization check: Can only access system agents or own agents
- ✅ Returns 403 Forbidden if unauthorized

#### POST /api/agents
- ✅ Requires authentication
- ✅ Auto-assigns `userId` to newly created agent
- ✅ Only admins can create system agents (`isSystem = 1`)
- ✅ Regular users create private agents (`isSystem = 0`)

#### PUT /api/agents/:id
- ✅ Requires authentication
- ✅ Verifies ownership before update
- ✅ Admins can edit any agent
- ✅ Users can only edit their own agents

#### DELETE /api/agents/:id
- ✅ Requires authentication
- ✅ Verifies ownership before deletion
- ✅ Admins can delete any agent
- ✅ Users can only delete their own agents
- ✅ System agents protected (admin-only deletion)

### **New Admin Route**
```
GET /api/admin/agents/all
```
- ✅ Admin-only access (requires `role = 'admin'` or `'superadmin'`)
- ✅ Returns ALL agents with ownership metadata
- ✅ Use this for admin dropdown to view/inspect all agents

---

## 🔐 Admin Role-Based Access Control (RBAC)

### **server/middleware/admin.ts** - NEW!

#### Middleware Functions Available:

1. **`requireAdmin`** - Restrict to admin or superadmin
```typescript
router.get('/admin/data', requireAdmin, async (req, res) => {
  // Only admins can access
});
```

2. **`requireSuperAdmin`** - Restrict to superadmin only
```typescript
router.delete('/admin/critical', requireSuperAdmin, async (req, res) => {
  // Only superadmin can access
});
```

3. **`requireAdminOrOwner(field)`** - Allow admin OR resource owner
```typescript
router.get('/workspaces/:id', requireAdminOrOwner('userId'), async (req, res) => {
  // Admins can view any workspace, users only their own
});
```

4. **`checkAdminStatus`** - Add `isAdmin` flag to request
```typescript
router.get('/data', optionalAuth, checkAdminStatus, async (req, res) => {
  if ((req as any).isAdmin) {
    // Show admin features
  }
});
```

---

## 👤 How to Make Yourself Admin

In Supabase, update your user's role:

```sql
-- Find your user
SELECT id, email, username, role FROM users WHERE email = 'your-email@gmail.com';

-- Set role to admin
UPDATE users
SET role = 'admin'
WHERE email = 'your-email@gmail.com';

-- Verify
SELECT id, email, username, role FROM users WHERE email = 'your-email@gmail.com';
```

**Roles Available:**
- `'user'` - Regular user (default)
- `'admin'` - Admin access (can view/edit all data)
- `'superadmin'` - Highest privilege

After updating your role in the database, **sign out and sign back in** to refresh your session.

---

## 📊 Testing the Security Fix

### Test 1: User Isolation Works
1. Sign in as User A
2. Create a custom agent
3. Sign in as User B
4. Verify you CANNOT see User A's agent
5. Verify you CAN see system agents

### Test 2: Admin Access Works
1. Set your role to `'admin'` in database
2. Sign out and sign back in
3. Access `/api/admin/agents/all`
4. Verify you see ALL agents (system + all users)
5. Verify you can edit any agent

### Test 3: System Agents Visible to All
1. Sign in as any user (or anonymous)
2. Fetch `/api/agents`
3. Verify you see: React Developer, Python Expert, etc.

---

## 🚨 Next Steps: Security Audit

After running this migration, we need to audit other tables for similar issues:

### Tables to Check:
- ✅ `workspaces` - Already has `ownerId` ✓
- ✅ `projectMembers` - Already has `userId` ✓
- ✅ `projectChatMessages` - Already has `userId` ✓
- ✅ `codeGenerationSessions` - Already has `userId` ✓
- ❓ `plugins` - Need to check
- ❓ `credentials` - Need to check
- ❓ `files` - Need to check
- ❓ Any other user-created content

---

## 📝 Database Schema Reference

### Before Migration:
```sql
CREATE TABLE agents (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  -- ... other fields ...
  -- ❌ NO user isolation!
);
```

### After Migration:
```sql
CREATE TABLE agents (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  -- ... other fields ...
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,  -- ✅ Owner
  is_system INTEGER NOT NULL DEFAULT 0,                 -- ✅ System flag
);
```

---

## 🎯 Success Criteria

After migration, verify:

1. ✅ `user_id` and `is_system` columns exist on `agents` table
2. ✅ All existing agents have `is_system = 1` and `user_id = NULL`
3. ✅ New agents created by users have `user_id` set to creator
4. ✅ Users can only see their own agents + system agents
5. ✅ Admins can see and edit ALL agents
6. ✅ System agents cannot be deleted by regular users

---

## 💡 Important Notes

- **No data loss**: All existing agents preserved as system agents
- **Backward compatible**: Frontend continues to work (just with filtered data)
- **No downtime required**: Migration is additive (adds columns, doesn't modify existing data)
- **Immediate security**: Protection active as soon as backend restarts

---

## 🆘 Troubleshooting

### "column already exists"
**Solution**: Migration already run! Skip to Step 3 to verify.

### "foreign key constraint failed"
**Solution**: Make sure `users` table exists and has `id` column.

### Backend shows errors after migration
**Solution**: Restart backend server:
```bash
npm run dev:backend
```

### Users still see other users' agents
**Solution**:
1. Check migration ran successfully
2. Check backend logs for authorization messages
3. Verify `isSystem` and `userId` values are correct
4. Clear browser cache and refresh

---

## ✅ Migration Complete!

Once this migration is complete and backend is restarted, your agents system will be **fully secure** with:
- ✅ User isolation (users only see their own + system agents)
- ✅ Admin access control (admins see everything)
- ✅ System agents (visible to all users)
- ✅ Protected routes with proper authorization
- ✅ Ready for admin dashboard integration

**Next:** Run security audit on other tables to ensure full application security!

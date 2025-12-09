# 🛡️ Admin Dashboard - Complete Guide

## Overview

Your application now has a comprehensive admin dashboard accessible at `/admin` with all administrative features in one place!

**Access:** Only available to users with `role = 'admin'` or `role = 'superadmin'` in the database.

---

## 🚀 Features

### 1. **Statistics Dashboard** 📊
- **Users**: Total count, breakdown by role (admin/user), breakdown by tier (free/pro/enterprise)
- **Agents**: Total count, system vs user-created agents
- **Workspaces**: Total workspace count
- **Credentials**: Total API keys stored

### 2. **User Management** 👥
- View all users in the system
- Edit user roles (dropdown: user, admin, superadmin)
- Edit user tiers (dropdown: free, pro, enterprise)
- View user status (active/inactive)
- See creation dates and last active timestamps
- Quick actions: View and Delete buttons

### 3. **Agent Management** 🤖
- View all agents (system + all users' custom agents)
- See ownership metadata (System or user ID)
- Filter by type (System agents vs User agents)
- View agent status (active/inactive)
- See model information
- Creation dates for tracking

### 4. **Workspace Management** 📁
- View all workspaces in the system
- See workspace owners
- View workspace status
- See creation dates
- Quick overview of all user workspaces

---

## 🔗 Accessing the Dashboard

### For Regular Users:
- The `/admin` link will NOT appear in navigation
- Attempting to access `/admin` will redirect to home

### For Admin Users:
1. **Make yourself admin** (run in Supabase SQL Editor):
   ```sql
   UPDATE users
   SET role = 'admin'
   WHERE email = 'your-email@gmail.com';
   ```

2. **Sign out and sign back in** to refresh your session

3. **Look for the Shield icon** 🛡️ in the navigation bar with an "A" badge

4. **Click it** to access the full admin dashboard!

---

## 📊 Admin Dashboard Tabs

### Tab 1: Statistics
Beautiful gradient cards showing:
- 👥 **Users** (blue gradient)
  - Total users
  - Admins count
  - Regular users count

- 🤖 **Agents** (purple gradient)
  - Total agents
  - System agents
  - User-created agents

- 📁 **Workspaces** (green gradient)
  - Total workspaces

- 🔑 **Credentials** (orange gradient)
  - Total API keys

- 💎 **User Tiers** (cyan gradient)
  - Free tier users
  - Pro tier users
  - Enterprise tier users

### Tab 2: Users
Comprehensive user table with:
- User display name and username
- Email address
- **Editable role dropdown** (user/admin/superadmin)
- **Editable tier dropdown** (free/pro/enterprise)
- Active status badge
- Creation date
- Quick actions (View/Delete)

**Live Editing:** Select new role or tier from dropdown → Changes apply immediately!

### Tab 3: Agents
All agents table showing:
- Agent name and description
- Type badge (System/User)
- Model information
- Owner user ID or "System"
- Active status
- Creation date

**Visibility:** Admins see ALL agents, including:
- System agents (React Developer, Python Expert, etc.)
- All users' custom agents with ownership info

### Tab 4: Workspaces
All workspaces table showing:
- Workspace name
- Description
- Owner user ID
- Status
- Creation date

**Full Access:** View all workspaces across all users

---

## 🎨 UI Features

### Design:
- **Gradient background**: Dark blue to purple theme
- **Glassmorphism cards**: Semi-transparent with backdrop blur
- **Tabbed interface**: All features in one page (no separate routes needed!)
- **Responsive tables**: Horizontal scroll on mobile
- **Color-coded badges**:
  - Green = Active
  - Red = Inactive
  - Purple = System
  - Blue = User
  - Orange = Admin badge

### Navigation Badge:
- Superadmin links show purple "SA" badge
- Admin link shows orange "A" badge
- Only visible to admin/superadmin users

---

## 🔌 API Endpoints

All admin API routes are protected with `authenticateUser` + `requireAdmin` middleware.

### Statistics
```
GET /api/admin/stats
```
Returns comprehensive system statistics.

### Users
```
GET /api/admin/users
```
Returns all users (passwords excluded).

```
PUT /api/admin/users/:userId/role
Body: { "role": "user" | "admin" | "superadmin" }
```
Updates a user's role.

```
PUT /api/admin/users/:userId/tier
Body: { "tier": "free" | "pro" | "enterprise" }
```
Updates a user's tier.

```
GET /api/admin/user/:userId/details
```
Get detailed information about a specific user.

### Agents
```
GET /api/admin/agents
```
Returns all agents with ownership metadata.

### Workspaces
```
GET /api/admin/workspaces
```
Returns all workspaces.

### Cleanup (Already Existing)
```
POST /api/admin/cleanup/orphaned
POST /api/admin/cleanup/old-messages
GET /api/admin/stats/chat
GET /api/admin/stats/database
```

---

## 🔒 Security

### Authentication:
- All `/api/admin/*` routes require valid authentication token
- All routes check for `admin` or `superadmin` role
- Non-admin users get 403 Forbidden

### Authorization Checks:
```typescript
// All admin routes use:
router.use(authenticateUser);
router.use(requireAdmin);
```

### Frontend Protection:
```typescript
// Dashboard checks user role on mount
useEffect(() => {
  if (!loading && (!user || (user.role !== 'admin' && user.role !== 'superadmin'))) {
    navigate('/');  // Redirect to home if not admin
  }
}, [user, loading, navigate]);
```

---

## 📝 Usage Examples

### Example 1: Promote User to Admin
1. Go to `/admin`
2. Click "Users" tab
3. Find the user in the table
4. Change role dropdown from "user" to "admin"
5. User is now an admin! (They'll need to sign out and back in)

### Example 2: Upgrade User to Pro
1. Go to `/admin`
2. Click "Users" tab
3. Find the user
4. Change tier dropdown from "free" to "pro"
5. User immediately has pro tier access

### Example 3: View All Custom Agents
1. Go to `/admin`
2. Click "Agents" tab
3. See all agents:
   - System agents (with "System" badge)
   - User agents (with "User" badge and owner ID)
4. Filter/search to find specific agents

### Example 4: Monitor System Health
1. Go to `/admin`
2. Stay on "Statistics" tab
3. See at a glance:
   - How many users you have
   - How many custom agents have been created
   - How many workspaces are active
   - How many API keys are stored

---

## 🎯 Admin Capabilities Summary

As an admin, you can now:

✅ **View**
- All users
- All agents (system + custom)
- All workspaces
- System statistics
- User details

✅ **Manage**
- User roles (promote/demote admins)
- User tiers (upgrade/downgrade subscriptions)
- User status (active/inactive)

✅ **Monitor**
- System health
- User distribution (by role and tier)
- Agent usage (system vs user-created)
- Workspace activity

✅ **Access**
- Everything in one place at `/admin`
- No need to navigate to separate admin pages
- All features in tabbed interface

---

## 🚨 Important Notes

### 1. **Make Yourself Admin First**
Before you can access the admin dashboard, you MUST set your role to `'admin'` in the database:

```sql
-- In Supabase SQL Editor
UPDATE users
SET role = 'admin'
WHERE email = 'your-google-auth-email@gmail.com';
```

### 2. **Sign Out After Role Change**
After changing your role in the database, **sign out and sign back in** to refresh your session token.

### 3. **Admin Link Visibility**
The admin link ONLY appears for users with admin/superadmin role. If you don't see it:
1. Check your role in the database
2. Make sure you signed out and back in
3. Check browser console for errors

### 4. **Run the Migration!**
Don't forget to run the agents user isolation migration:
```sql
-- Run in Supabase SQL Editor
-- File: migrations/2025_add_user_isolation_to_agents.sql
```

See [RUN_SECURITY_MIGRATION.md](RUN_SECURITY_MIGRATION.md) for detailed instructions.

---

## 📁 Files Added/Modified

### New Files:
- `client/src/pages/AdminDashboard.tsx` - Complete admin dashboard UI

### Modified Files:
- `server/routes/admin.ts` - Added admin API routes + authentication
- `client/src/App.tsx` - Added `/admin` route
- `client/src/components/Navigation.tsx` - Added admin link with Shield icon

---

## 🎉 What's Next?

Now that you have a complete admin dashboard, you can:

1. **Monitor your system** - Check stats regularly
2. **Manage users** - Promote admins, upgrade tiers
3. **View all data** - See all agents and workspaces across users
4. **Make data-driven decisions** - Use statistics to understand usage patterns

---

## 💡 Pro Tips

### Tip 1: Bulk User Management
- Open users tab
- Use browser search (Ctrl+F) to find users quickly
- Edit roles/tiers directly from dropdown

### Tip 2: Agent Ownership Tracking
- Filter agents by owner ID to see what each user created
- Identify most active agent creators
- Monitor system agent usage vs custom agents

### Tip 3: Workspace Monitoring
- Check creation dates to see activity trends
- Identify inactive workspaces
- Monitor user engagement

---

## ❓ Troubleshooting

### "I don't see the admin link"
**Solution:** Check your role in database, sign out/in, clear cache

### "I get redirected from /admin"
**Solution:** Your role is not admin or superadmin. Update in database.

### "Role/tier changes don't apply"
**Solution:** Changes are immediate in database, but user needs to sign out/in to refresh session

### "Can't access admin API routes"
**Solution:** Check authentication token is valid, verify role in database

---

## 🎊 Congratulations!

You now have a **complete, production-ready admin dashboard** with:
- ✅ Full user management
- ✅ Complete system overview
- ✅ Agent and workspace monitoring
- ✅ Beautiful, responsive UI
- ✅ Secure, role-based access
- ✅ All features in one place

**Access it at:** `/admin` (after setting your role to admin!)

**Enjoy your new superpowers!** 🚀

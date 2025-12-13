# Shared Connectors Architecture & Integration Guide

## 🎯 Purpose of Shared Connectors

Shared connectors serve **TWO main purposes**:

1. **Deployment Credentials**: Allow workspaces to deploy to their own Vercel/GitHub accounts (instead of platform's)
2. **Environment Variables for Generated Apps**: Provide API keys and env vars that are automatically injected into generated code

---

## Current State & Confusion

### The Problem
There's confusion about how shared connectors relate to:
1. **Platform deployment credentials** (your backend's `GITHUB_TOKEN`, `VERCEL_TOKEN`)
2. **User/workspace deployment** (when users click "Deploy to Production")
3. **Code generation context** (how agents use connector info)

### Current Implementation

#### 1. Platform Deployment (Backend Env Vars)
- **Location**: `process.env.GITHUB_TOKEN`, `process.env.VERCEL_TOKEN`
- **Purpose**: YOUR platform's credentials for deploying user projects
- **Used by**: `ProductionDeploymentService.ts`
- **Scope**: All deployments use these credentials by default

#### 2. Shared Connectors (Database)
- **Location**: `api_keys` table with `is_shared = true`
- **Purpose**: Workspace-level API keys configured by admins
- **Current Status**: ✅ **NOW IMPLEMENTED** - Decryption working
- **Used by**: `ProductionDeploymentService.getServiceAPIKey()` with priority over env vars

#### 3. The Resolution
✅ **FIXED**: Decryption is now implemented. The system:
- Checks for shared connectors FIRST (workspace-level)
- Falls back to personal connectors (user-level)
- Falls back to platform env vars (backward compatibility)

---

## How It Works Now

### Deployment Credential Priority

When deploying, the system checks in this order:

1. **Shared Connector** (workspace-level)
   - If admin configured Vercel/GitHub connector → use it
   - Deploys to **workspace's account**
   - All users in workspace benefit

2. **Personal Connector** (user-level)
   - If user has personal Vercel/GitHub connector → use it
   - Deploys to **user's account**
   - Only that user benefits

3. **Platform Credentials** (fallback)
   - If no connectors found → use `process.env.*`
   - Deploys to **platform's account**
   - Platform manages everything

### Example Scenarios

#### Scenario 1: No Connectors Configured
```
User clicks "Deploy to Production"
→ System checks: No shared connector
→ System checks: No personal connector
→ System uses: process.env.VERCEL_TOKEN (platform's)
→ Result: Deploys to platform's Vercel account
```

#### Scenario 2: Shared Connector Configured
```
Admin configures workspace Vercel connector
User clicks "Deploy to Production"
→ System checks: ✅ Found shared Vercel connector
→ System uses: Workspace's Vercel token
→ Result: Deploys to workspace's Vercel account
```

#### Scenario 3: Personal Connector Configured
```
User configures personal Vercel connector
User clicks "Deploy to Production"
→ System checks: No shared connector
→ System checks: ✅ Found personal Vercel connector
→ System uses: User's Vercel token
→ Result: Deploys to user's Vercel account
```

---

## How Shared Connectors Work for Code Generation

### Environment Variables Injection (Future Enhancement)

Shared connectors should provide **env vars** to generated apps:

#### Example: Stripe Connector

**When configured:**
- Admin adds Stripe connector with `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY`

**During code generation:**
- Agent knows: "This workspace has Stripe configured"
- Agent can: Generate payment forms, checkout flows, subscription logic
- Generated code includes: `process.env.STRIPE_SECRET_KEY` references

**During deployment:**
- System automatically adds `STRIPE_SECRET_KEY` to Vercel env vars
- Generated app works immediately without manual setup

#### Example: Vercel Connector

**When configured:**
- Admin adds Vercel connector with `VERCEL_TOKEN`

**During code generation:**
- Agent knows: "This workspace can deploy to Vercel"
- Agent can: Generate Vercel-optimized configs, add deployment scripts

**During deployment:**
- System uses workspace's Vercel token (not platform's)
- Deploys to workspace's Vercel account

---

## Implementation Status

### ✅ Completed
- [x] Shared connectors database schema
- [x] Connector configuration UI
- [x] Decryption in `ProductionDeploymentService`
- [x] Priority system (shared → personal → platform)

### ⏳ To Do
- [ ] Inject connector env vars into generated code
- [ ] Add connector context to agent prompts
- [ ] Show which credentials are being used in UI
- [ ] Add option to choose "my account" vs "platform account"

---

## Questions & Answers

### Q: Does this conflict with platform deployment?
**A**: No! It's a priority system:
- If workspace has connectors → use them (deploy to workspace account)
- If not → use platform credentials (deploy to platform account)
- Both work, connectors just take priority

### Q: Should shared connectors be used as context for agents?
**A**: Yes! (Not yet implemented)
- Agents should know what connectors are available
- This allows smarter code generation
- Example: "I see you have Stripe, I'll add payment features"

### Q: What about environment variables?
**A**: This is the main value proposition (Not yet implemented)
- Generated apps should automatically have access to configured services
- No manual env var setup required
- Example: Stripe connector → `process.env.STRIPE_SECRET_KEY` works automatically

### Q: Personal vs Shared connectors?
**A**: 
- **Shared**: Workspace-wide, configured by admin, all users benefit
- **Personal**: User-specific, configured by user, only that user benefits
- Both work the same way, just different scope

---

## Next Steps

1. ✅ **DONE**: Implement decryption in `getServiceAPIKey()`
2. ⏳ **TODO**: Add connector context to agent prompts
3. ⏳ **TODO**: Inject connector env vars into generated code
4. ⏳ **TODO**: Update UI to show which credentials are being used
5. ⏳ **TODO**: Add option to choose "my account" vs "platform account"

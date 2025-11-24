# 🔧 Production Environment Variables Guide

**Current Setup:**
- ✅ Frontend: Vercel (has all env vars)
- ✅ Backend: Render (has all keys)

---

## 📍 Where Each Token Belongs

### Backend (Render) - Required ✅

These tokens are **BACKEND ONLY** and should be in **Render**, not Vercel:

```env
# GitHub Personal Access Token
# Used for: Creating repos, pushing code, GitHub API access
GITHUB_TOKEN=ghp_your_github_token_here

# Vercel API Token  
# Used for: Creating Vercel projects, triggering deployments
VERCEL_TOKEN=your_vercel_token_here
```

**Why Backend Only?**
- Used by `ProductionDeploymentService.ts` (backend service)
- Used by `/api/deployment` routes (backend API)
- Frontend doesn't need direct access to these tokens

---

### Frontend (Vercel) - NOT Needed ❌

**Do NOT add these to Vercel:**
- ❌ `GITHUB_TOKEN` - Backend only
- ❌ `VERCEL_TOKEN` - Backend only

**Frontend only needs:**
- `VITE_SENTRY_DSN` (if using Sentry)
- `VITE_APP_VERSION` (optional)
- Other `VITE_*` prefixed variables

---

## ✅ Quick Checklist

### Render (Backend) Environment Variables

**Required:**
- [x] `DATABASE_URL` - PostgreSQL connection
- [x] `ANTHROPIC_API_KEY` - AI API key
- [x] `SESSION_SECRET` - Session encryption
- [x] `JWT_SECRET` - JWT signing
- [x] `ENCRYPTION_KEY` - Data encryption
- [x] `FRONTEND_URL` - Your Vercel frontend URL
- [x] `STRIPE_SECRET_KEY` - Payment processing
- [x] `STRIPE_PRO_PRICE_ID` - Stripe product IDs
- [x] `STRIPE_ENTERPRISE_PRICE_ID` - Stripe product IDs
- [x] `SENTRY_DSN` - Error tracking (optional)

**Deployment Tokens (Add if missing):**
- [ ] `GITHUB_TOKEN` - For GitHub repo creation
- [ ] `VERCEL_TOKEN` - For Vercel deployments

**OAuth (If using plugins):**
- [ ] `GOOGLE_CLIENT_ID` - Google OAuth
- [ ] `GOOGLE_CLIENT_SECRET` - Google OAuth
- [ ] `GITHUB_CLIENT_ID` - GitHub OAuth (different from GITHUB_TOKEN)
- [ ] `GITHUB_CLIENT_SECRET` - GitHub OAuth (different from GITHUB_TOKEN)

---

### Vercel (Frontend) Environment Variables

**Required:**
- [x] `VITE_SENTRY_DSN` - Frontend error tracking (optional)

**NOT Needed:**
- ❌ `GITHUB_TOKEN` - Backend only
- ❌ `VERCEL_TOKEN` - Backend only

---

## 🔍 How to Check What's Missing

### Check Render (Backend)

1. Go to Render Dashboard → Your Backend Service → Environment
2. Look for:
   - `GITHUB_TOKEN` - Should start with `ghp_`
   - `VERCEL_TOKEN` - Should be a long token string

### Check Vercel (Frontend)

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Should NOT have:
   - `GITHUB_TOKEN` (remove if present - it's not needed)
   - `VERCEL_TOKEN` (remove if present - it's not needed)

---

## 🚀 Adding Missing Tokens to Render

### Step 1: Get GitHub Token

1. Go to https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Name: `AI Library - Production Deployments`
4. Expiration: **90 days** or **No expiration**
5. Scopes:
   - ✅ **repo** (Full control of private repositories)
   - ✅ **workflow** (Update GitHub Action workflows)
6. Click **"Generate token"**
7. **Copy token** (starts with `ghp_`)

### Step 2: Get Vercel Token

1. Go to https://vercel.com/account/tokens
2. Click **"Create Token"**
3. Name: `AI Library Deployments`
4. Expiration: **90 days** or **No expiration**
5. Click **"Create"**
6. **Copy token**

### Step 3: Add to Render

1. Go to Render Dashboard
2. Select your backend service
3. Go to **Environment** tab
4. Click **"Add Environment Variable"**
5. Add:
   - Key: `GITHUB_TOKEN`
   - Value: `ghp_your_token_here`
6. Click **"Add Environment Variable"** again
7. Add:
   - Key: `VERCEL_TOKEN`
   - Value: `your_vercel_token_here`
8. **Redeploy** your service (Render will auto-redeploy)

---

## 🧪 Testing After Adding Tokens

### Test Deployment Service

After adding tokens, test the deployment endpoint:

```bash
# Check deployment status
curl https://your-backend-url.com/api/deployment/status

# Should return:
{
  "githubConfigured": true,
  "vercelConfigured": true,
  "capabilities": {
    "githubRepo": true,
    "vercelDeployment": true,
    "customDomains": true
  }
}
```

### Test from Frontend

1. Go to your app
2. Navigate to deployment page (if available)
3. Try creating a deployment
4. Should work without errors

---

## 📝 Summary

**What You Need to Do:**

1. ✅ **Check Render** - Verify `GITHUB_TOKEN` and `VERCEL_TOKEN` are set
2. ✅ **Add if missing** - Follow steps above to get and add tokens
3. ✅ **Verify Vercel** - Make sure these tokens are NOT in Vercel (they're not needed there)
4. ✅ **Redeploy** - Render will auto-redeploy after adding env vars

**These tokens are BACKEND ONLY** - They're used by your backend API to:
- Create GitHub repositories
- Deploy to Vercel
- Manage deployments

**Frontend doesn't need them** - The frontend calls your backend API, which uses these tokens internally.

---

## 🔒 Security Notes

- ✅ Tokens are stored securely in Render (encrypted)
- ✅ Never commit tokens to Git
- ✅ Tokens are only accessible to backend code
- ✅ Frontend never sees these tokens

---

**Last Updated:** January 2025


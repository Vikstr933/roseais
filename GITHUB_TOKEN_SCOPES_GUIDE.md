# 🔑 GitHub Token Scopes Guide

**For Creating Repositories & Deployments**

---

## ✅ Option 1: Classic Token (Recommended - Easiest)

### Steps:
1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Name: `AI Library - Production Deployments`
4. Expiration: 90 days or No expiration
5. **Select ONE scope:**
   - ✅ **`repo`** - Full control of private repositories
     - This includes EVERYTHING you need:
       - Create repositories ✅
       - Push code ✅
       - Create branches ✅
       - Create pull requests ✅
       - Manage issues ✅
       - Everything else ✅

6. Click **"Generate token"**
7. Copy token (starts with `ghp_`)

**That's it!** The `repo` scope includes all permissions needed.

---

## ⚙️ Option 2: Fine-Grained Token (More Control)

If you prefer fine-grained tokens for better security:

### Required Permissions:

**Repository Permissions:**
- ✅ **Metadata** (Required) - Always included
- ✅ **Contents** - Repository contents, commits, branches, downloads, releases, and merges
  - **This is REQUIRED** for creating repos and pushing files

**Optional (Recommended):**
- ✅ **Pull requests** - If you want PR functionality
- ✅ **Workflows** - If you want GitHub Actions
- ✅ **Issues** - If you want issue management
- ✅ **Deployments** - For deployment status

### Steps:
1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (fine-grained)"**
3. Name: `AI Library - Production Deployments`
4. Expiration: 90 days or No expiration
5. **Repository access:**
   - Select **"All repositories"** (or specific repos)
6. **Repository permissions:**
   - ✅ **Contents** - Read and write
   - ✅ **Metadata** - Read-only (required)
   - ✅ **Pull requests** - Read and write (optional)
   - ✅ **Workflows** - Read and write (optional)
7. Click **"Generate token"**
8. Copy token (starts with `github_pat_`)

---

## 📋 Quick Comparison

| Feature | Classic Token | Fine-Grained Token |
|---------|---------------|-------------------|
| **Ease** | ✅ Easier | ⚠️ More complex |
| **Scope** | `repo` (all-in-one) | Select individual permissions |
| **Security** | ⚠️ Broader access | ✅ More granular |
| **Token Format** | `ghp_...` | `github_pat_...` |
| **Recommended** | ✅ **YES** | ⚠️ If you need granular control |

---

## 🎯 What You Need for Deployment

**Minimum Required:**
- ✅ Create repositories
- ✅ Push files to repositories
- ✅ Create branches
- ✅ Read repository contents

**All included in:**
- Classic token: `repo` scope ✅
- Fine-grained token: `Contents` permission ✅

---

## ✅ Recommended: Use Classic Token

**Why?**
- ✅ Simpler setup
- ✅ One scope (`repo`) covers everything
- ✅ Less configuration
- ✅ Works perfectly for deployments

**Steps:**
1. Classic token
2. Select `repo` scope
3. Done!

---

## 🔧 Update Token in Render

After creating token:

1. **Render Dashboard** → Your Backend Service → **Environment**
2. Find `GITHUB_TOKEN`
3. **Edit** → Paste new token → **Save**
4. Render auto-redeploys (~2-3 minutes)

---

## 🧪 Test Token

```bash
# Test your token (replace YOUR_TOKEN)
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user

# Should return your user info
```

---

## 📝 Summary

**For deployments, use:**
- ✅ **Classic token** with `repo` scope (easiest)
- OR **Fine-grained token** with `Contents` permission

**Both work!** Classic token is simpler and recommended.

---

**Last Updated:** January 2025


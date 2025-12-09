# 🔧 GitHub Token Permissions Fix

**Error:** `Resource not accessible by personal access token`  
**Status:** ⚠️ **GitHub token missing required scopes**

---

## 🔴 Problem

Your GitHub token doesn't have the required permissions to create repositories.

**Error Details:**
- `POST /user/repos - 403`
- "Resource not accessible by personal access token"
- Missing `repo` scope

---

## ✅ Solution: Update GitHub Token

### Step 1: Check Current Token

Your token is in Render → Environment Variables → `GITHUB_TOKEN`

### Step 2: Create New Token with Correct Scopes

1. **Go to GitHub Token Settings:**
   - https://github.com/settings/tokens
   - Or: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)

2. **Create New Token:**
   - Click **"Generate new token"** → **"Generate new token (classic)"**
   - Name: `AI Library - Production Deployments`
   - Expiration: **90 days** or **No expiration**

3. **Select Required Scopes:**
   - ✅ **repo** (Full control of private repositories)
     - This is REQUIRED for creating repos
     - Includes: `repo:status`, `repo_deployment`, `public_repo`, `repo:invite`, `security_events`
   - ✅ **workflow** (Update GitHub Action workflows) - Optional but recommended
   - ✅ **write:packages** (Upload packages) - Optional
   - ✅ **read:org** (Read org and team membership) - Optional

4. **Generate Token:**
   - Click **"Generate token"**
   - **COPY THE TOKEN IMMEDIATELY** (you won't see it again!)
   - Token starts with `ghp_`

### Step 3: Update Token in Render

1. **Go to Render Dashboard:**
   - https://dashboard.render.com
   - Select your backend service
   - Go to **Environment** tab

2. **Update GITHUB_TOKEN:**
   - Find `GITHUB_TOKEN` in the list
   - Click **Edit** (or delete and recreate)
   - Paste your new token
   - Click **Save Changes**

3. **Redeploy:**
   - Render will auto-redeploy
   - Or manually trigger: **Manual Deploy** → **Deploy latest commit**

---

## 🔍 Verify Token Permissions

### Check Token Scopes (via API):

```bash
# Test your token (replace YOUR_TOKEN)
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user

# Should return your user info
```

### Check Token Permissions:

```bash
# Check what scopes your token has
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user -I

# Look for: X-OAuth-Scopes: repo, workflow, ...
```

---

## 📋 Required Scopes Checklist

**Minimum Required:**
- ✅ **repo** - Full control of private repositories
  - This includes: `public_repo`, `repo:status`, `repo_deployment`, etc.

**Recommended:**
- ✅ **workflow** - Update GitHub Action workflows
- ✅ **write:packages** - Upload packages
- ✅ **read:org** - Read org and team membership

---

## 🚨 Common Issues

### Issue 1: Token Missing `repo` Scope

**Symptom:** 403 error when creating repos

**Solution:**
- Create new token with `repo` scope
- Update in Render

### Issue 2: Token Expired

**Symptom:** 401 Unauthorized

**Solution:**
- Create new token
- Update in Render

### Issue 3: Token for Wrong Account

**Symptom:** Repos created in wrong account

**Solution:**
- Make sure token is from the GitHub account you want repos in
- Usually your personal account (`Vikstr933`)

### Issue 4: Organization Restrictions

**Symptom:** 403 even with correct scopes

**Solution:**
- Check if your GitHub account has organization restrictions
- May need to approve token in organization settings

---

## ✅ Quick Fix Steps

1. **Create New Token:**
   ```
   GitHub → Settings → Developer settings → Personal access tokens
   → Generate new token (classic)
   → Select "repo" scope
   → Generate
   ```

2. **Copy Token:**
   ```
   ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. **Update in Render:**
   ```
   Render Dashboard → Your Service → Environment
   → Edit GITHUB_TOKEN
   → Paste new token
   → Save
   ```

4. **Wait for Redeploy:**
   ```
   Render will auto-redeploy (~2-3 minutes)
   ```

5. **Test Deployment:**
   ```
   Try deploying again - should work now!
   ```

---

## 🔒 Security Best Practices

1. **Use Fine-Grained Tokens (if available):**
   - More secure than classic tokens
   - Can limit to specific repos

2. **Set Expiration:**
   - Don't use "No expiration" unless necessary
   - 90 days is good for production

3. **Rotate Regularly:**
   - Update tokens every 90 days
   - Immediately if compromised

4. **Limit Scopes:**
   - Only grant what's needed
   - Don't grant unnecessary permissions

---

## 📝 Token Scope Reference

| Scope | Required | Purpose |
|-------|----------|---------|
| `repo` | ✅ **YES** | Create/manage repositories |
| `workflow` | ⚠️ Optional | Update GitHub Actions |
| `write:packages` | ⚠️ Optional | Upload packages |
| `read:org` | ⚠️ Optional | Read organization info |

---

## 🧪 Test After Fix

Once you've updated the token, test deployment:

```bash
# The deployment should now work
# Check Render logs for success
```

**Expected Result:**
- ✅ Repository created successfully
- ✅ Files pushed to GitHub
- ✅ Vercel deployment triggered
- ✅ Production URL returned

---

## 📞 Still Having Issues?

If you still get 403 after updating token:

1. **Verify Token Format:**
   - Should start with `ghp_`
   - Should be ~40+ characters

2. **Check Token in Render:**
   - Make sure it's saved correctly
   - No extra spaces or quotes

3. **Verify Account:**
   - Token should be from the account you want repos in
   - Check GitHub account settings

4. **Check Rate Limits:**
   - GitHub API has rate limits
   - Check: https://api.github.com/rate_limit

---

**Last Updated:** January 2025  
**Status:** ⚠️ **Action Required** - Update GitHub token with `repo` scope


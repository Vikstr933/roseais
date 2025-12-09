# 🚀 Git & Deployment Setup Guide

Complete guide for pushing updates to GitHub and deploying to production.

## ✅ Current Status

- ✅ Git installed (v2.52.0)
- ✅ Repository connected to GitHub: `https://github.com/Vikstr933/vik.git`
- ⚠️ Git user configuration needed
- ⚠️ GitHub token needed for API access
- ⚠️ Vercel token needed for deployments

## Step 1: Configure Git (Required)

Set your Git identity (needed for commits):

```powershell
# Set your name (use your GitHub username or real name)
git config --global user.name "Your Name"

# Set your email (use your GitHub email)
git config --global user.email "your-email@example.com"
```

**Example:**
```powershell
git config --global user.name "Vikstr933"
git config --global user.email "vikstr933@example.com"
```

## Step 2: Get GitHub Personal Access Token (Required)

Your app needs a GitHub token to:
- Create repositories
- Push code
- Create pull requests
- Deploy to production

### Create Token:

1. Go to https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Name it: `AI Library - Production Deployments`
4. Set expiration: **90 days** (or No expiration for production)
5. Select these scopes:
   - ✅ **repo** (Full control of private repositories)
   - ✅ **workflow** (Update GitHub Action workflows)
   - ✅ **write:packages** (Upload packages)
   - ✅ **read:org** (Read org and team membership)
6. Click **"Generate token"**
7. **Copy the token immediately** (you won't see it again!)

### Add to .env:

Open `.env` and add:
```env
# GitHub Integration (Required for deployments)
GITHUB_TOKEN=ghp_your_actual_token_here
```

## Step 3: Get Vercel Token (Required for Deployments)

For automatic deployments to Vercel:

1. Go to https://vercel.com/account/tokens
2. Click **"Create Token"**
3. Name it: `AI Library Deployments`
4. Set expiration: **90 days** (or No expiration)
5. Click **"Create"**
6. **Copy the token**

### Add to .env:

```env
# Vercel Integration (Required for deployments)
VERCEL_TOKEN=your_vercel_token_here
```

## Step 4: Update .env File

Add these to your `.env` file:

```env
# ============================================================================
# Git & Deployment Configuration
# ============================================================================

# GitHub Personal Access Token (Required)
# Get from: https://github.com/settings/tokens
GITHUB_TOKEN=ghp_your_github_token_here

# Vercel Token (Required for deployments)
# Get from: https://vercel.com/account/tokens
VERCEL_TOKEN=your_vercel_token_here

# GitHub OAuth (Optional - for user GitHub integration)
# GITHUB_CLIENT_ID=your_github_oauth_client_id
# GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
# GITHUB_REDIRECT_URI=http://localhost:3001/api/plugins/github/callback
```

## Step 5: Test Git Configuration

```powershell
# Verify Git config
git config --global user.name
git config --global user.email

# Test GitHub connection
git remote -v

# Check current status
git status
```

## Step 6: Push Updates to GitHub

### Basic Workflow:

```powershell
# 1. Check what changed
git status

# 2. Add files to staging
git add .

# Or add specific files:
git add .env
git add NEW_COMPUTER_SETUP.md

# 3. Commit with a message
git commit -m "Add setup documentation and environment configuration"

# 4. Push to GitHub
git push origin main
```

### Example: Push Your Current Changes

```powershell
# Set PATH (if needed)
$env:Path = "C:\Program Files\nodejs;" + $env:Path

# Add new files
git add NEW_COMPUTER_SETUP.md
git add .env

# Commit
git commit -m "Setup: Add new computer setup guide and environment config"

# Push
git push origin main
```

## Step 7: Deploy to Production

### Option A: Automatic Deployment (Recommended)

Your app has built-in deployment features. Once configured:

1. **Generate code** in the playground
2. **Click "Deploy"** button
3. App will:
   - Create GitHub repository
   - Push code to GitHub
   - Deploy to Vercel
   - Return production URL

### Option B: Manual Deployment

#### Deploy via API:

```powershell
# Example: Deploy generated code
curl -X POST http://localhost:3001/api/deploy `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -d '{
    "projectName": "my-app",
    "repoName": "my-app",
    "description": "AI-generated app",
    "isPrivate": false,
    "files": [...]
  }'
```

## Common Git Commands

### Daily Workflow:

```powershell
# Check status
git status

# See what changed
git diff

# Add all changes
git add .

# Commit
git commit -m "Description of changes"

# Push
git push origin main

# Pull latest changes
git pull origin main
```

### Branch Management:

```powershell
# Create new branch
git checkout -b feature/new-feature

# Switch branches
git checkout main

# Merge branch
git checkout main
git merge feature/new-feature

# Delete branch
git branch -d feature/new-feature
```

### Undo Changes:

```powershell
# Undo uncommitted changes
git restore .

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1
```

## Deployment Features

### What Your App Can Do:

1. **Create GitHub Repositories**
   - Automatically create repos for generated code
   - Set up initial commit with all files

2. **Push Code**
   - Commit generated components
   - Push to main or feature branches

3. **Create Pull Requests**
   - Auto-generate PR descriptions
   - Link to related issues

4. **Deploy to Vercel**
   - One-click deployment
   - Automatic environment variables
   - Custom domain support

5. **Track Deployments**
   - View deployment history
   - Monitor deployment status
   - Access production URLs

## Security Best Practices

### ⚠️ Important:

1. **Never commit `.env` file**
   - Already in `.gitignore` ✅
   - Contains secrets and API keys

2. **Use environment-specific tokens**
   - Development: Limited scope tokens
   - Production: Full access tokens

3. **Rotate tokens regularly**
   - Every 90 days recommended
   - Immediately if compromised

4. **Use branch protection**
   - Protect `main` branch
   - Require PR reviews
   - Enable status checks

## Troubleshooting

### "Permission denied" when pushing

**Solution:**
```powershell
# Check if you're authenticated
git config --global credential.helper wincred

# Or use SSH instead of HTTPS
git remote set-url origin git@github.com:Vikstr933/vik.git
```

### "GITHUB_TOKEN is not set"

**Solution:**
- Check `.env` file exists
- Verify `GITHUB_TOKEN` is set
- Restart dev server after adding token

### "Failed to create repository"

**Solution:**
- Verify GitHub token has `repo` scope
- Check token hasn't expired
- Ensure repository name is unique

### "Vercel deployment failed"

**Solution:**
- Verify `VERCEL_TOKEN` is set
- Check Vercel project exists
- Ensure GitHub repo is connected to Vercel

## Quick Reference

### Essential Commands:

```powershell
# Setup (one-time)
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# Daily workflow
git add .
git commit -m "Your message"
git push origin main

# Check status
git status
git log --oneline -5
```

### Environment Variables Needed:

```env
GITHUB_TOKEN=ghp_...          # Required
VERCEL_TOKEN=...              # Required for deployments
ANTHROPIC_API_KEY=sk-ant-...  # Required for code generation
DATABASE_URL=postgresql://...  # Required
```

## Next Steps

1. ✅ Configure Git user name/email
2. ✅ Get GitHub Personal Access Token
3. ✅ Get Vercel Token
4. ✅ Add tokens to `.env`
5. ✅ Test pushing to GitHub
6. ✅ Test deployment feature

## 🎉 You're Ready!

Once configured, you can:
- ✅ Push code updates to GitHub
- ✅ Deploy generated apps to production
- ✅ Create repositories automatically
- ✅ Manage deployments from the UI

Happy deploying! 🚀


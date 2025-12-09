# 🔧 Environment Setup Guide

## Current Status

Your application is **90% ready**! You just need to configure environment variables.

### ✅ What's Already Set Up:
- Database schema with 12 migrations ready
- All dependencies installed (150+ packages)
- Complete frontend & backend code
- Authentication system with role-based access
- 22 API routes, 18 services, 5 middleware
- Beautiful UI with 80+ React components

### ⚠️ What's Missing:
- **`.env` file with configuration**

---

## 📋 Step-by-Step Setup

### Step 1: Create `.env` File

Create a file named `.env` in your project root (same directory as `package.json`).

Copy and paste this template:

```env
# =============================================================================
# CRITICAL - REQUIRED FOR APP TO START
# =============================================================================

# PostgreSQL Database (Supabase)
# Get this from: https://app.supabase.com/project/_/settings/database
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT].supabase.co:5432/postgres

# =============================================================================
# AI API KEYS - REQUIRED FOR CODE GENERATION
# =============================================================================

# Anthropic Claude API (Primary)
# Get from: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-api03-...

# OpenAI API (Optional - for additional models)
# Get from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-...

# =============================================================================
# SECURITY & SESSION MANAGEMENT
# =============================================================================

# Session Secret (Generate a random 32+ character string)
SESSION_SECRET=your-super-secret-session-key-here-minimum-32-characters

# API Key Encryption (Generate a random 32+ character string)
ENCRYPTION_KEY=your-encryption-key-here-minimum-32-characters
API_KEY_ENCRYPTION_KEY=your-api-key-encryption-key-here-minimum-32-characters

# =============================================================================
# CLOUDFLARE R2 STORAGE (For file uploads & deployments)
# =============================================================================

R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=builder

# =============================================================================
# MONITORING & ERROR TRACKING (Optional but Recommended)
# =============================================================================

# SENTRY_DSN=https://[key]@[org].ingest.sentry.io/[project]

# =============================================================================
# RATE LIMITING (Optional but Recommended for Production)
# =============================================================================

# UPSTASH_REDIS_REST_URL=https://[your-endpoint].upstash.io
# UPSTASH_REDIS_REST_TOKEN=your-token-here

# =============================================================================
# PAYMENT PROCESSING (Optional)
# =============================================================================

# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...

# =============================================================================
# COST MONITORING & LIMITS (Optional)
# =============================================================================

DAILY_COST_LIMIT=100
MONTHLY_COST_LIMIT=2000
USER_DAILY_COST_LIMIT=10
USER_MONTHLY_COST_LIMIT=100

# =============================================================================
# SERVER CONFIGURATION
# =============================================================================

PORT=3001
NODE_ENV=development
```

---

## 🔑 Where to Get Each API Key

### 1. **DATABASE_URL** (REQUIRED)

**Option A: Supabase (Recommended - Free tier)**
1. Go to https://supabase.com/
2. Create account & new project
3. Go to Settings → Database
4. Copy the "Connection String" (URI)
5. Replace `[YOUR-PASSWORD]` with your database password

**Option B: Neon (Alternative - Free tier)**
1. Go to https://neon.tech/
2. Create project
3. Copy connection string

### 2. **ANTHROPIC_API_KEY** (REQUIRED)
1. Go to https://console.anthropic.com/
2. Sign up/login
3. Go to "API Keys"
4. Create new key
5. Copy the key (starts with `sk-ant-api03-`)

### 3. **Security Keys** (REQUIRED)

Generate random strings for:
- `SESSION_SECRET`
- `ENCRYPTION_KEY`
- `API_KEY_ENCRYPTION_KEY`

**Easy way to generate (in PowerShell):**
```powershell
# Generate 3 random keys
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Or use an online generator: https://randomkeygen.com/

### 4. **Cloudflare R2** (REQUIRED for file uploads)

1. Go to https://dash.cloudflare.com/
2. Sign up/login
3. Go to "R2" in left sidebar
4. Click "Create bucket" → Name it "builder"
5. Go to "Manage R2 API Tokens"
6. Create API token with "Admin Read & Write" permissions
7. Copy:
   - Account ID
   - Access Key ID
   - Secret Access Key

### 5. **Optional Services**

#### Sentry (Error Tracking)
1. Go to https://sentry.io/
2. Create project
3. Copy DSN

#### Upstash Redis (Rate Limiting)
1. Go to https://console.upstash.com/
2. Create Redis database
3. Copy REST URL and token

#### Stripe (Payments)
1. Go to https://dashboard.stripe.com/
2. Get API keys from Developers section

---

## 🚀 Quick Start (Minimum Required)

**For local development, you only need these 4 things:**

1. **DATABASE_URL** - From Supabase
2. **ANTHROPIC_API_KEY** - From Anthropic
3. **SESSION_SECRET** - Generate random string
4. **ENCRYPTION_KEY** - Generate random string

The rest can be added later!

---

## 📝 After Creating .env File

Run these commands:

```bash
# Install dependencies (if not done)
npm install

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

Your app will be available at:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001

---

## 🎯 Priority Order for Setup

### **Phase 1: Get it Running (Required)**
1. ✅ DATABASE_URL (Supabase)
2. ✅ ANTHROPIC_API_KEY
3. ✅ SESSION_SECRET
4. ✅ ENCRYPTION_KEY

### **Phase 2: Full Features (Recommended)**
5. ✅ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
6. ✅ SENTRY_DSN

### **Phase 3: Production Ready (Optional)**
7. ✅ UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
8. ✅ STRIPE_SECRET_KEY (if using payments)

---

## 🆘 Troubleshooting

### "DATABASE_URL is not set"
- Make sure `.env` file exists in project root
- Check that `DATABASE_URL` line has no spaces before/after `=`

### "Failed to connect to PostgreSQL"
- Verify connection string format
- Check if database password is correct
- Ensure Supabase project is active

### "Rate limited"
- Without Redis, rate limiting uses in-memory storage (works fine for development)
- Add Upstash Redis for production

---

## 📖 Additional Resources

- [PRODUCTION_CONFIG.md](./PRODUCTION_CONFIG.md) - Full production setup guide
- [POSTGRESQL_MIGRATION.md](./POSTGRESQL_MIGRATION.md) - Database migration details
- [R2_SETUP.md](./R2_SETUP.md) - Cloudflare R2 setup guide
- [SENTRY_SETUP.md](./SENTRY_SETUP.md) - Sentry error tracking setup

---

## ✅ Checklist

- [ ] Created `.env` file
- [ ] Added DATABASE_URL from Supabase
- [ ] Added ANTHROPIC_API_KEY
- [ ] Generated and added SESSION_SECRET
- [ ] Generated and added ENCRYPTION_KEY
- [ ] Ran `npm install`
- [ ] Ran `npm run migrate`
- [ ] Started dev server with `npm run dev`
- [ ] Logged in at http://localhost:5173
- [ ] (Optional) Set up Cloudflare R2
- [ ] (Optional) Set up Sentry
- [ ] (Optional) Set up Upstash Redis

Once all checked, you're ready for production! 🎉


# Production Configuration Guide

This guide will help you configure the application for production deployment with real Supabase database and Cloudflare R2 storage.

## Environment Variables

Create a `.env` file in the root directory with the following configuration:

```env
# Environment
NODE_ENV=production

# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres

# Supabase
VITE_SUPABASE_URL=https://[PROJECT_REF].supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Cloudflare R2 Storage
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://your-bucket.r2.dev

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://[YOUR_REDIS].upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token_here

# AI API Keys
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# OAuth (Optional)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Monitoring
SENTRY_DSN=your_sentry_dsn_here

# Payments (Stripe)
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Security
PORT=3001
SESSION_SECRET=generate_a_secure_random_string_min_32_chars
JWT_SECRET=generate_a_secure_random_string_min_32_chars

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

## Setup Steps

### 1. Supabase Database Setup

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Create a new project or select existing
3. Go to Settings > Database
4. Copy your connection string (replace [PASSWORD] with your actual password)
5. Run migrations:
   ```bash
   npm run migrate
   ```

### 2. Cloudflare R2 Setup

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to R2 Object Storage
3. Create a bucket
4. Generate API tokens (Access Key ID & Secret)
5. Configure public access if needed

### 3. Redis Setup (Upstash)

1. Go to [Upstash Console](https://console.upstash.com/)
2. Create a new Redis database
3. Copy REST URL and Token

### 4. Deploy Application

```bash
# Build the application
npm run build

# Start production server
npm start
```

## Security Checklist

- [ ] All environment variables are set
- [ ] Database backups are configured
- [ ] SSL/TLS is enabled
- [ ] CORS origins are properly configured
- [ ] Rate limiting is enabled
- [ ] Sentry monitoring is configured
- [ ] Session secrets are strong and unique

## Recent Updates

- ✅ Fixed authentication persistence (no more logout on refresh)
- ✅ Added role field to users table
- ✅ Granted superadmin access to Viktorstrindin93@gmail.com
- ✅ Activated Sessions feature in playground
- ✅ Fixed database schema mismatches
- ✅ Added floating horizontal navigation


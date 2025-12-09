# Redis Setup Guide (Upstash)

## Why Upstash Redis?

Upstash Redis is perfect for serverless environments because:
- ✅ **Serverless-first** - Pay per request, no idle costs
- ✅ **Global edge network** - Low latency worldwide
- ✅ **REST API** - Works in any environment (no TCP required)
- ✅ **Durable** - Data persists across deployments
- ✅ **Simple** - No infrastructure to manage

## Setup Instructions

### 1. Create Upstash Account

1. Go to [upstash.com](https://upstash.com/)
2. Sign up for free (generous free tier)
3. Create a new Redis database

### 2. Get Your Credentials

After creating your database, you'll see:
- **UPSTASH_REDIS_REST_URL** - e.g., `https://your-db.upstash.io`
- **UPSTASH_REDIS_REST_TOKEN** - Your API token

### 3. Add to Environment Variables

Add these to your `.env` file:

```bash
# Upstash Redis (Serverless)
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
```

### 4. Restart Your Server

```bash
npm run dev
```

You should see:
```
✅ Upstash Redis connected for rate limiting
```

## Rate Limits

### Free Tier Users
- **AI Calls**: 100 per hour
- **Builds**: 10 per minute  
- **API Requests**: 100 per minute

### Premium Users (Future)
- **AI Calls**: 1000 per hour
- **Builds**: 50 per minute
- **API Requests**: 1000 per minute

## Testing Rate Limits

```bash
# Get rate limit status
curl http://localhost:3001/api/test/rate-limit-status

# Test rate limiting
for i in {1..10}; do
  curl http://localhost:3001/api/test/rate-limit
done
```

## Fallback Behavior

If Redis is not configured:
- ⚠️ Falls back to **in-memory rate limiting**
- ⚠️ Limits are **per-server instance** (not shared)
- ⚠️ Limits **reset on server restart**
- ⚠️ **Not suitable for production**

## Production Deployment

For production (Vercel, Railway, etc.):
1. Add Upstash environment variables to your deployment platform
2. Redis will automatically be used
3. Rate limits work across all instances
4. No additional configuration needed

## Monitoring

Check your Upstash dashboard for:
- Request count
- Memory usage
- Response times
- Error rates

## Cost Estimation

Free tier includes:
- 10,000 commands per day
- 256 MB storage
- Global replication

Typical usage per user session:
- ~5 commands per AI generation
- ~2 commands per build
- ~1 command per API call

**Free tier = ~2,000 user sessions per day**


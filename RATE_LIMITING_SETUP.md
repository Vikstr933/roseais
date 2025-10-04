# Rate Limiting Implementation ✅

## Overview
We've successfully implemented Redis-based rate limiting to protect against abuse and control AI API costs.

## What Was Added

### 1. Rate Limiting Service (`server/services/RateLimitService.ts`)
- **AI Calls**: 100 requests per hour per user (free tier)
- **Builds**: 10 builds per minute per user
- **API Calls**: 100 requests per minute per user
- **Premium Support**: 1000 AI calls per hour for premium users

### 2. Middleware (`server/middleware/rateLimiting.ts`)
- `rateLimitAI` - Protects AI generation endpoints
- `rateLimitBuild` - Protects build/deployment endpoints
- `rateLimitAPI` - General API protection
- `getRateLimitStatus` - Check remaining quota

### 3. Applied to Routes
- `/prompts/generate` - Now rate limited ✅
- `/prompts/rate-limit-status` - New endpoint to check limits

## Setup Instructions

### Option 1: Local Development (Redis recommended)

1. **Install Redis locally**:
   ```bash
   # Windows (using Chocolatey)
   choco install redis-64
   
   # macOS
   brew install redis
   brew services start redis
   
   # Linux
   sudo apt-get install redis-server
   sudo systemctl start redis
   ```

2. **Add to your `.env` file**:
   ```bash
   REDIS_URL=redis://localhost:6379
   ```

3. **Restart your server**:
   ```bash
   npm run dev:server
   ```

### Option 2: Cloud Redis (Production)

Use a hosted Redis service:

**Upstash (Recommended - Free tier available)**:
1. Sign up at https://upstash.com
2. Create a Redis database
3. Copy the connection URL
4. Add to `.env`:
   ```bash
   REDIS_URL=rediss://[username]:[password]@[host]:[port]
   ```

**Redis Cloud**:
1. Sign up at https://redis.com/try-free
2. Create a database
3. Get connection details
4. Add to `.env`

**AWS ElastiCache** (for production scale):
```bash
REDIS_URL=redis://your-elasticache-endpoint:6379
```

### Option 3: No Redis (Development Only)
If you don't set `REDIS_URL`, the system will use **in-memory rate limiting**.
⚠️ **WARNING**: This is NOT suitable for production as limits reset on server restart!

## Rate Limits

### Free Tier (Default)
| Resource | Limit | Window | Block Duration |
|----------|-------|--------|----------------|
| AI Calls | 100 | 1 hour | 5 minutes |
| Builds | 10 | 1 minute | 1 minute |
| API Calls | 100 | 1 minute | 1 minute |

### Premium Tier (Future)
| Resource | Limit | Window | Block Duration |
|----------|-------|--------|----------------|
| AI Calls | 1000 | 1 hour | 5 minutes |
| Builds | 50 | 1 minute | 1 minute |
| API Calls | 500 | 1 minute | 1 minute |

## API Response Headers

Rate limit info is included in response headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 3542 (seconds until reset)
```

## Check Rate Limit Status

**Endpoint**: `GET /api/prompts/rate-limit-status`

**Response**:
```json
{
  "aiCalls": {
    "remaining": 95,
    "total": 100,
    "resetIn": 3542
  },
  "isPremium": false
}
```

## Error Responses

When rate limit is exceeded:
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many AI requests. Please try again in 247 seconds.",
  "type": "RATE_LIMIT_ERROR"
}
```

HTTP Status: `429 Too Many Requests`

## Testing Rate Limits

### Test AI Rate Limit
```bash
# Make 101 requests to trigger rate limit
for i in {1..101}; do
  curl -X POST http://localhost:3001/api/prompts/generate \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{"userPrompt": "test", "systemPrompt": "test"}'
done
```

### Check Status
```bash
curl http://localhost:3001/api/prompts/rate-limit-status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Admin Functions

Reset rate limits for a specific user (future admin endpoint):
```typescript
await rateLimitService.resetLimits('user:123');
```

## Cost Protection

**Before Rate Limiting**:
- ❌ Unlimited AI calls
- ❌ Cost: Unpredictable ($0 - $10,000+/month)
- ❌ Vulnerable to abuse

**After Rate Limiting**:
- ✅ Max 100 AI calls/hour per user
- ✅ Cost: Predictable (~$150-$200/month for 1000 users)
- ✅ Protected against abuse
- ✅ Can scale to premium tiers

## Future Enhancements

1. **Premium Tier Detection**
   - Check user subscription status
   - Apply higher limits automatically

2. **Dynamic Limits**
   - Adjust based on usage patterns
   - Burst allowance for occasional heavy users

3. **Admin Dashboard**
   - View rate limit violations
   - Temporarily increase limits
   - Block abusive users

4. **Analytics**
   - Track limit hits
   - Identify popular features
   - Optimize pricing tiers

## Monitoring

Check Redis health:
```bash
# Connect to Redis CLI
redis-cli

# Check memory usage
INFO memory

# Check connected clients
CLIENT LIST

# Monitor commands in real-time
MONITOR
```

## Troubleshooting

### Rate limits not working?
1. Check if Redis is running: `redis-cli ping` (should return `PONG`)
2. Verify `REDIS_URL` in `.env`
3. Check server logs for connection errors
4. Try restarting Redis and your server

### Users getting rate limited too quickly?
- Increase limits in `RateLimitService.ts`
- Consider adding burst allowance
- Implement premium tiers

### Memory usage growing?
- Rate limit data is automatically cleaned up
- Set TTL on Redis keys
- Monitor with `INFO memory`

## Summary

✅ **Step 1 (Rate Limiting) - COMPLETE!**

Next steps:
- Step 2: Add Sentry error tracking
- Step 3: Add Zod input validation
- Step 4: Migrate to PostgreSQL

**Cost Protection**: You're now protected from unlimited AI costs! 🎉


# 🟢 Issue #5: Sentry Configuration - SETUP GUIDE

**Priority:** 🟢 **LOW** (Optional but Recommended)  
**Status:** ⚠️ **Needs Configuration**  
**Impact:** Error tracking disabled without DSNs

---

## Current Status

✅ **Sentry is fully implemented** in both backend and frontend:
- Backend: `server/services/SentryService.ts` ✅
- Frontend: `client/src/services/SentryService.ts` ✅
- Middleware: `server/middleware/sentry.ts` ✅
- Integration: Already initialized in `server/index.ts` and `client/src/main.tsx` ✅

⚠️ **Missing Configuration:**
- `SENTRY_DSN` (backend) - Not set in `.env`
- `VITE_SENTRY_DSN` (frontend) - Not set in `.env`

**Current Behavior:**
- Services gracefully handle missing DSNs
- They log warnings but don't crash
- Error tracking is simply disabled

---

## What Sentry Provides

### Benefits
- ✅ **Error Tracking**: Automatic error capture and reporting
- ✅ **Performance Monitoring**: Track slow API endpoints
- ✅ **User Context**: See which users are affected
- ✅ **Release Tracking**: Track errors by version
- ✅ **Session Replay** (Frontend): Watch user sessions before errors
- ✅ **Alerts**: Get notified of critical errors
- ✅ **Breadcrumbs**: See what happened before the error

### Free Tier
- 5,000 errors/month
- 10,000 performance transactions/month
- 1,000 session replays/month
- Perfect for development and small production apps

---

## Setup Instructions

### Step 1: Create Sentry Account (5 minutes)

1. Go to https://sentry.io/signup/
2. Sign up (free tier available)
3. Choose your organization name

### Step 2: Create Projects

#### Backend Project (Node.js)
1. Click **"Create Project"**
2. Select **"Node.js"**
3. Name it: `rest-express-backend` (or your choice)
4. Click **"Create Project"**
5. **Copy the DSN** - looks like: `https://abc123@o123456.ingest.sentry.io/789012`

#### Frontend Project (React)
1. Click **"Create Project"** again
2. Select **"React"**
3. Name it: `rest-express-frontend` (or your choice)
4. Click **"Create Project"**
5. **Copy the DSN**

### Step 3: Add DSNs to .env

Add these lines to your `.env` file:

```env
# ============================================================================
# Sentry Error Tracking
# ============================================================================
# Backend DSN (from Node.js project)
SENTRY_DSN=https://your-backend-dsn@sentry.io/your-project-id

# Frontend DSN (from React project)
VITE_SENTRY_DSN=https://your-frontend-dsn@sentry.io/your-project-id

# Optional: App version for release tracking
VITE_APP_VERSION=1.0.0
```

**Example:**
```env
SENTRY_DSN=https://abc123def456@o123456.ingest.sentry.io/789012345
VITE_SENTRY_DSN=https://xyz789ghi012@o123456.ingest.sentry.io/345678901
VITE_APP_VERSION=1.0.1
```

### Step 4: Restart Dev Server

```powershell
# Stop server (Ctrl+C)
npm run dev
```

You should see:
```
✅ Sentry error tracking initialized
✅ Frontend Sentry initialized
```

If DSNs are missing, you'll see warnings (but app still works):
```
⚠️ SENTRY_DSN not set. Error tracking disabled.
⚠️ VITE_SENTRY_DSN not set. Frontend error tracking disabled.
```

---

## Testing Sentry

### Test Backend Error Tracking

Create a test endpoint or add to any route:

```typescript
// server/routes/test.ts (or add to existing route)
import { Router } from 'express';
import { sentryService } from '../services/SentryService';

const router = Router();

router.get('/test-error', (req, res) => {
  try {
    throw new Error('Test error for Sentry backend');
  } catch (error) {
    sentryService.captureException(error as Error, {
      test: true,
      endpoint: '/test-error'
    });
    res.status(500).json({ error: 'Test error sent to Sentry' });
  }
});
```

Then visit: `http://localhost:3001/api/test-error`

Check Sentry dashboard - you should see the error appear within seconds!

### Test Frontend Error Tracking

Add a test button to any component:

```typescript
import { frontendSentryService } from '../services/SentryService';

function TestButton() {
  const handleError = () => {
    try {
      throw new Error('Test error for Sentry frontend');
    } catch (error) {
      frontendSentryService.captureException(error as Error, {
        component: 'TestButton',
        userAction: 'click'
      });
    }
  };

  return <button onClick={handleError}>Test Sentry</button>;
}
```

Click the button, then check Sentry dashboard!

---

## Configuration Details

### Backend Configuration

**File:** `server/services/SentryService.ts`

**Current Settings:**
- ✅ Enabled only in production (`NODE_ENV=production`)
- ✅ 10% trace sampling in production (100% in dev)
- ✅ Ignores common network errors
- ✅ Redacts sensitive data (cookies, auth headers)

**To Enable in Development:**
Change line 39:
```typescript
enabled: true, // Instead of: process.env.NODE_ENV === 'production'
```

### Frontend Configuration

**File:** `client/src/services/SentryService.ts`

**Current Settings:**
- ✅ Enabled in both dev and production
- ✅ 10% trace sampling in production
- ✅ Session replay: 10% of sessions, 100% of error sessions
- ✅ Redacts sensitive data (tokens)

---

## Sentry Dashboard Features

### 1. Issues Tab
- View all errors
- See frequency and affected users
- Group similar errors
- Mark as resolved

### 2. Performance Tab
- Track slow API endpoints
- See database query performance
- Identify bottlenecks
- Compare releases

### 3. Releases Tab
- Track errors by version
- See which release introduced bugs
- Compare releases
- Deploy tracking

### 4. Alerts
Set up alerts for:
- New error types
- Error spike (10+ errors in 5 minutes)
- Performance regression
- Slow endpoints (>1s)

### 5. Session Replay (Frontend Only)
- Watch user sessions
- See exactly what user did before error
- Replay mouse movements, clicks, inputs
- Debug UI issues easily

---

## Best Practices

### 1. Don't Over-Log
❌ **Bad:**
```typescript
sentryService.captureException(error, { entireRequest: req.body });
```

✅ **Good:**
```typescript
sentryService.captureException(error, {
  endpoint: req.path,
  method: req.method,
  userId: req.user?.id
});
```

### 2. Add Context
```typescript
sentryService.captureException(error, {
  userId: user.id,
  action: 'generate_code',
  projectId: project.id
});
```

### 3. Set User Context
```typescript
// When user logs in
sentryService.setUser(user.id, user.email, user.username);

// When user logs out
sentryService.clearUser();
```

### 4. Use Breadcrumbs
```typescript
sentryService.addBreadcrumb(
  'User clicked generate button',
  'user-action',
  { prompt: userPrompt }
);
```

---

## Troubleshooting

### "Sentry not initialized" warnings

**Cause:** DSNs not set in `.env`

**Solution:**
1. Check `.env` file has `SENTRY_DSN` and `VITE_SENTRY_DSN`
2. Restart dev server
3. Check console for initialization messages

### Errors not appearing in Sentry

**Possible Causes:**
1. **Backend:** `NODE_ENV=production` required (or change `enabled: true`)
2. **Network:** Check firewall/proxy settings
3. **DSN:** Verify DSN is correct
4. **Rate Limiting:** Free tier has limits

**Debug:**
```typescript
// Check if Sentry is initialized
console.log('Sentry initialized:', sentryService.initialized);
```

### Too many errors (hitting rate limits)

**Solution:**
- Adjust sampling rates:
  ```typescript
  tracesSampleRate: 0.05, // 5% instead of 10%
  ```
- Filter out noisy errors:
  ```typescript
  ignoreErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'YourNoisyError'],
  ```

---

## Production Checklist

- [ ] Create Sentry account
- [ ] Create backend project (Node.js)
- [ ] Create frontend project (React)
- [ ] Add `SENTRY_DSN` to `.env`
- [ ] Add `VITE_SENTRY_DSN` to `.env`
- [ ] Test backend error tracking
- [ ] Test frontend error tracking
- [ ] Set up alerts for critical errors
- [ ] Configure release tracking
- [ ] Add user context on login
- [ ] Set up performance monitoring

---

## Optional: Advanced Configuration

### Custom Error Filtering

Edit `server/services/SentryService.ts`:

```typescript
beforeSend(event, hint) {
  // Don't send 404 errors
  if (event.status === 404) {
    return null;
  }
  
  // Don't send validation errors
  if (event.message?.includes('validation')) {
    return null;
  }
  
  return event;
}
```

### Environment-Specific Sampling

```typescript
tracesSampleRate: 
  process.env.NODE_ENV === 'production' ? 0.1 :  // 10% in prod
  process.env.NODE_ENV === 'staging' ? 0.5 :    // 50% in staging
  1.0;                                            // 100% in dev
```

### Custom Tags

```typescript
Sentry.setTag('environment', process.env.NODE_ENV);
Sentry.setTag('region', 'us-east-1');
Sentry.setTag('deployment', 'docker');
```

---

## Conclusion

**Status:** ✅ **Implementation Complete** - Just needs DSNs configured

**Priority:** 🟢 **LOW** - App works without it, but highly recommended for production

**Time to Setup:** ~10 minutes

**Benefits:**
- Automatic error tracking
- Performance monitoring
- Better debugging
- User context
- Release tracking

---

**Next Steps:**
1. Create Sentry account
2. Create projects
3. Add DSNs to `.env`
4. Restart server
5. Test error tracking

---

**Status:** Ready to configure  
**Estimated Time:** 10 minutes  
**Difficulty:** Easy


# Sentry Error Tracking Setup ✅

## Overview
We've successfully implemented comprehensive error tracking with Sentry for both backend and frontend.

## What Was Added

### Backend (Node.js/Express)
- **SentryService** (`server/services/SentryService.ts`) - Core error tracking
- **Middleware** (`server/middleware/sentry.ts`) - Request/error handlers
- **Integration** in `server/index.ts` - Full Express integration
- **Features**:
  - Exception tracking
  - Performance monitoring
  - Request tracing
  - User context
  - Breadcrumbs
  - Error filtering

### Frontend (React)
- **FrontendSentryService** (`client/src/services/SentryService.ts`)
- **ErrorBoundary** wrapper in `main.tsx`
- **Features**:
  - Client-side error tracking
  - Performance monitoring
  - Session replay
  - User-friendly error UI

## Setup Instructions

### 1. Create Sentry Account

1. Go to https://sentry.io/signup/
2. Sign up (free tier available)
3. Create a new project:
   - Choose **Node.js** for backend
   - Choose **React** for frontend

### 2. Get Your DSN (Data Source Name)

After creating projects, you'll see DSN URLs like:
```
https://abc123@o123456.ingest.sentry.io/789012
```

### 3. Configure Environment Variables

#### Backend (.env)
```bash
# Sentry Backend DSN
SENTRY_DSN=https://your-backend-dsn@sentry.io/your-project-id

# Environment
NODE_ENV=production  # or development
```

#### Frontend (create .env in root)
```bash
# Sentry Frontend DSN
VITE_SENTRY_DSN=https://your-frontend-dsn@sentry.io/your-project-id

# App version (optional)
VITE_APP_VERSION=1.0.0
```

### 4. Test the Integration

#### Test Backend Error Tracking
```bash
# Create a test endpoint that throws an error
curl http://localhost:3001/api/test-error
```

Or add this to any route:
```typescript
app.get('/api/test-error', (req, res) => {
  throw new Error('Test error for Sentry');
});
```

#### Test Frontend Error Tracking
Add a test button to any component:
```typescript
<button onClick={() => {
  throw new Error('Test frontend error');
}}>
  Test Sentry
</button>
```

### 5. View Errors in Sentry Dashboard

1. Go to https://sentry.io/
2. Select your project
3. Click **Issues** to see errors
4. Click on any error to see:
   - Stack trace
   - User context
   - Request details
   - Breadcrumbs (events leading to error)

## Features Implemented

### Backend Features

#### 1. Automatic Error Capture
All uncaught exceptions are automatically sent to Sentry:
```typescript
// Any error in your Express app is tracked
app.get('/api/users', async (req, res) => {
  const user = await db.users.find(); // If this fails, Sentry captures it
  res.json(user);
});
```

#### 2. Manual Error Capture
```typescript
import { sentryService } from './services/SentryService';

try {
  // Risky operation
  await processPayment(user);
} catch (error) {
  sentryService.captureException(error, {
    userId: user.id,
    amount: payment.amount,
  });
  throw error;
}
```

#### 3. User Context
```typescript
// Set user for current request
sentryService.setUser(user.id, user.email, user.username);

// Clear user context
sentryService.clearUser();
```

#### 4. Breadcrumbs (Event Trail)
```typescript
sentryService.addBreadcrumb(
  'User initiated payment',
  'payment',
  { amount: 100, currency: 'USD' }
);
```

#### 5. Performance Monitoring
```typescript
const transaction = sentryService.startTransaction('process-order', 'task');

// ... do work ...

transaction?.finish();
```

### Frontend Features

#### 1. Error Boundary
Catches React rendering errors automatically:
```typescript
// Already implemented in main.tsx
<ErrorBoundary fallback={<ErrorUI />}>
  <App />
</ErrorBoundary>
```

#### 2. Manual Error Capture
```typescript
import { frontendSentryService } from './services/SentryService';

try {
  await apiCall();
} catch (error) {
  frontendSentryService.captureException(error, {
    api: 'generate',
    prompt: userPrompt,
  });
}
```

#### 3. User Context
```typescript
// When user logs in
frontendSentryService.setUser(user.id, user.email);

// When user logs out
frontendSentryService.clearUser();
```

#### 4. Breadcrumbs
```typescript
frontendSentryService.addBreadcrumb(
  'User clicked generate button',
  'user-action',
  { prompt: userPrompt }
);
```

## Configuration Options

### Backend Configuration

Edit `server/services/SentryService.ts`:

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Sampling rates
  tracesSampleRate: 0.1, // 10% of requests
  profilesSampleRate: 0.1, // 10% profiling
  
  // Environment
  environment: 'production',
  
  // Release tracking
  release: '1.0.0',
  
  // Ignored errors
  ignoreErrors: [
    'ECONNREFUSED',
    'socket hang up',
  ],
});
```

### Frontend Configuration

Edit `client/src/services/SentryService.ts`:

```typescript
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  
  // Session Replay (records user sessions)
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of error sessions
  
  // Performance
  tracesSampleRate: 0.1,
});
```

## Sentry Dashboard Features

### 1. Issues
- View all errors
- See frequency and affected users
- Mark as resolved
- Assign to team members

### 2. Performance
- Track slow endpoints
- See database query performance
- Identify bottlenecks

### 3. Releases
- Track errors by version
- See which release introduced bugs
- Compare releases

### 4. Alerts
Set up alerts for:
- New error types
- Error spike (10+ errors in 5 minutes)
- Performance regression
- Slow endpoints

### 5. Session Replay (Frontend)
- Watch user sessions
- See exactly what user did before error
- Replay mouse movements, clicks, inputs

## Best Practices

### 1. Don't Over-Log
❌ Bad:
```typescript
console.log('User clicked button'); // Don't send to Sentry
```

✅ Good:
```typescript
// Only capture actual errors
sentryService.captureException(error);
```

### 2. Add Context
❌ Bad:
```typescript
sentryService.captureException(error);
```

✅ Good:
```typescript
sentryService.captureException(error, {
  userId: user.id,
  action: 'generate-code',
  prompt: userPrompt,
  fileCount: files.length,
});
```

### 3. Use Breadcrumbs
```typescript
// Track user journey leading to error
sentryService.addBreadcrumb('Opened playground', 'navigation');
sentryService.addBreadcrumb('Entered prompt', 'user-input', { length: 50 });
sentryService.addBreadcrumb('Clicked generate', 'action');
// Error happens here - breadcrumbs show the path
```

### 4. Filter Sensitive Data
Already configured in `beforeSend`:
```typescript
beforeSend(event) {
  // Remove passwords, tokens, etc.
  if (event.request?.headers?.['authorization']) {
    event.request.headers['authorization'] = '[REDACTED]';
  }
  return event;
}
```

## Cost & Limits

### Free Tier
- 5,000 errors per month
- 10,000 performance units
- 7-day data retention
- 1 project

### Paid Plans
- Team: $26/month
  - 50K errors
  - 100K performance units
  - 90-day retention
  
- Business: $80/month
  - Unlimited errors
  - Unlimited performance
  - Custom retention

## Monitoring Production

### Daily Checks
1. Log into Sentry dashboard
2. Check for new error types
3. Review error frequency
4. Check performance metrics

### Weekly Reviews
1. Review resolved issues
2. Check trends (errors increasing?)
3. Review slowest endpoints
4. Update alert rules

### Monthly
1. Review overall health
2. Check usage vs. quota
3. Archive old issues
4. Update integrations

## Integration with Other Tools

### Slack Alerts
1. Go to Project Settings → Integrations
2. Add Slack
3. Configure alerts to #engineering channel

### GitHub Issues
1. Add GitHub integration
2. Auto-create issues from errors
3. Link commits to releases

### PagerDuty (Critical Errors)
1. Add PagerDuty integration
2. Set up on-call rotation
3. Get paged for critical errors

## Troubleshooting

### Errors Not Showing Up?

1. **Check DSN is set**:
   ```bash
   echo $SENTRY_DSN  # Backend
   echo $VITE_SENTRY_DSN  # Frontend
   ```

2. **Check environment**:
   - Sentry is disabled in development by default
   - Set `NODE_ENV=production` to test

3. **Check console**:
   - Should see "✅ Sentry initialized"
   - If not, check DSN format

4. **Test manually**:
   ```typescript
   sentryService.captureMessage('Test from production');
   ```

### Too Many Errors?

1. **Add to ignoreErrors**:
   ```typescript
   ignoreErrors: [
     'ResizeObserver loop limit exceeded',
     'Non-Error promise rejection',
   ]
   ```

2. **Increase sampling rate**:
   ```typescript
   tracesSampleRate: 0.01, // Only 1% of requests
   ```

### Quota Exceeded?

1. Reduce sampling rates
2. Add more error filters
3. Upgrade plan
4. Increase alert threshold

## Summary

✅ **Step 2 (Error Tracking) - COMPLETE!**

**What you get:**
- 🔍 See every error in production
- 📊 Performance monitoring
- 👤 User context and impact
- 🎥 Session replay (see what users did)
- 🚨 Real-time alerts
- 📈 Trends and analytics

**Next Steps:**
- Step 3: Add Zod input validation
- Step 4: Migrate to PostgreSQL
- Step 5: Implement proper authentication

**Production Readiness**: You now have visibility into all production errors! 🎉


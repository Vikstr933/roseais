# 🎯 Sentry Frontend Setup - Complete Guide

## ✅ What's Already Done

- ✅ Backend Sentry configured and tested
- ✅ Frontend Sentry code exists
- ✅ ErrorBoundary component integrated
- ✅ Updated to Sentry v8 API
- ✅ Enabled for development testing

## 📝 Add to Your `.env` File

Add this line to your `.env` file:

```env
# Frontend Sentry (requires VITE_ prefix for browser access)
VITE_SENTRY_DSN=https://e19492d0cffb1100e583863e6f34e068@o4510133486682112.ingest.de.sentry.io/4510133487927376
```

**Why `VITE_` prefix?**
- Vite only exposes env vars with `VITE_` prefix to the browser
- This is a security feature to prevent leaking server secrets

## 🚀 Restart Your Dev Server

After adding the env var, restart your development server:

```bash
# Stop the current server (Ctrl+C)
# Then restart
npm run dev
```

## 🧪 Test Frontend Sentry

### Method 1: Using Browser Console

1. Open your app: http://localhost:5173
2. Open DevTools (F12)
3. Go to Console tab
4. Run this command:

```javascript
throw new Error("Test frontend error from console")
```

### Method 2: Create a Test Button

I can add a test error button to your UI if you want!

### Method 3: Trigger a Real Error

Try to:
- Generate code without API key
- Access a non-existent route
- Submit invalid form data

## 📊 What Will Be Tracked

### Frontend (Browser)
- ✅ JavaScript errors
- ✅ Unhandled promise rejections
- ✅ React component errors (via ErrorBoundary)
- ✅ API request failures
- ✅ Performance metrics
- ✅ User sessions (with replay)
- ✅ User interactions (breadcrumbs)

### Backend (Server)
- ✅ API errors
- ✅ Database errors
- ✅ Authentication failures
- ✅ Unhandled exceptions

## 🔍 Check Your Sentry Dashboard

After triggering an error, check:

**🔗 https://sentry.io/organizations/[your-org]/issues/**

You should see:
- Error details
- Stack trace
- User context (if logged in)
- Breadcrumbs (actions before error)
- Device/browser info
- Replay of session (if enabled)

## ⚙️ Configuration Details

### Current Settings

**Backend** (`server/services/SentryService.ts`):
- Environment: development/production
- Traces: 100% in dev, 10% in prod
- Enabled: Yes (with DSN)

**Frontend** (`client/src/services/SentryService.ts`):
- Environment: development/production  
- Traces: 100% in dev, 10% in prod
- Session Replay: 10% of sessions, 100% on errors
- **Enabled: ✅ Currently enabled for testing**

### For Production

Before deploying, you may want to change this line back:

```typescript
// client/src/services/SentryService.ts line 45
enabled: import.meta.env.MODE === 'production', // Only send in production
```

## 🎯 User Context Integration

Sentry automatically tracks users when they log in! The auth system already integrates with Sentry to set user context.

When a user logs in:
- User ID is set
- Email is tracked
- Username is recorded

This helps you know which users are affected by errors.

## 🛠️ Advanced Features

### Session Replay

Sentry records user sessions and plays them back when an error occurs. This helps you see exactly what the user was doing.

- **Enabled**: Yes
- **Sample Rate**: 10% of all sessions
- **Error Rate**: 100% of sessions with errors

### Performance Monitoring

Track slow API calls, render times, and more:

- API endpoint performance
- Component render times
- Database query performance
- Network request timing

### Breadcrumbs

Automatic tracking of user actions:
- Page navigation
- Button clicks
- Form submissions
- API requests
- Console logs

## ✅ Verification Checklist

- [ ] Added `VITE_SENTRY_DSN` to `.env`
- [ ] Restarted dev server
- [ ] Opened browser DevTools
- [ ] Checked console for "✅ Frontend Sentry initialized"
- [ ] Triggered a test error
- [ ] Checked Sentry dashboard
- [ ] Saw error appear in Sentry

## 🆘 Troubleshooting

### "Frontend error tracking disabled"

**Problem**: `VITE_SENTRY_DSN` not set or missing `VITE_` prefix

**Solution**: 
```env
# Wrong
SENTRY_DSN=...

# Correct
VITE_SENTRY_DSN=...
```

### Errors Not Showing in Sentry

**Possible causes:**
1. Frontend Sentry disabled (we fixed this)
2. Ad blocker blocking Sentry
3. Network issue
4. Wrong DSN

**Solution**: Check browser console for Sentry messages

### "CORS Error" or "Network Error"

**Solution**: Your DSN is correct, but check:
- Internet connection
- Firewall settings
- Ad blocker (disable for localhost)

## 🎉 You're All Set!

Once you see errors in your Sentry dashboard, you're ready for production!

---

**Questions?** Check the full [SENTRY_SETUP.md](./SENTRY_SETUP.md) for more details.


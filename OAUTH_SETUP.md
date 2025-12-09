# OAuth Setup Guide (Supabase)

## Why Supabase Auth?

Supabase Auth provides:
- ✅ **Multiple OAuth providers** - Google, GitHub, Twitter, Facebook, etc.
- ✅ **Built-in security** - No need to manage tokens manually
- ✅ **Session management** - Automatic token refresh
- ✅ **Email verification** - Optional email verification flow
- ✅ **User metadata** - Profile pictures, names, etc.

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com/)
2. Create a new project (free tier available)
3. Wait for database provisioning (~2 minutes)

### 2. Configure OAuth Providers

#### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **Google+ API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs:
   ```
   https://[your-project-ref].supabase.co/auth/v1/callback
   ```
7. Copy **Client ID** and **Client Secret**

8. In Supabase Dashboard:
   - Go to **Authentication** → **Providers** → **Google**
   - Enable Google
   - Paste Client ID and Client Secret
   - Save

#### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - Application name: Your App Name
   - Homepage URL: `http://localhost:5173` (for development)
   - Authorization callback URL:
     ```
     https://[your-project-ref].supabase.co/auth/v1/callback
     ```
4. Copy **Client ID** and **Client Secret**

5. In Supabase Dashboard:
   - Go to **Authentication** → **Providers** → **GitHub**
   - Enable GitHub
   - Paste Client ID and Client Secret
   - Save

### 3. Get Supabase Credentials

In your Supabase Dashboard:
1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xxx.supabase.co`)
   - **anon/public** key

### 4. Configure Environment Variables

Add to your `.env` file:

```bash
# Supabase Auth
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 5. Update Redirect URLs for Production

When deploying to production:

1. Add production URL to OAuth providers:
   - Google: `https://your-domain.com` as authorized origin
   - GitHub: `https://your-domain.com` as homepage URL

2. Update Supabase redirect URL in code if needed (currently auto-detected)

### 6. Test OAuth Flow

1. Start your dev server: `npm run dev`
2. Click "Login" in your app
3. Click "Continue with Google" or "Continue with GitHub"
4. Complete OAuth flow
5. You should be redirected back and logged in!

## How It Works

```mermaid
sequenceDiagram
    User->>App: Click "Continue with Google"
    App->>Supabase: signInWithOAuth('google')
    Supabase->>Google: Redirect to Google login
    User->>Google: Enter credentials
    Google->>Supabase: Return auth code
    Supabase->>Google: Exchange for access token
    Supabase->>App: Redirect to /auth/callback with session
    App->>Backend: POST /api/auth/oauth with user data
    Backend->>Database: Create/update user
    Backend->>App: Return session token
    App->>User: Logged in!
```

## Security Considerations

1. **Session Storage**: Sessions are stored in localStorage (handled by Supabase)
2. **Token Refresh**: Automatic token refresh (1 hour default)
3. **HTTPS Required**: OAuth won't work on HTTP in production
4. **CORS**: Already configured in backend

## Troubleshooting

### "OAuth not configured"
- Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Restart your dev server after adding env vars

### "Redirect URI mismatch"
- Ensure the redirect URI in your OAuth provider matches exactly:
  ```
  https://[your-project-ref].supabase.co/auth/v1/callback
  ```

### "Failed to register OAuth user"
- Check backend logs for detailed error
- Ensure database tables exist (run migrations if needed)

### User redirected but not logged in
- Check browser console for errors
- Verify `/auth/callback` route is registered in your router
- Check that `/api/auth/oauth` endpoint is accessible

## Custom OAuth Providers

To add more providers (Twitter, Facebook, etc.):

1. Enable in Supabase Dashboard
2. Get provider credentials
3. Add to `signInWithOAuth` function in `client/src/lib/supabase.ts`
4. Add button to `AuthDialog.tsx`

## Production Checklist

- [ ] OAuth provider credentials configured for production domain
- [ ] Supabase redirect URLs updated for production
- [ ] Environment variables set in deployment platform
- [ ] HTTPS enabled on production domain
- [ ] Test OAuth flow on production
- [ ] Monitor Supabase auth logs

## Cost

Supabase Free Tier:
- 50,000 monthly active users
- Unlimited OAuth logins
- Unlimited API requests

Perfect for getting started!


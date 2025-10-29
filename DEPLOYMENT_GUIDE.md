# Hybrid Deployment Guide

Deploy your AI Code Generator platform with a hybrid architecture:
- **Frontend**: Vercel (Static React App)
- **Backend**: Render (Node.js/Express Server)
- **Database**: Supabase (PostgreSQL)

## Prerequisites

1. GitHub account with your code pushed
2. Vercel account (https://vercel.com)
3. Render account (https://render.com)
4. Supabase project set up
5. Required API keys (Anthropic, OpenAI, Stripe, etc.)

---

## Part 1: Deploy Backend to Render

### Step 1: Create Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `ai-library-backend` (or your preferred name)
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (or upgrade for better performance)

### Step 2: Add Environment Variables

In Render dashboard, go to **Environment** tab and add these variables:

```bash
# Required Variables
NODE_ENV=production
PORT=10000
DATABASE_URL=your_supabase_postgres_url
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ANTHROPIC_API_KEY=sk-ant-api03-your_key
SESSION_SECRET=generate_random_32_char_string

# Will update after Vercel deployment
ALLOWED_ORIGINS=https://your-app.vercel.app
FRONTEND_URL=https://your-app.vercel.app
```

Copy all other variables from `.env.production.example`.

### Step 3: Configure Health Check

1. In Render dashboard, go to **Settings**
2. Set **Health Check Path**: `/api/health`
3. Save changes

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Wait for deployment to complete
3. **Copy the backend URL** (e.g., `https://ai-library-backend.onrender.com`)
4. Test the health endpoint: `https://YOUR-BACKEND-URL.onrender.com/api/health`

---

## Part 2: Deploy Frontend to Vercel

### Step 1: Import Project to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Vite
   - **Build Command**: `vite build`
   - **Output Directory**: `dist/public`
   - **Install Command**: `npm install`

### Step 2: Add Environment Variables

In Vercel dashboard, go to **Settings** → **Environment Variables**:

```bash
# Backend API (Use your Render URL from Part 1)
VITE_API_URL=https://your-backend.onrender.com

# Supabase (Client-side)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Stripe (Publishable key only)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key

# Optional: Sentry
VITE_SENTRY_DSN=your_sentry_dsn
VITE_SENTRY_ENV=production
```

**Important**: Add these to all environments (Production, Preview, Development)

### Step 3: Deploy

1. Click **"Deploy"**
2. Wait for deployment to complete
3. **Copy the Vercel URL** (e.g., `https://your-app.vercel.app`)

---

## Part 3: Connect Frontend and Backend

### Step 1: Update Render Environment Variables

Go back to your Render service and update:

```bash
ALLOWED_ORIGINS=https://your-app.vercel.app
FRONTEND_URL=https://your-app.vercel.app
```

Click **"Save Changes"** - this will trigger a redeploy.

### Step 2: Update OAuth Callback URLs

If using OAuth, update callback URLs in:

**GitHub OAuth:**
1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Update Authorization callback URL: `https://your-app.vercel.app/auth/callback`

**Google OAuth:**
1. Go to Google Cloud Console → Credentials
2. Update Authorized redirect URIs:
   - `https://your-app.vercel.app/auth/callback`
   - `https://your-backend.onrender.com/api/plugins/gmail/callback`
   - `https://your-backend.onrender.com/api/plugins/google-calendar/callback`

**Stripe Webhooks:**
1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-backend.onrender.com/api/stripe/webhook`

---

## Part 4: Verify Deployment

### Test Checklist

- [ ] Frontend loads at Vercel URL
- [ ] Backend health check works: `https://YOUR-BACKEND.onrender.com/api/health`
- [ ] User registration/login works
- [ ] API calls from frontend to backend work
- [ ] WebSocket/SSE connections work
- [ ] File uploads/downloads work
- [ ] OAuth login works (if configured)
- [ ] Stripe payments work (if configured)

### Common Issues

**CORS Errors:**
- Verify `ALLOWED_ORIGINS` in Render includes your Vercel URL
- Check browser console for exact error
- Ensure `credentials: 'include'` is set in frontend fetch calls

**API Not Connecting:**
- Verify `VITE_API_URL` in Vercel matches your Render backend URL
- Check that Render service is running (not sleeping)
- Test backend directly: `curl https://YOUR-BACKEND.onrender.com/api/health`

**WebSocket Issues:**
- Render's free tier may have WebSocket limitations
- Consider upgrading Render plan for production

---

## Part 5: Custom Domain (Optional)

### For Vercel (Frontend):
1. Go to Vercel → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

### For Render (Backend):
1. Go to Render → Settings → Custom Domain
2. Add custom domain (e.g., `api.yourdomain.com`)
3. Update DNS records

**After adding custom domains**, update:
- `ALLOWED_ORIGINS` in Render
- `VITE_API_URL` in Vercel
- All OAuth callback URLs

---

## Monitoring & Maintenance

### Logs

**Render Logs:**
- Dashboard → Your Service → Logs tab
- Real-time server logs

**Vercel Logs:**
- Dashboard → Your Project → Deployments → View Function Logs

### Database Backups

**Supabase:**
- Automatic backups on paid plans
- Manual export: Dashboard → Database → Backups

### Performance Monitoring

**Recommended Tools:**
- Sentry (error tracking) - already configured
- Vercel Analytics (frontend performance)
- Render Metrics (backend performance)

### Scaling

**When to scale:**
- Render free tier sleeps after inactivity (upgrade to Starter for always-on)
- Vercel scales automatically
- Supabase: upgrade if database limits reached

---

## Environment Variable Reference

See these files for complete lists:
- Backend: `.env.production.example`
- Frontend: `.env.vercel.example`

---

## Rollback Procedure

**Vercel:**
1. Go to Deployments tab
2. Find previous working deployment
3. Click "..." → "Promote to Production"

**Render:**
1. Go to your service
2. Click "Manual Deploy"
3. Select previous commit from dropdown
4. Deploy

---

## Cost Estimate

**Free Tier:**
- Vercel: Free (includes hobby projects)
- Render: Free (with limitations - sleeps after 15min inactivity)
- Supabase: Free (up to 500MB database, 2GB bandwidth)

**Recommended Paid Tier (for production):**
- Vercel: $20/month (Pro plan)
- Render: $7/month (Starter plan - always on)
- Supabase: $25/month (Pro plan)
- **Total**: ~$52/month

---

## Support

- **Vercel Docs**: https://vercel.com/docs
- **Render Docs**: https://render.com/docs
- **Supabase Docs**: https://supabase.com/docs

For issues specific to this application, check GitHub issues or contact support.

---

## Next Steps

After successful deployment:

1. Set up monitoring and alerts
2. Configure automated backups
3. Add custom domain
4. Set up CI/CD for automated deployments
5. Configure staging environment
6. Load test your application
7. Document your specific configuration

**Congratulations! Your application is now live!** 🎉

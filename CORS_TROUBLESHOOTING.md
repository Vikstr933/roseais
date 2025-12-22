# CORS Troubleshooting Guide

## 🔍 Problem
CORS errors efter OAuth-callbacks:
- `Access-Control-Allow-Origin header is missing`
- Plugins laddar inte
- Workspace sessions laddar inte

## ✅ Lösning

### 1. Environment Variables på Render

**VIKTIGT:** Lägg till dessa variabler på Render om de saknas:

```env
# Backend URL (sätts automatiskt av Render, men kan behövas explicit)
BACKEND_URL=https://ai-library-backend-3mmv.onrender.com

# Render External URL (sätts automatiskt, men kan behövas explicit)
RENDER_EXTERNAL_URL=https://ai-library-backend-3mmv.onrender.com

# Frontend URL (du har redan denna)
FRONTEND_URL=https://newai-sigma.vercel.app

# Allowed Origins (du har redan denna)
ALLOWED_ORIGINS=https://newai-sigma.vercel.app,http://localhost:5173,http://localhost:3000,https://newai.vercel.app
```

### 2. CORS-konfiguration

CORS är nu konfigurerad att:
- ✅ **Prioritera Vercel och Render origins** FÖRE allowedOrigins-listan
- ✅ **Alltid tillåta** `*.vercel.app` och `*.onrender.com`
- ✅ **Hantera preflight requests** korrekt

### 3. Verifiera att det fungerar

Efter deployment, kolla backend logs för CORS-meddelanden:
```
[CORS] Allowing Vercel origin: https://newai-sigma.vercel.app
[CORS Preflight] Allowing Vercel origin: https://newai-sigma.vercel.app
```

Om du ser `[CORS] REJECTED origin`, då är det ett problem.

## 🔧 Debugging

### Kolla backend logs:
1. Gå till Render dashboard
2. Kolla "Logs" tab
3. Sök efter `[CORS]` meddelanden
4. Se vilken origin som blockeras

### Testa CORS manuellt:
```bash
curl -H "Origin: https://newai-sigma.vercel.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type,Authorization" \
     -X OPTIONS \
     https://ai-library-backend-3mmv.onrender.com/api/plugins
```

Du bör få tillbaka:
```
Access-Control-Allow-Origin: https://newai-sigma.vercel.app
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Credentials: true
```

## 📝 Frontend Environment Variables (Vercel)

**Frontend behöver INTE CORS-variabler!** CORS hanteras på backend.

Frontend behöver bara:
- `VITE_API_URL` - Backend URL (du har redan denna)
- `VITE_SUPABASE_URL` - Supabase URL (du har redan denna)
- `VITE_SUPABASE_ANON_KEY` - Supabase key (du har redan denna)
- `VITE_SENTRY_DSN` - Sentry DSN (du har redan denna)

## ✅ Checklist

- [ ] `BACKEND_URL` satt på Render (eller `RENDER_EXTERNAL_URL`)
- [ ] `FRONTEND_URL` satt på Render
- [ ] `ALLOWED_ORIGINS` inkluderar frontend URL
- [ ] Backend är redeployed efter CORS-fix
- [ ] Testa i browser console - ska inte se CORS errors

## 🚨 Om det fortfarande inte fungerar

1. **Kolla backend logs** för CORS-meddelanden
2. **Verifiera** att `BACKEND_URL` eller `RENDER_EXTERNAL_URL` är satt
3. **Testa** med curl-kommandot ovan
4. **Kontrollera** att frontend använder rätt `VITE_API_URL`


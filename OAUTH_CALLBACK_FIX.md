# OAuth Callback & CORS Fix Guide

## Problem som fixats

1. ✅ **OAuth Callback 404** - Förbättrad hantering av hash fragments
2. ✅ **Ikon 404-fel** - Ikoner behålls nu i `icons/` mappen vid build
3. ⚠️ **CORS-problem** - Kräver verifiering av Render miljövariabler

## Fixar som gjorts

### 1. OAuth Callback (`client/src/pages/AuthCallback.tsx`)
- Lagt till delay för att ge Supabase tid att processa hash fragments
- Förbättrad retry-logik om session inte hittas direkt
- Automatisk rensning av hash fragment från URL efter autentisering

### 2. Ikoner (`vite.config.ts`)
- Ikoner behålls nu i `icons/` mappen (inte `images/`) för att matcha manifest.json
- Favicon och alla icon-filer kopieras korrekt vid build

## CORS-konfiguration på Render

Backend tillåter redan `https://newai-sigma.vercel.app` i koden, men verifiera att Render har rätt miljövariabler:

### Steg 1: Verifiera Render Environment Variables

Gå till Render Dashboard → Ditt Backend Service → Environment och kontrollera:

```bash
# Lägg till om det saknas:
FRONTEND_URL=https://newai-sigma.vercel.app

# ELLER (mer flexibelt):
ALLOWED_ORIGINS=https://newai-sigma.vercel.app,https://newai.vercel.app
```

### Steg 2: Verifiera att Backend är igång

1. Gå till Render Dashboard → Ditt Backend Service → Logs
2. Leta efter: `[CORS] Allowing origin: https://newai-sigma.vercel.app`
3. Om du ser `[CORS] Blocked origin` istället, kontrollera miljövariablerna

### Steg 3: Testa CORS manuellt

Öppna browser console på `https://newai-sigma.vercel.app` och kör:

```javascript
fetch('https://ai-library-backend.onrender.com/api/auth/me', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer test'
  }
})
.then(r => console.log('CORS OK:', r.status))
.catch(e => console.error('CORS ERROR:', e));
```

Om du får CORS-fel, kontrollera Render logs för att se vilken origin som blockeras.

## Supabase OAuth Callback URL

Kontrollera att Supabase har rätt callback URL konfigurerad:

1. Gå till [Supabase Dashboard](https://supabase.com/dashboard)
2. Välj ditt projekt → Authentication → URL Configuration
3. Verifiera att **Redirect URLs** innehåller:
   ```
   https://newai-sigma.vercel.app/auth/callback
   ```

## Testa efter fixar

1. **Rensa browser cache och cookies**
2. Gå till `https://newai-sigma.vercel.app`
3. Klicka på "Login with Google"
4. Efter OAuth redirect, bör du:
   - Se "Completing sign in..." meddelande
   - Automatiskt redirectas till home page
   - Vara inloggad

## Om problemet kvarstår

### CORS-fel kvarstår:
1. Kontrollera Render logs för CORS-meddelanden
2. Verifiera att `FRONTEND_URL` eller `ALLOWED_ORIGINS` är satt på Render
3. Restart backend service på Render

### OAuth 404 kvarstår:
1. Kontrollera Supabase Redirect URLs
2. Verifiera att `VITE_SUPABASE_URL` och `VITE_SUPABASE_ANON_KEY` är satt på Vercel
3. Öppna browser console och kolla för felmeddelanden

### Ikoner saknas fortfarande:
1. Verifiera att ikoner finns i `client/public/icons/`
2. Efter build, kontrollera att `dist/public/icons/` innehåller ikonerna
3. Om ikoner saknas, kör `npm run build` lokalt och kontrollera output


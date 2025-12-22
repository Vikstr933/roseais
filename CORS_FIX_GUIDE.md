# CORS Fix Guide

## Problem
Backend svarar inte med CORS headers, vilket blockerar API-anrop från frontend.

## Lösning

### Steg 1: Verifiera Render Environment Variables

Gå till Render Dashboard → Ditt Backend Service → Environment och kontrollera:

```bash
# Lägg till om det saknas:
FRONTEND_URL=https://newai-sigma.vercel.app

# ELLER (mer flexibelt):
ALLOWED_ORIGINS=https://newai-sigma.vercel.app,https://newai.vercel.app
```

### Steg 2: Verifiera att Backend är deployad med senaste ändringar

Backend måste ha de nya CORS-headers som tillåter `Cache-Control`:
- `allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'X-Requested-With']`

### Steg 3: Restart Backend på Render

1. Gå till Render Dashboard → Ditt Backend Service
2. Klicka på "Manual Deploy" → "Deploy latest commit"
3. Vänta på att deploymenten är klar (2-3 minuter)

### Steg 4: Testa CORS

Öppna browser console på `https://newai-sigma.vercel.app` och kör:

```javascript
fetch('https://ai-library-backend-3mmv.onrender.com/api/auth/me', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer test',
    'Cache-Control': 'no-cache'
  }
})
.then(r => {
  console.log('CORS OK:', r.status);
  console.log('CORS Headers:', {
    'Access-Control-Allow-Origin': r.headers.get('Access-Control-Allow-Origin'),
    'Access-Control-Allow-Headers': r.headers.get('Access-Control-Allow-Headers')
  });
})
.catch(e => console.error('CORS ERROR:', e));
```

Om du fortfarande får CORS-fel:
1. Kontrollera Render logs för CORS-meddelanden
2. Verifiera att `FRONTEND_URL` eller `ALLOWED_ORIGINS` är satt korrekt
3. Kontrollera att backend faktiskt är igång (gå till `https://ai-library-backend-3mmv.onrender.com/health`)

## Om problemet kvarstår

Kontrollera Render logs för:
- `[CORS] Allowing origin: https://newai-sigma.vercel.app` (bra)
- `[CORS] Blocked origin: https://newai-sigma.vercel.app` (dåligt - kontrollera miljövariabler)


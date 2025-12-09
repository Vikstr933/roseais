# Render Deployment Instructions - CORS Fix

## Snabb Fix

Backend måste deployas med de nya CORS-ändringarna. Följ dessa steg:

### Steg 1: Lägg till Environment Variable på Render

1. Gå till [Render Dashboard](https://dashboard.render.com)
2. Välj ditt backend service (Web Service)
3. Klicka på "Environment" i vänstermenyn
4. Lägg till denna environment variable:

```
FRONTEND_URL=https://newai-sigma.vercel.app
```

**ELLER** (mer flexibelt, om du har flera frontend-domäner):

```
ALLOWED_ORIGINS=https://newai-sigma.vercel.app,https://newai.vercel.app
```

### Steg 2: Deploy Backend

1. I Render Dashboard → Ditt Backend Service
2. Klicka på "Manual Deploy" → "Deploy latest commit"
3. Vänta på att deploymenten är klar (2-3 minuter)

### Steg 3: Verifiera Deployment

1. Gå till Render Dashboard → Ditt Backend Service → Logs
2. Leta efter: `[CORS] Allowing origin: https://newai-sigma.vercel.app`
3. Om du ser `[CORS] Blocked origin` istället, kontrollera miljövariablerna igen

### Steg 4: Testa CORS

Efter deployment, öppna browser console på `https://newai-sigma.vercel.app` och kör:

```javascript
fetch('https://ai-library-backend.onrender.com/api/auth/me', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer test',
    'Cache-Control': 'no-cache'
  }
})
.then(r => {
  console.log('Status:', r.status);
  console.log('CORS Headers:', {
    'Access-Control-Allow-Origin': r.headers.get('Access-Control-Allow-Origin'),
    'Access-Control-Allow-Headers': r.headers.get('Access-Control-Allow-Headers')
  });
})
.catch(e => console.error('Error:', e));
```

Du bör se:
- Status: 401 eller 503 (normalt - vi skickar bara "test" som token)
- `Access-Control-Allow-Origin: https://newai-sigma.vercel.app`
- `Access-Control-Allow-Headers` innehåller `Cache-Control`

## Om Backend är Nere (503)

Om backend svarar med 503 (Service Unavailable):

1. Kontrollera Render Dashboard → Ditt Backend Service → Status
2. Om status är "Suspended" eller "Failed", klicka på "Restart"
3. Vänta på att backend startar (1-2 minuter)
4. Testa igen

## Debugging

Om CORS fortfarande inte fungerar:

1. **Kontrollera Render Logs:**
   - Leta efter `[CORS] Allowing origin` eller `[CORS] Blocked origin`
   - Om origin blockeras, kontrollera att miljövariabeln är korrekt satt

2. **Kontrollera Environment Variables:**
   - Gå till Render Dashboard → Environment
   - Verifiera att `FRONTEND_URL` eller `ALLOWED_ORIGINS` är satt
   - Kontrollera att det inte finns extra mellanslag eller felaktiga värden

3. **Testa Backend Health:**
   - Gå till `https://ai-library-backend.onrender.com/health`
   - Om detta fungerar, är backend igång
   - Om detta inte fungerar, är backend nere eller har problem

## Viktigt

- Backend måste vara deployad med senaste commit (som innehåller CORS-fixarna)
- Environment variables måste vara satta korrekt
- Backend måste vara igång (inte suspended eller failed)


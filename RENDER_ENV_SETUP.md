# Render Environment Variables Setup för OAuth

## Kritiska Environment Variables i Render

För att OAuth ska fungera korrekt i production behöver du sätta följande i Render:

### 1. ALLOWED_ORIGINS (REDAN SATT)
```
ALLOWED_ORIGINS=https://newai-sigma.vercel.app,https://newai.vercel.app,http://localhost:5173
```
**Kontrollera:** Lägg till din exakta frontend URL här om den inte redan finns.

### 2. BACKEND_URL (VIKTIGT!)
```
BACKEND_URL=https://ai-library-backend-3mmv.onrender.com
```
**Varför:** Detta används för OAuth redirect URIs. Om det inte är satt, används `RENDER_EXTERNAL_URL` automatiskt, men det är bättre att sätta det explicit.

### 3. FRONTEND_URL (REKOMMENDERAT)
```
FRONTEND_URL=https://newai-sigma.vercel.app
```
**Varför:** Används som fallback om `ALLOWED_ORIGINS` inte är satt.

## Steg för att sätta i Render Dashboard:

1. Gå till din Render service: https://dashboard.render.com
2. Välj din backend service (`ai-library-backend`)
3. Gå till **Environment** tab
4. Lägg till/uppdatera följande:

### Måste ha:
- `BACKEND_URL` = `https://ai-library-backend-3mmv.onrender.com`
- `ALLOWED_ORIGINS` = `https://newai-sigma.vercel.app,https://newai.vercel.app,http://localhost:5173` (lägg till din exakta frontend URL här)

### Rekommenderat:
- `FRONTEND_URL` = Din frontend URL (t.ex. `https://newai-sigma.vercel.app`)

## Vercel Environment Variables (för frontend):

I Vercel behöver du också sätta:

### Måste ha:
- `VITE_API_URL` = `https://ai-library-backend-3mmv.onrender.com`

**Steg:**
1. Gå till Vercel Dashboard
2. Välj ditt frontend-projekt
3. Settings → Environment Variables
4. Lägg till:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://ai-library-backend-3mmv.onrender.com`
   - **Environment:** Production (och Preview om du vill)
5. **VIKTIGT:** Redeploya frontend efter att du har satt variabeln!

## Efter att du har satt variablerna:

1. **Render:** Service kommer automatiskt att redeploya när du ändrar environment variables
2. **Vercel:** Du måste manuellt redeploya frontend (eller vänta på nästa commit)

## Verifiera att det fungerar:

1. Efter redeploy, testa OAuth-login
2. Kontrollera browser console - du bör se loggen med URL:en
3. Kontrollera Render logs - du bör se `[DEBUG /api/auth] POST /oauth` loggar

## Felsökning:

Om du fortfarande får 405:
- Kontrollera att `VITE_API_URL` är satt i Vercel
- Kontrollera att din frontend URL finns i `ALLOWED_ORIGINS` i Render
- Kontrollera Render logs för att se om requesten når servern
- Kontrollera browser console för CORS-fel


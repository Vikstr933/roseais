# Vercel Routing Fix Guide

## Problem
JS-filer serveras som HTML (MIME type error), vilket gör att appen inte laddar.

## Lösning

### Steg 1: Verifiera Build Output

Kontrollera att JS-filer faktiskt finns i `dist/public/js/` efter build:

```bash
npm run build
ls -la dist/public/js/
```

Du bör se filer som `index-[hash].js`.

### Steg 2: Verifiera Vercel Deployment

1. Gå till Vercel Dashboard → Ditt Project → Deployments
2. Klicka på senaste deployment
3. Kontrollera "Build Logs" för att se att build lyckades
4. Kontrollera "Function Logs" för routing-fel

### Steg 3: Testa Routing Manuellt

Efter deployment, testa dessa URLs direkt i browser:

- `https://newai-sigma.vercel.app/js/index-[hash].js` (ersätt med faktiskt hash)
- `https://newai-sigma.vercel.app/icons/icon-180x180.png`
- `https://newai-sigma.vercel.app/manifest.json`

Om dessa returnerar HTML istället för rätt filtyp, betyder det att routing inte fungerar.

### Steg 4: Alternativ Lösning - Använd Vercel CLI

Om routing fortfarande inte fungerar, kan vi prova att använda `vercel.json` med `cleanUrls: false`:

```json
{
  "cleanUrls": false,
  "rewrites": [...]
}
```

### Steg 5: Kontrollera Vercel Build Settings

1. Gå till Vercel Dashboard → Project Settings → Build & Development Settings
2. Verifiera:
   - **Build Command**: `vite build`
   - **Output Directory**: `dist/public`
   - **Install Command**: `npm install`

### Steg 6: Om Problem Kvarstår

Om JS-filer fortfarande serveras som HTML:

1. Kontrollera Vercel logs för routing-fel
2. Prova att använda `_redirects` fil istället för `vercel.json`
3. Kontakta Vercel support om problemet kvarstår

## Debugging

För att debugga routing-problemet:

1. Öppna browser console
2. Gå till Network tab
3. Ladda om sidan
4. Klicka på en JS-fil som misslyckas
5. Kontrollera Response Headers - `Content-Type` bör vara `application/javascript`, inte `text/html`

Om `Content-Type` är `text/html`, betyder det att filen matchas av catch-all routen istället för den specifika routen.


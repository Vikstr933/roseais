# Icon 404 Fix Guide

## Problem
Ikoner från `client/public/icons/` laddas inte korrekt på Vercel (404-fel).

## Lösning

### Steg 1: Verifiera att ikoner finns i public-mappen

Kontrollera att dessa filer finns:
- `client/public/icons/favicon.png`
- `client/public/icons/icon-180x180.png`
- `client/public/icons/icon-192x192.png`
- `client/public/icons/icon-512x512.png`

### Steg 2: Verifiera Vercel Build Output

Efter deployment, kontrollera att ikonerna kopieras till `dist/public/icons/`:

1. Gå till Vercel Dashboard → Ditt Project → Deployments
2. Klicka på senaste deployment → "View Function Logs"
3. Leta efter build output som visar att ikoner kopieras

### Steg 3: Testa lokalt

Kör lokalt för att verifiera att ikoner kopieras:

```bash
npm run build
ls -la dist/public/icons/
```

Du bör se alla ikon-filer där.

### Steg 4: Om ikoner fortfarande saknas

Om ikonerna inte kopieras korrekt, kan du manuellt kopiera dem:

1. Efter build, kontrollera `dist/public/icons/`
2. Om mappen saknas eller är tom, kopiera manuellt:
   ```bash
   cp -r client/public/icons dist/public/icons
   ```

### Steg 5: Verifiera Vercel Routes

Kontrollera att `vercel.json` har korrekt route för ikoner:

```json
{
  "src": "/icons/(.*)",
  "dest": "/icons/$1"
}
```

Detta borde redan vara konfigurerat.

## Alternativ lösning: Använd base64-encoded ikoner

Om problemet kvarstår, kan vi konvertera ikoner till base64 och inkludera dem direkt i HTML/manifest, men detta ökar filstorleken.

## Debugging

För att debugga ikon-problemet:

1. Öppna browser console
2. Gå till `https://newai-sigma.vercel.app/icons/icon-180x180.png`
3. Om du ser 404, betyder det att filen inte kopierats korrekt
4. Kontrollera Vercel build logs för felmeddelanden


# OAuth Callback 404 Fix Guide

## Problem

När användare loggar in via OAuth får de ett 404-fel från Supabase:
```
404: NOT_FOUND
Code: NOT_FOUND
ID: arn1::xxvdh-1764423822912-47c0adea1d94
```

## Orsak

404:an kommer **INTE** från vår app, utan från **Supabase**. Detta betyder att Supabase inte känner igen `/auth/callback` som en giltig redirect URL.

## Lösning

### Steg 1: Kontrollera Supabase Redirect URLs

1. Gå till [Supabase Dashboard](https://supabase.com/dashboard)
2. Välj ditt projekt
3. Gå till **Authentication** → **URL Configuration**
4. Under **Redirect URLs**, kontrollera att följande finns:
   ```
   https://newai-sigma.vercel.app/auth/callback
   https://newai-sigma.vercel.app/callback
   http://localhost:5173/auth/callback (för lokal utveckling)
   ```

### Steg 2: Lägg till Redirect URLs om de saknas

Om URLs saknas:

1. Klicka på **"Add URL"**
2. Lägg till: `https://newai-sigma.vercel.app/auth/callback`
3. Lägg till: `https://newai-sigma.vercel.app/callback`
4. Klicka på **"Save"**

### Steg 3: Verifiera Site URL

Kontrollera att **Site URL** är satt till:
```
https://newai-sigma.vercel.app
```

### Steg 4: Testa igen

Efter att ha uppdaterat Supabase-konfigurationen:

1. Rensa browser cache
2. Försök logga in igen
3. Du bör nu komma till `/auth/callback` utan 404-fel

## Om problemet kvarstår

### Kontrollera Vercel Environment Variables

Se till att följande är satt på Vercel:

1. Gå till Vercel Dashboard → Project → Settings → Environment Variables
2. Verifiera:
   - `VITE_SUPABASE_URL` - Din Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Din Supabase anon key

### Kontrollera Browser Console

Öppna browser console (F12) och kolla för felmeddelanden. Du bör se:
- "Starting OAuth callback..."
- "Found access_token in hash, setting session manually..."
- "Got Supabase session for user: [email]"

Om du ser andra fel, dela dem så kan vi fixa dem.

## Notera

Felet `callback#access_token=...:1 Failed to load resource` är **NORMALT** och kan ignoreras. Hash-fragmentet (`#access_token=...`) skickas inte till servern, så browsern kan visa ett 404, men JavaScript läser det från `window.location.hash` och det fungerar ändå.


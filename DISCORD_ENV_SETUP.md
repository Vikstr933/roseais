# Discord Environment Variables Setup

## Översikt

För att Discord-integrationen ska fungera korrekt behöver du konfigurera environment variables på både **Render (backend)** och **Vercel (frontend)**.

## Backend (Render) - Krävs ✅

### Obligatoriska Environment Variables

#### 1. Discord Webhook URL (för att skicka meddelanden)
```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1442923180783173864/98HEPAFtzCbeBMquTrvTnU4rfxuYjYzfFX_avwgP9agtVwFyKnHZekekPfzQQfiHTtsk
```
**Används för:** Automatiska notifikationer, feedback, bug reports via webhook

#### 2. Discord Invite Link (för att rekommendera community)
```bash
DISCORD_INVITE_LINK=https://discord.gg/uuPTeAHh
```
**Används för:** När Elon rekommenderar Discord-communityn till användare

### Valfria Environment Variables

#### 3. Discord Bot Token (för automatisk bot-anslutning)
```bash
DISCORD_BOT_TOKEN=MTQ0NDI2NTYyNTk3NDM0MTY2NA.G3TDdU.mBdiBLNRniGNaMdewNdxDjS7wUh8ArE_dhNRfE
```
**Används för:** Om du vill att boten ska anslutas automatiskt vid server-start (valfritt - användare kan också ansluta via API)

#### 4. Credential Encryption Key (för säker lagring)
```bash
CREDENTIAL_ENCRYPTION_KEY=din_super_hemlig_nyckel_här_minst_32_tecken_lång
```
**Används för:** Kryptering av Discord bot tokens som användare lagrar (krävs om användare ska kunna spara sina bot tokens)

## Frontend (Vercel) - Inte krävs ❌

**Inga Discord-specifika environment variables behövs på frontend!**

Frontend kommunicerar med backend via API-endpoints, så alla Discord-credentials hanteras på backend.

## Steg-för-steg: Lägg till på Render

### 1. Gå till Render Dashboard
1. Logga in på [Render Dashboard](https://dashboard.render.com)
2. Välj ditt backend service (Web Service)

### 2. Lägg till Environment Variables
1. Klicka på "Environment" i vänstermenyn
2. Klicka på "Add Environment Variable"
3. Lägg till varje variabel:

**Variabel 1:**
- **Key:** `DISCORD_WEBHOOK_URL`
- **Value:** `https://discord.com/api/webhooks/1442923180783173864/98HEPAFtzCbeBMquTrvTnU4rfxuYjYzfFX_avwgP9agtVwFyKnHZekekPfzQQfiHTtsk`

**Variabel 2:**
- **Key:** `DISCORD_INVITE_LINK`
- **Value:** `https://discord.gg/uuPTeAHh`

**Variabel 3 (Valfritt - för auto-connect):**
- **Key:** `DISCORD_BOT_TOKEN`
- **Value:** `MTQ0NDI2NTYyNTk3NDM0MTY2NA.G3TDdU.mBdiBLNRniGNaMdewNdxDjS7wUh8ArE_dhNRfE`

**Variabel 4 (Om den inte redan finns):**
- **Key:** `CREDENTIAL_ENCRYPTION_KEY`
- **Value:** Generera en säker nyckel (minst 32 tecken)

### 3. Restart Service
Efter att ha lagt till environment variables, klicka på "Manual Deploy" → "Deploy latest commit" för att starta om servicen med nya variabler.

## Steg-för-steg: Verifiera på Vercel

### Kontrollera att inga Discord-variabler behövs
1. Gå till [Vercel Dashboard](https://vercel.com/dashboard)
2. Välj ditt frontend project
3. Gå till "Settings" → "Environment Variables"
4. **Du behöver INTE lägga till några Discord-variabler här**

Frontend använder bara API-endpoints som:
- `/api/discord/bot/connect`
- `/api/discord/bot/status`
- etc.

Alla Discord-credentials hanteras på backend.

## Testa att det fungerar

### 1. Testa Webhook (Backend)
```bash
# Testa från backend server
curl -X POST https://din-backend-url.render.com/api/test/discord-webhook
```

### 2. Testa Bot Connection (via API)
```bash
# Från frontend eller via API client
POST https://din-backend-url.render.com/api/discord/bot/connect
Authorization: Bearer YOUR_SESSION_TOKEN
Content-Type: application/json

{
  "botToken": "MTQ0NDI2NTYyNTk3NDM0MTY2NA.G3TDdU.mBdiBLNRniGNaMdewNdxDjS7wUh8ArE_dhNRfE"
}
```

## Säkerhet - Viktiga Tips

### ⚠️ Viktigt för Production

1. **DISCORD_BOT_TOKEN är känslig**
   - Dela ALDRIG publikt
   - Om token läcker, reset den omedelbart i Discord Developer Portal
   - Använd Render's "Secret" environment variables (de är redan krypterade)

2. **CREDENTIAL_ENCRYPTION_KEY**
   - Måste vara minst 32 tecken
   - Använd en stark, slumpmässig nyckel
   - Generera med: `openssl rand -base64 32`
   - Spara säkert - om du tappar den kan du inte dekryptera sparade credentials

3. **DISCORD_WEBHOOK_URL**
   - Är också känslig (kan användas för att skicka meddelanden)
   - Skydda den som en secret

## Environment Variables Summary

| Variable | Backend (Render) | Frontend (Vercel) | Krävs | Beskrivning |
|----------|-----------------|-------------------|-------|-------------|
| `DISCORD_WEBHOOK_URL` | ✅ Ja | ❌ Nej | ✅ Ja | Webhook för att skicka meddelanden |
| `DISCORD_INVITE_LINK` | ✅ Ja | ❌ Nej | ✅ Ja | Invite link för community |
| `DISCORD_BOT_TOKEN` | ⚠️ Valfritt | ❌ Nej | ❌ Nej | Bot token (kan också skickas via API) |
| `CREDENTIAL_ENCRYPTION_KEY` | ✅ Ja | ❌ Nej | ✅ Ja* | För kryptering av användar-credentials |

*Krävs om användare ska kunna spara sina bot tokens i systemet

## Felsökning

### "DISCORD_WEBHOOK_URL is not set"
- Kontrollera att variabeln är satt på Render
- Kontrollera att servicen har startats om efter att variabeln lades till
- Kontrollera stavningen (case-sensitive)

### "Failed to connect Discord bot"
- Kontrollera att bot token är korrekt
- Kontrollera att "MESSAGE CONTENT INTENT" är aktiverad i Discord Developer Portal
- Kontrollera att boten är medlem i servern

### "Credential encryption failed"
- Kontrollera att `CREDENTIAL_ENCRYPTION_KEY` är minst 32 tecken
- Kontrollera att nyckeln är korrekt satt på Render

## Nästa steg

Efter att ha lagt till environment variables:
1. ✅ Restart backend service på Render
2. ✅ Testa webhook-funktionalitet
3. ✅ Testa bot-anslutning via API
4. ✅ Verifiera att Elon rekommenderar Discord-communityn korrekt


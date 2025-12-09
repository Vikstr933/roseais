# Discord Endpoints Setup Guide

## Översikt

Denna guide visar hur du konfigurerar Discord Developer Portal för att använda våra nya endpoints:
1. **Terms of Service URL** - Länk till Terms of Service-sidan
2. **Privacy Policy URL** - Länk till Privacy Policy-sidan
3. **Linked Roles Verification URL** - För automatisk roll-synkronisering
4. **Interactions Endpoint URL** - För slash commands och interaktiva knappar

---

## 1. Terms of Service & Privacy Policy URLs

### Steg 1: Gå till Discord Developer Portal
1. Öppna [Discord Developer Portal](https://discord.com/developers/applications)
2. Välj din application (Elon AI Bot)
3. Gå till **"General Information"** i vänstermenyn

### Steg 2: Lägg till URLs
1. Scrolla ner till **"Links"**-sektionen
2. Fyll i:
   - **Terms of Service URL:** `https://newai-sigma.vercel.app/terms`
   - **Privacy Policy URL:** `https://newai-sigma.vercel.app/privacy`
3. Klicka på **"Save Changes"**

### ✅ Klart!
Nu kommer Discord att visa dessa länkar när användare interagerar med din bot.

---

## 2. Linked Roles Verification URL

### Vad det gör:
- Verifierar att användare är medlemmar i Discord-servern
- Returnerar användarens plattform-roll (user, premium, admin, superadmin)
- Discord kan använda denna information för att automatiskt tilldela roller

### Steg 1: Konfigurera i Discord Developer Portal
1. Gå till **"General Information"** i Discord Developer Portal
2. Scrolla ner till **"Linked Roles Verification URL"**
3. Fyll i: `https://ai-library-backend.onrender.com/api/discord/verify-user`
4. Klicka på **"Save Changes"**

### Steg 2: Konfigurera i Discord Server
1. Öppna din Discord server
2. Gå till **Server Settings** → **Roles**
3. Välj en roll (t.ex. "Premium" eller "Admin")
4. Scrolla ner till **"Linked Roles"**
5. Klicka på **"Link Role"**
6. Välj din application (Elon AI Bot)
7. Konfigurera roll-krav baserat på metadata:
   
   **För Premium-roll:**
   - Välj metadata-nyckel: `is_premium`
   - Välj värde: `true`
   - Eller: `tier` = `pro` eller `enterprise`
   
   **För Admin-roll:**
   - Välj metadata-nyckel: `is_admin`
   - Välj värde: `true`
   - Eller: `role` = `admin` eller `superadmin`
   
   **För Enterprise-roll:**
   - Välj metadata-nyckel: `is_enterprise`
   - Välj värde: `true`
   - Eller: `tier` = `enterprise`

### API Response Format:
Vår endpoint returnerar metadata i detta format:
```json
{
  "platform_username": "vikstr",
  "verified": true,
  "metadata": {
    "role": "admin",
    "tier": "pro",
    "is_admin": true,
    "is_superadmin": false,
    "is_premium": true,
    "is_enterprise": false,
    "user_id": "...",
    "username": "vikstr"
  }
}
```

Discord kommer att matcha metadata-nycklar mot de krav du ställer i roll-inställningarna.

### ✅ Klart!
Nu kommer Discord automatiskt att tilldela roller baserat på användarens plattform-roll/tier.

---

## 3. Interactions Endpoint URL

### Vad det gör:
- Tar emot slash commands (`/help`, `/projects`, `/status`)
- Hanterar interaktiva knappar och select menus
- Hanterar modal forms

### Steg 1: Installera tweetnacl (för signature verification)
```bash
npm install tweetnacl
```

### Steg 2: Konfigurera i Discord Developer Portal
1. Gå till **"General Information"** i Discord Developer Portal
2. Scrolla ner till **"Interactions Endpoint URL"**
3. Fyll i: `https://ai-library-backend.onrender.com/api/discord/interactions`
4. Klicka på **"Save Changes"**

### Steg 3: Hämta Public Key
1. Gå till **"General Information"** i Discord Developer Portal
2. Kopiera **"Public Key"** (denna används för signature verification)
3. Lägg till i `.env`:
   ```
   DISCORD_PUBLIC_KEY=din_public_key_här
   ```

### Steg 4: Registrera Slash Commands (KRITISKT - Gör detta!)

För att slash commands ska fungera måste de registreras i Discord. Vi har skapat ett script för detta:

#### Metod 1: Använd vårt script (Rekommenderat)

```bash
# Sätt environment variables
export DISCORD_BOT_TOKEN=din_bot_token
export DISCORD_CLIENT_ID=din_client_id

# Kör scriptet
npx tsx scripts/register-discord-commands.ts
```

#### Metod 2: Via Discord Developer Portal (Manuellt)

1. Gå till **"General Information"** i Discord Developer Portal
2. Scrolla ner till **"Installation"**
3. Klicka på **"Add to Server"** eller använd OAuth2 URL Generator
4. Se till att `applications.commands` scope är valt
5. Invite boten till servern med denna scope

#### Metod 3: Via API (Programmatiskt)

Scriptet `scripts/register-discord-commands.ts` gör detta automatiskt. Kör det en gång för att registrera commands globalt.

**Viktigt:** Commands registreras globalt (tillgängliga i alla servrar där boten är medlem).

### Tillgängliga Slash Commands:
- `/help` - Visa hjälp och tillgängliga kommandon
- `/projects` - Lista dina projekt
- `/status` - Kontrollera systemstatus

### ✅ Klart!
Nu kan användare använda slash commands i Discord!

---

## 4. Testa Endpoints

### Test Linked Roles Verification:
```bash
curl "https://ai-library-backend.onrender.com/api/discord/verify-user?user_id=DISCORD_USER_ID"
```

### Test Interactions Endpoint:
```bash
# PING test (Discord skickar detta automatiskt)
curl -X POST https://ai-library-backend.onrender.com/api/discord/interactions \
  -H "Content-Type: application/json" \
  -d '{"type": 1}'
```

Förväntat svar: `{"type": 1}` (PONG)

---

## 5. Environment Variables

Lägg till i `.env`:
```env
# Discord Configuration
DISCORD_CLIENT_ID=din_client_id
DISCORD_CLIENT_SECRET=din_client_secret
DISCORD_BOT_TOKEN=din_bot_token
DISCORD_PUBLIC_KEY=din_public_key  # För Interactions Endpoint signature verification
```

---

## 6. Troubleshooting

### Linked Roles Verification returnerar null:
- Kontrollera att användaren har länkat sitt Discord-konto via OAuth
- Kontrollera att `discord_user_mappings` tabellen innehåller mappningen
- Kontrollera att användaren finns i `users` tabellen

### Interactions Endpoint returnerar 401:
- Kontrollera att `DISCORD_PUBLIC_KEY` är korrekt i `.env`
- Kontrollera att signature verification fungerar (kan hoppa över i development)

### Slash Commands visas inte:
- Kontrollera att boten har `applications.commands` scope
- Kontrollera att slash commands är registrerade (använd Discord Developer Portal eller API)
- Vänta några minuter - Discord kan ta tid att uppdatera commands

---

## 7. Nästa Steg

1. ✅ Konfigurera URLs i Discord Developer Portal
2. ✅ Testa Linked Roles Verification
3. ✅ Testa Interactions Endpoint
4. ✅ Registrera slash commands
5. ✅ Testa i Discord-servern

---

## Ytterligare Resurser

- [Discord Developer Documentation](https://discord.com/developers/docs)
- [Discord Interactions Guide](https://discord.com/developers/docs/interactions/overview)
- [Discord Linked Roles](https://discord.com/developers/docs/resources/role#role-object)


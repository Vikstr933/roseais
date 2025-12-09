# Discord Slash Commands - Snabbstart Guide

## Problem: Slash Commands visas inte i Discord

Om du inte kan använda `/projects`, `/help`, eller `/status` i Discord, behöver du registrera commands först.

---

## ✅ Lösning: Registrera Slash Commands

### Steg 1: Sätt Environment Variables

På din lokala maskin eller i Render backend:

```bash
export DISCORD_BOT_TOKEN=din_bot_token_här
export DISCORD_CLIENT_ID=din_client_id_här
```

**Eller på Render:**
1. Gå till Render Dashboard → Din backend service
2. Gå till "Environment"
3. Lägg till:
   - `DISCORD_BOT_TOKEN` = din bot token
   - `DISCORD_CLIENT_ID` = din client ID (finns i Discord Developer Portal → General Information)

### Steg 2: Kör Registrerings-Scriptet

**Lokalt:**
```bash
npm run register-discord-commands
```

**Eller direkt:**
```bash
npx tsx scripts/register-discord-commands.ts
```

**På Render (via SSH eller lokalt med Render credentials):**
```bash
# Om du har SSH-åtkomst till Render
npm run register-discord-commands
```

### Steg 3: Vänta och Testa

1. **Vänta 1-5 minuter** - Discord kan ta tid att uppdatera commands
2. **Testa i Discord:**
   - Skriv `/` i en kanal
   - Du bör se `/help`, `/projects`, `/status` i listan
3. **Om commands inte visas:**
   - Kontrollera att boten har `applications.commands` scope
   - Re-invite boten med denna scope
   - Vänta lite längre (kan ta upp till 1 timme för globala commands)

---

## 🔧 Troubleshooting

### "Error: 401 Unauthorized"
- **Problem:** `DISCORD_BOT_TOKEN` är fel eller saknas
- **Lösning:** Kontrollera att token är korrekt i environment variables

### "Error: 403 Forbidden"
- **Problem:** Boten saknar `applications.commands` scope
- **Lösning:** 
  1. Gå till Discord Developer Portal → OAuth2 → URL Generator
  2. Välj `applications.commands` scope
  3. Invite boten igen med denna scope

### "Commands registrerade men visas inte"
- **Problem:** Discord har inte uppdaterat ännu
- **Lösning:** 
  - Vänta 1-5 minuter
  - Försök skriva `/` i Discord igen
  - Om det inte fungerar, re-invite boten

### "Error: Invalid command format"
- **Problem:** Command-namn eller beskrivning är ogiltig
- **Lösning:** Kontrollera att command-namn är lowercase och inga mellanslag

---

## 📋 Tillgängliga Commands

Efter registrering kan användare använda:

- `/help` - Visa hjälp och tillgängliga kommandon
- `/projects` - Lista dina projekt (kräver länkat Discord-konto)
- `/status` - Kontrollera systemstatus och bot-anslutning

---

## 🎯 Nästa Steg

1. ✅ Registrera commands (kör scriptet)
2. ✅ Vänta 1-5 minuter
3. ✅ Testa `/help` i Discord
4. ✅ Testa `/projects` (efter att ha länkat Discord-konto)
5. ✅ Testa `/status`

---

## 💡 Tips

- **Globala vs Server-specifika commands:** Vårt script registrerar globalt (tillgängliga i alla servrar)
- **Uppdatera commands:** Om du ändrar commands, kör scriptet igen
- **Development:** För snabbare uppdateringar, registrera commands för en specifik server (guild) istället


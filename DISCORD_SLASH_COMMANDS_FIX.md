# Fix för Discord Slash Commands (/projects, /help, /status)

## Problem
Slash commands fungerar inte i Discord - inget händer när du skriver `/projects`.

## Lösning

Det finns två saker som måste göras:

### 1. Konfigurera Interactions Endpoint URL i Discord Developer Portal

1. Gå till [Discord Developer Portal](https://discord.com/developers/applications)
2. Välj din application (Elon AI Bot)
3. Gå till **"General Information"**
4. Scrolla ner till **"Interactions Endpoint URL"**
5. Fyll i: `https://ai-library-backend-3mmv.onrender.com/api/discord/interactions`
6. Klicka på **"Save Changes"**

**Viktigt:** Discord kommer att skicka en PING till din endpoint för att verifiera att den fungerar. Om den inte svarar korrekt kommer Discord inte att aktivera interactions.

### 2. Registrera Slash Commands med Discord

Slash commands måste registreras med Discord innan de kan användas. Vi har ett script för detta:

#### Steg 1: Sätt environment variables

På Render (eller i din `.env` fil):
```
DISCORD_BOT_TOKEN=din_bot_token
DISCORD_CLIENT_ID=din_client_id
```

#### Steg 2: Kör registrerings-scriptet

**Alternativ A: Kör lokalt (Rekommenderat för första gången)**
```bash
# Sätt environment variables
export DISCORD_BOT_TOKEN=din_bot_token
export DISCORD_CLIENT_ID=din_client_id

# Kör scriptet
npx tsx scripts/register-discord-commands.ts
```

**Alternativ B: Kör på Render (via SSH eller via script)**
```bash
# Via Render Dashboard -> Shell
npm run register-discord-commands
```

#### Steg 3: Verifiera att commands är registrerade

Efter att ha kört scriptet bör du se:
```
✅ Successfully registered 3 slash command(s)!

📋 Registered commands:
   - /help: Show help and available commands for Elon AI Assistant
   - /projects: List your projects on the platform
   - /status: Check system status and bot connection
```

### 3. Verifiera att Interactions Endpoint fungerar

Discord skickar automatiskt en PING när du sparar Interactions Endpoint URL. Du kan också testa manuellt:

```bash
curl -X POST https://ai-library-backend-3mmv.onrender.com/api/discord/interactions \
  -H "Content-Type: application/json" \
  -d '{"type": 1}'
```

Förväntat svar: `{"type": 1}` (PONG)

### 4. Testa i Discord

1. Vänta 1-2 minuter efter att ha registrerat commands (Discord behöver tid att synka)
2. I Discord, skriv `/` i en kanal där boten är medlem
3. Du bör se `/help`, `/projects`, och `/status` i listan
4. Testa `/projects` - det bör visa dina projekt (eller ett meddelande om du inte är länkad)

## Troubleshooting

### Commands visas inte i Discord
- **Vänta 1-2 minuter** - Discord behöver tid att synka commands
- **Kontrollera att boten är medlem i servern** - Commands är bara tillgängliga i servrar där boten är medlem
- **Kontrollera att boten har `applications.commands` scope** - Re-invite boten med denna scope om nödvändigt
- **Kontrollera Render logs** - Se om det finns fel när Discord försöker nå interactions endpoint

### "Invalid signature" fel
- Kontrollera att `DISCORD_PUBLIC_KEY` är satt korrekt i environment variables
- Public Key finns i Discord Developer Portal under "General Information"
- Kontrollera att interactions endpoint använder raw body för signature verification

### Interactions endpoint svarar inte
- Kontrollera att URL:en är korrekt: `https://ai-library-backend-3mmv.onrender.com/api/discord/interactions`
- Kontrollera Render logs för fel
- Testa PING manuellt med curl (se ovan)

### "/projects" visar "You need to link your Discord account"
- Detta är korrekt beteende om du inte har länkat ditt Discord-konto
- Gå till Integrations-sidan på plattformen och länka ditt Discord-konto
- Efter länkning, försök `/projects` igen

## Ytterligare Information

Se även:
- `DISCORD_ENDPOINTS_SETUP.md` - Fullständig guide för alla Discord endpoints
- `DISCORD_SLASH_COMMANDS_QUICKSTART.md` - Snabbstart-guide
- `scripts/register-discord-commands.ts` - Script för att registrera commands


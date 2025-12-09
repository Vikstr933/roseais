# Discord Bot Troubleshooting Guide

## Boten svarar inte på mentions

### Steg 1: Verifiera att boten är ansluten

```bash
# Kontrollera status
GET /api/discord/bot/status
Authorization: Bearer YOUR_SESSION_TOKEN
```

Förväntat svar:
```json
{
  "success": true,
  "connected": true,
  "botUser": {
    "id": "...",
    "username": "...",
    "tag": "..."
  }
}
```

Om `connected: false`, anslut boten:
```bash
POST /api/discord/bot/connect
Authorization: Bearer YOUR_SESSION_TOKEN
Content-Type: application/json

{
  "botToken": "MTQ0NDI2NTYyNTk3NDM0MTY2NA.G3TDdU.mBdiBLNRniGNaMdewNdxDjS7wUh8ArE_dhNRfE"
}
```

### Steg 2: Kontrollera Discord Developer Portal

1. Gå till [Discord Developer Portal](https://discord.com/developers/applications)
2. Välj din bot (Client ID: `1444265625974341664`)
3. Gå till "Bot" i vänstermenyn
4. Under "Privileged Gateway Intents", kontrollera:
   - ✅ **MESSAGE CONTENT INTENT** måste vara aktiverad!
   - ✅ **SERVER MEMBERS INTENT** (rekommenderas)

**VIKTIGT**: Om "MESSAGE CONTENT INTENT" inte är aktiverad kan boten INTE läsa meddelanden!

### Steg 3: Kontrollera Bot Permissions

1. I Discord, högerklicka på servern → "Server Settings"
2. Gå till "Roles" → Välj botens roll
3. Kontrollera att boten har:
   - ✅ View Channels
   - ✅ Send Messages
   - ✅ Read Message History
   - ✅ Use External Emojis (valfritt)

### Steg 4: Kontrollera att boten är i kanalen

- Boten måste vara medlem i kanalen där du skriver
- Boten måste ha rätt att läsa meddelanden i kanalen

### Steg 5: Testa med direkt mention

Prova att skriva:
```
@Elon AI hej
```

eller

```
@Elon hej
```

Boten svarar bara på:
- Meddelanden som nämner boten (mentions)
- Direkta meddelanden (DMs)

### Steg 6: Kontrollera Render Logs

1. Gå till Render Dashboard
2. Välj din backend service
3. Klicka på "Logs"
4. Sök efter "Discord" eller "MessageCreate"
5. Kontrollera om det finns felmeddelanden

### Steg 7: Testa med DM

1. Skicka ett direkt meddelande till boten (DM)
2. Boten bör svara automatiskt på DMs

## Vanliga Problem

### Problem 1: "MESSAGE CONTENT INTENT" inte aktiverad

**Symptom:** Boten är ansluten men svarar inte

**Lösning:**
1. Gå till Discord Developer Portal
2. Aktivera "MESSAGE CONTENT INTENT"
3. **VIKTIGT**: Du måste ansluta boten igen efter att ha aktiverat intent!

```bash
POST /api/discord/bot/disconnect
POST /api/discord/bot/connect
```

### Problem 2: Boten svarar inte på mentions

**Symptom:** Boten är ansluten men ignorerar mentions

**Möjliga orsaker:**
- Boten har inte "Read Message History" permission
- Boten är inte medlem i kanalen
- Boten lyssnar bara på specifik kanal (om channelId är satt)

**Lösning:**
- Kontrollera permissions
- Se till att boten är i kanalen
- Om du använde `channelId` vid anslutning, testa utan den

### Problem 3: Boten svarar men med fel

**Symptom:** Boten svarar men meddelandet är felaktigt

**Lösning:**
- Kontrollera Render logs för fel
- Testa att skicka ett enkelt meddelande: `@Elon AI test`

### Problem 4: Boten kopplar från automatiskt

**Symptom:** Boten ansluter men kopplar från efter några minuter

**Möjliga orsaker:**
- Token är ogiltig
- Nätverksproblem
- Render service går ner

**Lösning:**
- Kontrollera Render logs
- Verifiera att token är korrekt
- Kontrollera Render service status

## Debug-kommandon

### Testa bot-anslutning
```bash
curl -X POST https://din-backend-url.render.com/api/discord/bot/connect \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"botToken": "MTQ0NDI2NTYyNTk3NDM0MTY2NA.G3TDdU.mBdiBLNRniGNaMdewNdxDjS7wUh8ArE_dhNRfE"}'
```

### Kontrollera status
```bash
curl https://din-backend-url.render.com/api/discord/bot/status \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### Testa att skicka meddelande
```bash
curl -X POST https://din-backend-url.render.com/api/discord/bot/send \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channelId": "DIN_CHANNEL_ID", "content": "Test från API"}'
```

## Nästa Steg

Om inget av ovanstående fungerar:
1. Kontrollera Render logs för detaljerade felmeddelanden
2. Verifiera att alla environment variables är korrekt satta
3. Testa att ansluta boten igen från början


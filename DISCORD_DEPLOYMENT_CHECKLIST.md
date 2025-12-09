# Discord Deployment Checklist

## ✅ Före Deployment

- [x] Lagt till `DISCORD_WEBHOOK_URL` på Render
- [x] Lagt till `DISCORD_INVITE_LINK` på Render
- [x] Lagt till `CREDENTIAL_ENCRYPTION_KEY` på Render (om den inte redan fanns)
- [x] Startat om/redeployat backend service på Render

## ⏳ Under Deployment (Nu)

Medan Render deployar kan du:

1. **Kontrollera Discord Bot Setup**
   - [ ] Boten är tillagd i din Discord server
   - [ ] "MESSAGE CONTENT INTENT" är aktiverad i Discord Developer Portal
   - [ ] Boten har rätt permissions (Send Messages, Read Message History, View Channels)

2. **Förbered Test**
   - [ ] Välj en Discord kanal där du vill testa
   - [ ] Kopiera Channel ID (högerklicka på kanalen → "Copy ID" - kräver Developer Mode)
   - [ ] Ha din session token redo för API-anrop

## ✅ Efter Deployment

### Steg 1: Verifiera att backend är uppe
```bash
# Testa health endpoint
curl https://din-backend-url.render.com/api/health
```

### Steg 2: Testa Discord Webhook (Automatisk)
Elon bör automatiskt kunna skicka meddelanden via webhook när användare får Discord-rekommendationer.

### Steg 3: Testa Bot Connection
```bash
# Anslut boten via API
curl -X POST https://din-backend-url.render.com/api/discord/bot/connect \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "MTQ0NDI2NTYyNTk3NDM0MTY2NA.G3TDdU.mBdiBLNRniGNaMdewNdxDjS7wUh8ArE_dhNRfE"
  }'
```

Förväntat svar:
```json
{
  "success": true,
  "message": "Discord bot connected successfully",
  "botUser": {
    "id": "...",
    "username": "...",
    "tag": "..."
  }
}
```

### Steg 4: Kontrollera Bot Status
```bash
curl https://din-backend-url.render.com/api/discord/bot/status \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
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

### Steg 5: Testa i Discord
1. Gå till din Discord server
2. Skriv: `@Elon AI hej, kan du höra mig?`
3. Boten bör svara automatiskt!

## 🐛 Felsökning

### Deployment misslyckades
- [ ] Kontrollera Render logs för fel
- [ ] Verifiera att alla environment variables är korrekt formaterade
- [ ] Kontrollera att inga typos i variabelnamn

### Bot kan inte anslutas
- [ ] Verifiera att bot token är korrekt
- [ ] Kontrollera att "MESSAGE CONTENT INTENT" är aktiverad
- [ ] Verifiera att boten är medlem i servern
- [ ] Kontrollera Render logs för specifika felmeddelanden

### Bot svarar inte i Discord
- [ ] Kontrollera bot status: `GET /api/discord/bot/status`
- [ ] Verifiera att boten är medlem i kanalen
- [ ] Kontrollera att boten har "Read Message History" permission
- [ ] Testa med direkt mention: `@Elon AI test`

### Webhook fungerar inte
- [ ] Kontrollera att `DISCORD_WEBHOOK_URL` är korrekt satt
- [ ] Testa webhook manuellt:
```bash
curl -X POST "DIN_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message"}'
```

## 📊 Verifiering

Efter att allt fungerar:

- [ ] Bot kan anslutas via API
- [ ] Bot svarar på mentions i Discord
- [ ] Bot svarar på direkta meddelanden (DMs)
- [ ] Webhook kan skicka meddelanden
- [ ] Elon rekommenderar Discord-communityn korrekt
- [ ] Användare kan spara bot tokens säkert (krypterat)

## 🎉 Nästa Steg

När allt fungerar:

1. **Dokumentera för teamet**
   - Dela `DISCORD_BOT_QUICKSTART.md` med teamet
   - Uppdatera interna dokumentationer

2. **Överväg förbättringar**
   - [ ] Lägg till UI i frontend för bot-hantering
   - [ ] Lägg till slash commands
   - [ ] Lägg till logging av Discord-interaktioner
   - [ ] Lägg till rate limiting för bot-svar

3. **Monitorera**
   - [ ] Kolla Render logs regelbundet
   - [ ] Övervaka bot-anslutningar
   - [ ] Samla feedback från användare

## 🔗 Användbara Länkar

- [Render Dashboard](https://dashboard.render.com)
- [Discord Developer Portal](https://discord.com/developers/applications)
- [Discord Bot Invite](https://discord.com/oauth2/authorize?client_id=1444265625974341664&permissions=2815144904301568&integration_type=0&scope=bot+applications.commands)


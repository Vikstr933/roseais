# Discord Bot Setup Guide

## Översikt

Elon kan nu både **skicka och läsa meddelanden** via Discord! Detta görs genom en Discord bot som använder `discord.js` biblioteket.

## Skillnaden mellan Webhook och Bot

### Webhook (nuvarande DiscordService)
- ✅ Kan **skicka** meddelanden till Discord
- ❌ Kan **INTE** läsa meddelanden
- Används för: Automatiska notifikationer, feedback, bug reports

### Bot (ny DiscordBotService)
- ✅ Kan **skicka** meddelanden
- ✅ Kan **läsa** meddelanden
- ✅ Kan **svara** på meddelanden automatiskt
- Används för: Tvåvägskommunikation, automatiska svar från Elon

## Steg 1: Skapa en Discord Bot

1. Gå till [Discord Developer Portal](https://discord.com/developers/applications)
2. Klicka på "New Application" och ge den ett namn (t.ex. "Elon AI Bot")
3. Gå till "Bot" i vänstermenyn
4. Klicka på "Add Bot" och bekräfta
5. Under "Token", klicka på "Reset Token" eller "Copy" för att kopiera bot token
   - **VIKTIGT**: Spara denna token säkert! Du behöver den senare.
6. Under "Privileged Gateway Intents", aktivera:
   - ✅ **MESSAGE CONTENT INTENT** (krävs för att läsa meddelanden)
   - ✅ **SERVER MEMBERS INTENT** (om du vill ha medlemsinfo)

## Steg 2: Lägg till boten i din Discord server

1. Gå till "OAuth2" → "URL Generator" i Discord Developer Portal
2. Under "Scopes", välj:
   - ✅ `bot`
   - ✅ `applications.commands` (valfritt, för slash commands)
3. Under "Bot Permissions", välj:
   - ✅ Send Messages
   - ✅ Read Message History
   - ✅ View Channels
   - ✅ Read Messages/View Channels
4. Kopiera den genererade URL:en och öppna den i webbläsaren
5. Välj din Discord server och klicka "Authorize"

## Steg 3: Konfigurera boten i Elon

### Alternativ 1: Via API (Rekommenderat)

```bash
# Anslut boten
POST /api/discord/bot/connect
Authorization: Bearer YOUR_SESSION_TOKEN
Content-Type: application/json

{
  "botToken": "DIN_BOT_TOKEN_HÄR",
  "channelId": "OPTIONAL_CHANNEL_ID",  // Om du bara vill lyssna på en specifik kanal
  "serverId": "OPTIONAL_SERVER_ID"      // Om du bara vill lyssna på en specifik server
}
```

### Alternativ 2: Via Credential Vault UI

1. Gå till Settings → API Keys i Elon
2. Lägg till Discord credentials:
   - Service: Discord
   - Bot Token: Din bot token
   - Channel ID (valfritt)
   - Server ID (valfritt)
3. Använd sedan `/api/discord/bot/auto-connect` för att ansluta automatiskt

## API Endpoints

### Anslut boten
```http
POST /api/discord/bot/connect
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "botToken": "YOUR_BOT_TOKEN",
  "channelId": "OPTIONAL",
  "serverId": "OPTIONAL"
}
```

### Koppla från boten
```http
POST /api/discord/bot/disconnect
Authorization: Bearer YOUR_TOKEN
```

### Kontrollera status
```http
GET /api/discord/bot/status
Authorization: Bearer YOUR_TOKEN
```

### Skicka meddelande
```http
POST /api/discord/bot/send
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "channelId": "CHANNEL_ID",
  "content": "Hej från Elon!"
}
```

### Läsa meddelanden
```http
GET /api/discord/bot/read?channelId=CHANNEL_ID&limit=10
Authorization: Bearer YOUR_TOKEN
```

### Auto-anslut med sparade credentials
```http
POST /api/discord/bot/auto-connect
Authorization: Bearer YOUR_TOKEN
```

## Hur det fungerar

1. **När boten är ansluten**: Den lyssnar på meddelanden i Discord
2. **När någon nämner boten eller skickar DM**: 
   - Boten tar emot meddelandet
   - Skickar det till `PersonalAssistantAgent` (Elon)
   - Elon genererar ett svar
   - Boten skickar svaret tillbaka till Discord

3. **Filtrering**:
   - Boten svarar bara på meddelanden som nämner den (mentions) eller direkta meddelanden (DMs)
   - Om `channelId` är angivet, svarar den bara i den kanalen
   - Om `serverId` är angivet, svarar den bara i den servern

## Exempel: Användning från frontend

```typescript
// Anslut boten
const connectBot = async (botToken: string) => {
  const response = await fetch('/api/discord/bot/connect', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      botToken,
      channelId: '123456789', // Optional
    }),
  });
  
  const data = await response.json();
  console.log('Bot connected:', data);
};

// Kontrollera status
const checkStatus = async () => {
  const response = await fetch('/api/discord/bot/status', {
    headers: {
      'Authorization': `Bearer ${sessionToken}`,
    },
  });
  
  const data = await response.json();
  console.log('Bot status:', data);
};
```

## Säkerhet

- ✅ Bot tokens lagras krypterade i databasen
- ✅ Endast autentiserade användare kan ansluta boten
- ✅ Varje användare kan ha sin egen bot-instans
- ✅ Boten svarar bara på mentions eller DMs (inte på alla meddelanden)

## Felsökning

### Boten svarar inte
1. Kontrollera att boten är ansluten: `GET /api/discord/bot/status`
2. Kontrollera att "MESSAGE CONTENT INTENT" är aktiverad i Discord Developer Portal
3. Kontrollera att boten har rätt permissions i servern
4. Kontrollera att boten är medlem i kanalen

### "Invalid token" fel
- Kontrollera att bot token är korrekt
- Se till att du kopierade hela token (lång sträng)
- Kontrollera att token inte har gått ut (reset token i Discord Developer Portal)

### Boten kan inte läsa meddelanden
- Se till att "MESSAGE CONTENT INTENT" är aktiverad
- Se till att boten har "Read Message History" permission
- Se till att boten är medlem i kanalen

## Ytterligare funktioner

### Skicka meddelanden programmatiskt
```typescript
await discordBotService.sendMessage(
  'CHANNEL_ID',
  'Hej från Elon!',
  embed // Optional EmbedBuilder
);
```

### Läsa meddelanden programmatiskt
```typescript
const messages = await discordBotService.readMessages('CHANNEL_ID', 10);
messages.forEach(msg => {
  console.log(`${msg.author.tag}: ${msg.content}`);
});
```

## Nästa steg

- [ ] Lägg till slash commands support
- [ ] Lägg till reaktioner på meddelanden
- [ ] Lägg till stöd för flera kanaler samtidigt
- [ ] Lägg till rate limiting för bot-svar
- [ ] Lägg till logging av Discord-interaktioner


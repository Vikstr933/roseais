# Discord Bot Quick Start - Elon AI

## Din Bot Information

**Bot Token:**
```
MTQ0NDI2NTYyNTk3NDM0MTY2NA.G3TDdU.mBdiBLNRniGNaMdewNdxDjS7wUh8ArE_dhNRfE
```

**Bot Client ID:** `1444265625974341664`

**Lägg till boten i din server:**
[Klicka här för att lägga till boten](https://discord.com/oauth2/authorize?client_id=1444265625974341664&permissions=2815144904301568&integration_type=0&scope=bot+applications.commands)

## Snabbstart

### Steg 1: Lägg till boten i din Discord server
1. Klicka på länken ovan eller kopiera den till webbläsaren
2. Välj din Discord server
3. Klicka "Authorize"
4. Bekräfta att boten har rätt permissions

### Steg 2: Anslut boten till Elon

#### Via API (Rekommenderat)

```bash
curl -X POST http://localhost:3001/api/discord/bot/connect \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "MTQ0NDI2NTYyNTk3NDM0MTY2NA.G3TDdU.mBdiBLNRniGNaMdewNdxDjS7wUh8ArE_dhNRfE"
  }'
```

#### Via JavaScript/TypeScript

```typescript
const connectBot = async () => {
  const response = await fetch('/api/discord/bot/connect', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      botToken: 'MTQ0NDI2NTYyNTk3NDM0MTY2NA.G3TDdU.mBdiBLNRniGNaMdewNdxDjS7wUh8ArE_dhNRfE',
      // Optional: channelId: '123456789', // Om du bara vill lyssna på en specifik kanal
      // Optional: serverId: '123456789',  // Om du bara vill lyssna på en specifik server
    }),
  });
  
  const data = await response.json();
  if (data.success) {
    console.log('✅ Bot ansluten!', data.botUser);
  } else {
    console.error('❌ Kunde inte ansluta bot:', data.error);
  }
};
```

### Steg 3: Testa boten

1. Gå till din Discord server
2. Skriv ett meddelande som nämner boten: `@Elon AI hej!`
3. Boten bör svara automatiskt!

## Kontrollera Status

```typescript
const checkStatus = async () => {
  const response = await fetch('/api/discord/bot/status', {
    headers: {
      'Authorization': `Bearer ${sessionToken}`,
    },
  });
  
  const data = await response.json();
  console.log('Bot status:', data);
  // { success: true, connected: true, botUser: { id: '...', username: '...', tag: '...' } }
};
```

## Så här fungerar det

1. **När boten är ansluten**: Den lyssnar på meddelanden i Discord
2. **När någon nämner boten** (t.ex. `@Elon AI hej!`):
   - Boten tar emot meddelandet
   - Skickar det till Elon (PersonalAssistantAgent)
   - Elon genererar ett svar
   - Boten skickar svaret tillbaka till Discord

3. **Direkta meddelanden (DMs)**: Boten svarar också på direkta meddelanden

## Felsökning

### Boten svarar inte
1. Kontrollera status: `GET /api/discord/bot/status`
2. Se till att boten är medlem i kanalen
3. Se till att boten har "Read Message History" permission
4. Se till att "MESSAGE CONTENT INTENT" är aktiverad i Discord Developer Portal

### "Invalid token" fel
- Kontrollera att token är korrekt kopierad (ingen extra whitespace)
- Se till att token inte har gått ut (reset i Discord Developer Portal om nödvändigt)

## Ytterligare funktioner

### Skicka meddelande programmatiskt
```typescript
const sendMessage = async (channelId: string, message: string) => {
  const response = await fetch('/api/discord/bot/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channelId,
      content: message,
    }),
  });
  
  const data = await response.json();
  return data.success;
};
```

### Läsa meddelanden
```typescript
const readMessages = async (channelId: string, limit = 10) => {
  const response = await fetch(`/api/discord/bot/read?channelId=${channelId}&limit=${limit}`, {
    headers: {
      'Authorization': `Bearer ${sessionToken}`,
    },
  });
  
  const data = await response.json();
  return data.messages;
};
```

## Säkerhet

⚠️ **VIKTIGT**: Bot token är känslig information!
- Dela ALDRIG bot token publikt
- Lagra den säkert (den krypteras i databasen)
- Om token läcker, reset den omedelbart i Discord Developer Portal

## Nästa steg

- [ ] Skapa en UI-komponent i Elon för att enkelt ansluta boten
- [ ] Lägg till slash commands support
- [ ] Lägg till stöd för flera kanaler
- [ ] Lägg till logging av Discord-interaktioner


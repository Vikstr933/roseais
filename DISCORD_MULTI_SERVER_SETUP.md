# Guide: Lägga till Elon i flera Discord-servrar

## Översikt

Elon Discord-boten kan vara medlem i flera Discord-servrar samtidigt. Det finns två sätt att konfigurera detta:

1. **Lyssna på alla servrar** (rekommenderat): Lämna `serverId` tomt så lyssnar boten på alla servrar den är medlem i
2. **Lyssna på specifik server**: Ange `serverId` för att begränsa till en specifik server

## Steg 1: Bjud in boten till den nya servern

1. Gå till [Discord Developer Portal](https://discord.com/developers/applications)
2. Välj din Discord bot-applikation
3. Gå till **OAuth2** → **URL Generator**
4. Under **Scopes**, välj:
   - ✅ `bot`
   - ✅ `applications.commands` (valfritt)
5. Under **Bot Permissions**, välj:
   - ✅ Send Messages
   - ✅ Read Message History
   - ✅ View Channels
   - ✅ Read Messages/View Channels
6. Kopiera den genererade URL:en
7. Öppna URL:en i webbläsaren
8. **Välj den nya Discord-servern** (inte den gamla)
9. Klicka **Authorize**

Boten är nu medlem i den nya servern! 🎉

## Steg 2: Konfigurera boten för flera servrar

### Alternativ A: Lyssna på alla servrar (Rekommenderat)

Om du vill att boten ska lyssna på **alla servrar** den är medlem i:

1. Gå till **Settings** → **Integrations** → **Discord** i plattformen
2. Klicka på **Connect Bot** eller **Update Configuration**
3. Ange din **Bot Token**
4. **Lämna `serverId` tomt** (eller ta bort det om det redan finns)
5. **Lämna `channelId` tomt** (eller ta bort det om det redan finns)
6. Klicka **Connect**

Nu kommer boten att:
- ✅ Lyssna på mentions från **alla servrar** den är medlem i
- ✅ Svara på **direkta meddelanden (DMs)** från alla användare
- ✅ Fungera i alla kanaler i alla servrar

### Alternativ B: Begränsa till specifik server

Om du bara vill att boten ska lyssna på **en specifik server**:

1. Hämta server-ID:t:
   - I Discord: Högerklicka på servern → **Server Settings** → **Widget** → Server ID finns där
   - Eller använd Developer Mode: Högerklicka på servern → **Copy Server ID**
2. Gå till **Settings** → **Integrations** → **Discord**
3. Ange din **Bot Token**
4. Ange **Server ID** för den servern du vill lyssna på
5. (Valfritt) Ange **Channel ID** om du bara vill lyssna på en specifik kanal
6. Klicka **Connect**

## API-metoder

### Lista alla servrar boten är medlem i

```http
GET /api/discord/bot/servers
Authorization: Bearer YOUR_TOKEN
```

Svar:
```json
{
  "success": true,
  "servers": [
    {
      "id": "822863750939148329",
      "name": "Min Server",
      "memberCount": 50
    },
    {
      "id": "123456789012345678",
      "name": "Min Andra Server",
      "memberCount": 25
    }
  ],
  "count": 2
}
```

### Uppdatera konfiguration för att lyssna på alla servrar

```http
POST /api/discord/bot/connect
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "botToken": "DIN_BOT_TOKEN",
  "serverId": null,  // Lämna tomt eller null för att lyssna på alla
  "channelId": null  // Lämna tomt eller null för att lyssna på alla kanaler
}
```

### Uppdatera konfiguration för specifik server

```http
POST /api/discord/bot/connect
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "botToken": "DIN_BOT_TOKEN",
  "serverId": "822863750939148329",  // Specifik server ID
  "channelId": null  // Lämna tomt för alla kanaler i servern
}
```

## Hur det fungerar

### När `serverId` är tomt/null:
- ✅ Boten lyssnar på mentions från **alla servrar** den är medlem i
- ✅ Boten svarar på **direkta meddelanden (DMs)** från alla användare
- ✅ Boten kan skicka meddelanden till **vilken kanal som helst** i **vilken server som helst**

### När `serverId` är angivet:
- ✅ Boten lyssnar **bara** på mentions från den angivna servern
- ✅ Boten svarar fortfarande på **direkta meddelanden (DMs)** från alla användare
- ✅ Boten kan skicka meddelanden till **vilken kanal som helst** i den angivna servern

### När både `serverId` och `channelId` är angivna:
- ✅ Boten lyssnar **bara** på mentions från den angivna kanalen i den angivna servern
- ✅ Boten svarar fortfarande på **direkta meddelanden (DMs)** från alla användare
- ✅ Boten kan skicka meddelanden till den angivna kanalen

## Tips

1. **För flera servrar**: Lämna `serverId` tomt så fungerar boten i alla servrar automatiskt
2. **För en specifik server**: Ange `serverId` för bättre kontroll
3. **För en specifik kanal**: Ange både `serverId` och `channelId`
4. **Direkta meddelanden**: Fungerar alltid, oavsett konfiguration

## Felsökning

### Boten svarar inte i den nya servern

1. Kontrollera att boten faktiskt är medlem i servern:
   - Gå till servern i Discord
   - Kolla medlemslistan - boten ska synas där
2. Kontrollera att boten har rätt behörigheter:
   - Boten behöver "Send Messages" och "Read Message History"
3. Kontrollera konfigurationen:
   - Om `serverId` är angivet, måste det matcha den nya serverns ID
   - Eller ta bort `serverId` för att lyssna på alla servrar

### Se vilka servrar boten är medlem i

Använd API-endpointen:
```http
GET /api/discord/bot/servers
```

Eller kolla loggarna när boten startar - den listar alla servrar den är medlem i.


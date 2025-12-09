# Enkel Guide: Koppla Elon till din Discord-server 🚀

## Snabbstart (3 enkla steg)

### Steg 1: Skapa en Discord Bot (om du inte redan har en)

1. Gå till [Discord Developer Portal](https://discord.com/developers/applications)
2. Klicka på **"New Application"** och ge den ett namn (t.ex. "Elon AI Bot")
3. Gå till **"Bot"** i vänstermenyn
4. Klicka på **"Add Bot"** och bekräfta
5. Under **"Token"**, klicka på **"Reset Token"** eller **"Copy"** för att kopiera bot token
   - **VIKTIGT**: Spara denna token säkert! Du behöver den i steg 3.
6. Under **"Privileged Gateway Intents"**, aktivera:
   - ✅ **MESSAGE CONTENT INTENT** (krävs för att läsa meddelanden)
   - ✅ **SERVER MEMBERS INTENT** (om du vill ha medlemsinfo)

### Steg 2: Lägg till boten i din Discord-server

1. I Discord Developer Portal, gå till **"OAuth2"** → **"URL Generator"**
2. Under **"Scopes"**, välj:
   - ✅ `bot`
   - ✅ `applications.commands` (valfritt, för slash commands)
3. Under **"Bot Permissions"**, välj:
   - ✅ Send Messages
   - ✅ Read Message History
   - ✅ View Channels
   - ✅ Read Messages/View Channels
4. Kopiera den genererade URL:en (den ser ut ungefär så här: `https://discord.com/oauth2/authorize?client_id=...`)
5. Öppna URL:en i webbläsaren
6. **Välj din Discord-server** och klicka **"Authorize"**
7. Bekräfta att boten har rätt permissions

✅ **Boten är nu medlem i din server!** Du kan se den i medlemslistan.

### Steg 3: Anslut boten till Elon (via webbappen)

1. Logga in på din Elon-plattform
2. Gå till **Settings** → **Integrations** (eller direkt till `/integrations`)
3. Scrolla ner till **"Discord Bot"**-sektionen (syns bara för admins/superadmins)
4. Fyll i formuläret:
   - **Discord Bot Token**: Klistra in bot token från steg 1
   - **Discord Server ID** (valfritt): Om du bara vill att boten ska lyssna på en specifik server
     - För att hitta Server ID: Aktivera Developer Mode i Discord → Högerklicka på servern → "Copy Server ID"
   - **Default Channel ID** (valfritt): Om du vill att boten ska använda en specifik kanal som standard
5. Klicka på **"Connect Discord Bot"**

✅ **Klart!** Elon är nu ansluten till din Discord-server!

## Testa att det fungerar

1. Gå till din Discord-server
2. Skriv ett meddelande som nämner boten: `@Elon hej!` eller `@Elon vad kan du hjälpa mig med?`
3. Boten bör svara automatiskt! 🎉

## Tips

### För flera servrar
- **Lämna Server ID tomt** → Boten lyssnar på alla servrar den är medlem i
- **Ange Server ID** → Boten lyssnar bara på den specifika servern

### För specifika kanaler
- **Lämna Channel ID tomt** → Boten kan använda alla kanaler
- **Ange Channel ID** → Boten använder den kanalen som standard

### Hitta IDs i Discord
1. Aktivera **Developer Mode** i Discord:
   - Discord → Settings → Advanced → Developer Mode (ON)
2. Högerklicka på servern → **"Copy Server ID"**
3. Högerklicka på en kanal → **"Copy Channel ID"**

## Felsökning

### Boten svarar inte
- ✅ Kontrollera att boten är medlem i servern (kolla medlemslistan)
- ✅ Kontrollera att boten har rätt permissions (Send Messages, Read Messages)
- ✅ Kontrollera att bot token är korrekt
- ✅ Kontrollera att boten är online i Integrations-sidan

### "Failed to connect Discord bot"
- ✅ Kontrollera att bot token är korrekt (kopiera igen från Developer Portal)
- ✅ Kontrollera att MESSAGE CONTENT INTENT är aktiverat i Developer Portal
- ✅ Kontrollera att du är inloggad som admin/superadmin

### Boten svarar inte i en specifik server
- ✅ Om du har angett Server ID, kontrollera att det är rätt server
- ✅ Om du vill att boten ska lyssna på alla servrar, lämna Server ID tomt

## Ytterligare hjälp

- Se `DISCORD_MULTI_SERVER_SETUP.md` för mer information om flera servrar
- Se `DISCORD_BOT_SETUP.md` för mer detaljerad information
- Kontakta support om du behöver hjälp!


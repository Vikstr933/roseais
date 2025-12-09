# Discord Bot - Enkel Guide

## Steg 1: Hämta din Session Token

Du behöver din session token från Elon-appen. Här är två sätt:

### Metod 1: Från webbläsaren (Enklast)
1. Öppna Elon i webbläsaren
2. Öppna Developer Tools (F12 eller högerklicka → "Inspect")
3. Gå till "Application" eller "Storage" tab
4. Klicka på "Local Storage" → Välj din domän
5. Hitta `sessionToken` och kopiera värdet

### Metod 2: Från Console
1. Öppna Developer Tools (F12)
2. Gå till "Console" tab
3. Skriv: `localStorage.getItem('sessionToken')`
4. Kopiera värdet (utan citattecken)

## Steg 2: Anslut Boten

### Alternativ A: Via Terminal (Windows PowerShell)

Öppna PowerShell och kör:

```powershell
# Ersätt YOUR_SESSION_TOKEN med din token från steg 1
# Ersätt YOUR_BACKEND_URL med din Render URL (t.ex. https://din-app.onrender.com)

$token = "YOUR_SESSION_TOKEN"
$url = "YOUR_BACKEND_URL/api/discord/bot/connect"

$body = @{
    botToken = "MTQ0NDI2NTYyNTk3NDM0MTY2NA.G3TDdU.mBdiBLNRniGNaMdewNdxDjS7wUh8ArE_dhNRfE"
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body
```

**Exempel:**
```powershell
$token = "abc123xyz..."
$url = "https://din-app.onrender.com/api/discord/bot/connect"

$body = @{
    botToken = "MTQ0NDI2NTYyNTk3NDM0MTY2NA.G3TDdU.mBdiBLNRniGNaMdewNdxDjS7wUh8ArE_dhNRfE"
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body
```

Om det fungerar ser du:
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

### Alternativ B: Via Postman eller Insomnia

1. Skapa en ny POST request
2. URL: `https://din-backend-url.render.com/api/discord/bot/connect`
3. Headers:
   - `Authorization`: `Bearer DIN_SESSION_TOKEN`
   - `Content-Type`: `application/json`
4. Body (JSON):
```json
{
  "botToken": "MTQ0NDI2NTYyNTk3NDM0MTY2NA.G3TDdU.mBdiBLNRniGNaMdewNdxDjS7wUh8ArE_dhNRfE"
}
```
5. Klicka "Send"

### Alternativ C: Via Webbläsaren (JavaScript Console)

1. Öppna Developer Tools (F12) i Elon-appen
2. Gå till "Console" tab
3. Klistra in detta (ersätt token och URL):

```javascript
const token = localStorage.getItem('sessionToken');
const url = 'https://din-backend-url.render.com/api/discord/bot/connect';

fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    botToken: 'MTQ0NDI2NTYyNTk3NDM0MTY2NA.G3TDdU.mBdiBLNRniGNaMdewNdxDjS7wUh8ArE_dhNRfE'
  })
})
.then(res => res.json())
.then(data => console.log('Resultat:', data))
.catch(err => console.error('Fel:', err));
```

## Steg 3: Kontrollera Status

### Via PowerShell:
```powershell
$token = "YOUR_SESSION_TOKEN"
$url = "YOUR_BACKEND_URL/api/discord/bot/status"

$headers = @{
    "Authorization" = "Bearer $token"
}

Invoke-RestMethod -Uri $url -Method Get -Headers $headers
```

### Via JavaScript Console:
```javascript
const token = localStorage.getItem('sessionToken');
const url = 'https://din-backend-url.render.com/api/discord/bot/status';

fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => {
  console.log('Bot status:', data);
  if (data.connected) {
    console.log('✅ Bot är ansluten!');
    console.log('Bot användare:', data.botUser);
  } else {
    console.log('❌ Bot är INTE ansluten');
  }
});
```

## Steg 4: Testa i Discord

1. Gå till din Discord server
2. Skriv i en kanal: `@Elon AI hej`
3. Boten bör svara!

## Felsökning

### "Unauthorized" eller 401 fel
- Kontrollera att din session token är korrekt
- Se till att du är inloggad i Elon-appen
- Hämta token igen från localStorage

### "Failed to connect Discord bot"
- Kontrollera att bot token är korrekt
- Se till att "MESSAGE CONTENT INTENT" är aktiverad i Discord Developer Portal
- Kontrollera Render logs för mer information

### Boten svarar inte i Discord
1. Kontrollera status: `GET /api/discord/bot/status`
2. Kontrollera Render logs
3. Se till att boten är medlem i kanalen
4. Testa med direkt mention: `@Elon AI test`

## Snabbkommando - Allt i ett

Klistra in detta i PowerShell (ersätt token och URL):

```powershell
# Anslut boten
$token = "DIN_SESSION_TOKEN"
$baseUrl = "https://din-backend-url.render.com"

# Anslut
Write-Host "Ansluter boten..." -ForegroundColor Yellow
$connectBody = @{
    botToken = "MTQ0NDI2NTYyNTk3NDM0MTY2NA.G3TDdU.mBdiBLNRniGNaMdewNdxDjS7wUh8ArE_dhNRfE"
} | ConvertTo-Json

$connectHeaders = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$connectResult = Invoke-RestMethod -Uri "$baseUrl/api/discord/bot/connect" -Method Post -Headers $connectHeaders -Body $connectBody
Write-Host "Anslutningsresultat:" -ForegroundColor Green
$connectResult | ConvertTo-Json

# Kontrollera status
Write-Host "`nKontrollerar status..." -ForegroundColor Yellow
$statusHeaders = @{
    "Authorization" = "Bearer $token"
}
$statusResult = Invoke-RestMethod -Uri "$baseUrl/api/discord/bot/status" -Method Get -Headers $statusHeaders
Write-Host "Status:" -ForegroundColor Green
$statusResult | ConvertTo-Json
```


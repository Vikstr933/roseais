# Discord-konto Koppling - Guide

## Översikt

För att Discord-användare ska kunna chatta med Elon och se sina projekt behöver de koppla sitt Discord-konto till sitt system-konto på webbappen.

## Hur det fungerar

1. **Användare skriver till Elon i Discord** → Boten söker efter Discord user mapping
2. **Om mapping finns** → Användaren kan se sina projekt och chatta med Elon
3. **Om mapping saknas** → Boten skickar instruktioner om hur man kopplar sitt konto

## För användare: Så här kopplar du ditt Discord-konto

### Steg 1: Hitta ditt Discord User ID

1. Öppna Discord → **Inställningar** (⚙️)
2. Gå till **Avancerat** (Advanced)
3. Aktivera **"Utvecklarläge"** (Developer Mode)
4. Högerklicka på ditt namn i Discord → **"Kopiera ID"** (Copy ID)
5. Du får ett nummer som ser ut så här: `123456789012345678`

### Steg 2: Koppla ditt konto på webbappen

**Alternativ 1: Via API (för utvecklare)**

```bash
POST /api/discord/link
Authorization: Bearer YOUR_SESSION_TOKEN
Content-Type: application/json

{
  "discordUserId": "123456789012345678",
  "discordUsername": "ditt_discord_namn" // Optional
}
```

**Alternativ 2: Via webbapp (kommer snart)**

1. Logga in på webbappen
2. Gå till **Inställningar** → **Integrations** → **Discord**
3. Klistra in ditt Discord User ID
4. Klicka på **"Koppla Discord-konto"**

## API Endpoints

### POST /api/discord/link
Koppla Discord-konto till system-konto

**Request:**
```json
{
  "discordUserId": "123456789012345678",
  "discordUsername": "vikstr", // Optional
  "verificationCode": "optional_code" // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Discord account linked successfully",
  "mapping": {
    "id": 1,
    "discordUserId": "123456789012345678",
    "discordUsername": "vikstr",
    "systemUserId": "user-uuid",
    "verified": false,
    "createdAt": "2025-01-28T12:00:00Z"
  }
}
```

### GET /api/discord/link/status
Kontrollera om Discord-konto är kopplat

**Response:**
```json
{
  "success": true,
  "linked": true,
  "mapping": {
    "id": 1,
    "discordUserId": "123456789012345678",
    "discordUsername": "vikstr",
    "systemUserId": "user-uuid"
  }
}
```

### DELETE /api/discord/link
Avkoppla Discord-konto

**Response:**
```json
{
  "success": true,
  "message": "Discord account unlinked successfully"
}
```

## Säkerhet

- ✅ **En Discord-användare kan bara kopplas till ett system-konto**
- ✅ **Ett system-konto kan bara ha en Discord-koppling**
- ✅ **Om Discord-användare redan är kopplad till annat konto → 409 Conflict**
- ✅ **Alla endpoints kräver autentisering**

## Databas Schema

```sql
CREATE TABLE discord_user_mappings (
  id SERIAL PRIMARY KEY,
  discord_user_id TEXT UNIQUE NOT NULL,
  discord_username TEXT,
  system_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verified BOOLEAN DEFAULT false,
  verification_code TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(discord_user_id),
  UNIQUE(system_user_id)
);
```

## Testa

1. **Koppla ditt konto:**
```bash
curl -X POST https://ai-library-backend-3mmv.onrender.com/api/discord/link \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"discordUserId": "DITT_DISCORD_ID"}'
```

2. **Skriv till Elon i Discord:**
```
@Elon visa mina projekt
```

3. **Elon bör nu kunna se dina projekt!** 🎉

## Felsökning

### "No Discord user mapping found"
- Kontrollera att du har kopplat ditt konto via `/api/discord/link`
- Verifiera att Discord User ID är korrekt (ingen typo)

### "This Discord account is already linked to another user"
- Discord-kontot är redan kopplat till ett annat system-konto
- Kontakta support om du behöver flytta kopplingen

### "Discord account not linked"
- Använd `/api/discord/link` för att koppla ditt konto
- Verifiera att du är inloggad med rätt system-konto


# Discord User Mapping & Project Access

## Nuvarande Implementation

### Hur det fungerar nu:

1. **Bot Connection**: När du ansluter Discord-boten via `/api/discord/bot/connect`, sparas ditt system user ID i bot-konfigurationen
2. **Meddelanden i Discord**: När någon skriver till boten i Discord:
   - Boten använder **bot-ägarens user ID** (den som anslöt boten)
   - Detta betyder att **alla** i Discord ser **bot-ägarens projekt**
   - Andra Discord-användare kan inte se sina egna projekt

### Säkerhet:

- ✅ **Endast bot-ägarens projekt syns** - Andra Discord-användare kan inte se någons projekt
- ✅ **Ingen projektåtkomst för okända användare** - Om boten inte är korrekt ansluten, visas inga projekt

## Problem

**Användaren vill:**
- Bara den specifika Discord-användaren ska kunna se sina egna projekt
- Andra Discord-användare ska inte kunna se någons projekt

**Nuvarande beteende:**
- Alla Discord-användare ser bot-ägarens projekt (inte önskat)

## Lösning: User Mapping

För att fixa detta behöver vi koppla Discord user ID till system user ID. Det finns flera alternativ:

### Alternativ 1: Email Matchning (Enklast)

Matcha Discord-användare med system-användare via email:

```typescript
// I handleDiscordMessage:
const discordEmail = message.author.email; // Om Discord-användaren har verifierat email
if (discordEmail) {
  const user = await userService.getUserByEmail(discordEmail);
  if (user) {
    systemUserId = user.id; // Använd denna användares projekt
  }
}
```

**Problem**: Discord-användare måste ha verifierat email, och email måste matcha system-användarens email.

### Alternativ 2: Explicit Koppling (Bäst)

Skapa en tabell som kopplar Discord user ID till system user ID:

```sql
CREATE TABLE discord_user_mappings (
  id TEXT PRIMARY KEY,
  discord_user_id TEXT UNIQUE NOT NULL,
  system_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Fördelar**:
- Exakt kontroll över vem som kan se vad
- Stödjer flera Discord-användare
- Säker - ingen gissning

**Implementation**:
1. Skapa endpoint `/api/discord/link` där användare kan koppla sitt Discord-konto
2. När meddelande kommer in, sök i `discord_user_mappings` tabellen
3. Använd rätt system user ID baserat på Discord user ID

### Alternativ 3: Bot Owner Only (Nuvarande)

Behåll nuvarande beteende - bara bot-ägaren ser sina projekt.

**Fördelar**:
- Enkelt
- Säker (inga projekt för okända användare)

**Nackdelar**:
- Andra Discord-användare kan inte se sina projekt
- Alla ser bot-ägarens projekt

## Rekommendation

**För nu**: Behåll nuvarande implementation (Alternativ 3) - det är säkrast.

**För framtiden**: Implementera Alternativ 2 (Explicit Koppling) för att stödja flera användare.

## Testa Nuvarande Implementation

1. Anslut boten via `/api/discord/bot/connect` (med ditt user ID)
2. Skriv till boten i Discord: "Visa mina projekt"
3. Boten bör visa dina projekt (bot-ägarens projekt)
4. Om någon annan skriver i Discord, ser de också dina projekt (inte deras egna)

## Förbättringar som behövs

För att stödja flera användare behöver vi:

1. **Skapa `discord_user_mappings` tabell**
2. **Skapa endpoint för att koppla Discord-konto**: `/api/discord/link`
3. **Uppdatera `handleDiscordMessage`** för att söka i mappningstabellen
4. **Uppdatera system prompt** för att förklara att Elon kan se projekt


# Migration Instructions - project_members & discord_user_mappings Tables

## Översikt

Två nya tabeller behöver skapas i PostgreSQL-databasen:

1. **`project_members`** - Spårar användare som är medlemmar i projekt
2. **`discord_user_mappings`** - Kopplar Discord-användare till system-användare

## Metod 1: Supabase SQL Editor (Rekommenderat)

### Steg 1: Öppna Supabase SQL Editor

1. Gå till [Supabase Dashboard](https://supabase.com/dashboard)
2. Välj ditt projekt
3. Gå till **SQL Editor** i vänstermenyn

### Steg 2: Skapa project_members tabell

Kopiera och klistra in följande SQL i SQL Editor:

```sql
-- Create project_members table
CREATE TABLE IF NOT EXISTS project_members (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  permissions JSONB DEFAULT '{}',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT unique_project_user UNIQUE (project_id, user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_is_active ON project_members(is_active) WHERE is_active = true;
```

Eller använd filen: `server/scripts/create-project-members-table.sql`

### Steg 3: Skapa discord_user_mappings tabell

Kopiera och klistra in följande SQL:

```sql
-- Create discord_user_mappings table
CREATE TABLE IF NOT EXISTS discord_user_mappings (
  id SERIAL PRIMARY KEY,
  discord_user_id TEXT UNIQUE NOT NULL,
  discord_username TEXT,
  system_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verified BOOLEAN DEFAULT false,
  verification_code TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_discord_user UNIQUE (discord_user_id),
  CONSTRAINT unique_system_user UNIQUE (system_user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_discord_user_mappings_discord_user_id ON discord_user_mappings(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_discord_user_mappings_system_user_id ON discord_user_mappings(system_user_id);
```

Eller använd filen: `server/scripts/create-discord-user-mappings-table.sql`

### Steg 4: Verifiera

Kör följande för att verifiera att tabellerna skapades:

```sql
-- Check project_members
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'project_members'
ORDER BY ordinal_position;

-- Check discord_user_mappings
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'discord_user_mappings'
ORDER BY ordinal_position;
```

## Metod 2: Node.js Script (Alternativ)

Om du vill köra via script istället:

```bash
# För project_members
npx tsx server/scripts/create-project-members-table.ts

# För discord_user_mappings
npx tsx server/scripts/add-discord-user-mappings-table.ts
```

**OBS:** 
- Se till att `DATABASE_URL` environment variable är satt korrekt
- Kör **INTE** TypeScript-filerna i SQL Editor - använd `.sql` filerna istället!

## Varför behöver vi dessa tabeller?

### project_members
- **Problem:** När användare försöker öppna ett projekt får de `404 Not Found` error
- **Orsak:** `getProjectMembers` funktionen försöker läsa från `project_members` tabellen som inte finns
- **Lösning:** Skapa tabellen så att projekt kan laddas korrekt

### discord_user_mappings
- **Problem:** Discord-användare kan inte se sina projekt i Discord
- **Orsak:** Ingen koppling mellan Discord User ID och System User ID
- **Lösning:** Tabellen kopplar Discord-användare till system-användare

## Efter Migration

Efter att tabellerna är skapade:

1. **Testa projekt-åtkomst:**
   - Skapa ett nytt projekt
   - Försök öppna projektet
   - Det bör fungera utan 404-fel

2. **Testa Discord-koppling:**
   - Gå till Settings → Integrations
   - Koppla ditt Discord-konto
   - Testa att skriva till Elon i Discord

## Felsökning

### "relation project_members does not exist"
- Tabellen är inte skapad än
- Kör SQL-scriptet i Supabase SQL Editor

### "relation discord_user_mappings does not exist"
- Tabellen är inte skapad än
- Kör SQL-scriptet i Supabase SQL Editor

### "Cannot convert undefined or null to object"
- Tabellen finns men är tom eller har fel struktur
- Kontrollera att tabellerna skapades korrekt med verifierings-SQL:en

## Rollback (Om något går fel)

Om du behöver ta bort tabellerna:

```sql
-- ⚠️ VARNING: Detta tar bort alla data i tabellerna!
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS discord_user_mappings CASCADE;
```


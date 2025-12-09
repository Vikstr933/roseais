# Supabase Setup Guide för Database Provisioning

## Översikt

Denna guide visar hur du konfigurerar Supabase för automatisk databas-provisioning för användarnas projekt. När användare genererar eller importerar fullstack-applikationer kommer systemet automatiskt skapa databaser åt dem.

## Steg 1: Skapa Supabase-projekt

### 1.1 Skapa konto och projekt

1. Gå till [supabase.com](https://supabase.com)
2. Klicka på **"Start your project"** eller **"Sign in"** om du redan har ett konto
3. Logga in med GitHub, Google eller email
4. Klicka på **"New Project"**
5. Fyll i:
   - **Name**: T.ex. "AI Library Production" eller "vik-databases"
   - **Database Password**: Välj ett starkt lösenord (spara detta - du behöver det senare!)
   - **Region**: Välj närmaste region (t.ex. "West Europe" för Sverige)
   - **Pricing Plan**: Välj "Free" för att börja (eller "Pro" för production)
6. Klicka på **"Create new project"**
7. Vänta 2-3 minuter medan projektet skapas

### 1.2 Hämta API-nycklar

När projektet är klart:

1. I Supabase Dashboard, gå till **Settings** → **API** (vänster meny)
2. Du ser nu flera viktiga värden:

#### Project URL
- **Vad det är**: Din Supabase-projekt URL
- **Var du hittar det**: Under "Project URL" i API-settings
- **Exempel**: `https://abcdefghijklmnop.supabase.co`
- **Spara detta som**: `SUPABASE_URL`

#### Service Role Key (SECRET!)
- **Vad det är**: En master-nyckel som ger full åtkomst till databasen
- **Var du hittar det**: Under "Project API keys" → "service_role" → "secret" (klicka på ögat för att visa)
- **Varning**: Denna nyckel ger FULL åtkomst - dela ALDRIG denna publikt!
- **Spara detta som**: `SUPABASE_SERVICE_ROLE_KEY`

#### Database Password
- **Vad det är**: Lösenordet du angav när du skapade projektet
- **Var du hittar det**: Du angav detta när du skapade projektet (om du glömt det, se "Reset Database Password" i Settings → Database)
- **Spara detta som**: `SUPABASE_DB_PASSWORD`

#### Database Connection String
- **Vad det är**: Connection string för att ansluta till databasen
- **Var du hittar det**: Settings → Database → Connection string → "Connection pooling" (port 6543)
- **Format**: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true`
- **Notera**: Ersätt `[PASSWORD]` med ditt database password och `[PROJECT-REF]` med din project reference

## Steg 2: Konfigurera Environment Variables

### 2.1 Lokal Development (.env)

Lägg till dessa i din `.env` fil i projektets root:

```env
# Supabase Configuration för Database Provisioning
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQwMDAwMDAwLCJleHAiOjE5NTU1NzYwMDB9.example
SUPABASE_DB_PASSWORD=ditt_database_lösenord_här
```

**Viktigt**: 
- Ersätt `abcdefghijklmnop` med din faktiska project reference
- Ersätt `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` med din faktiska Service Role Key
- Ersätt `ditt_database_lösenord_här` med ditt faktiska database password

### 2.2 Production (Render/Vercel)

#### För Render:

1. Gå till ditt Render Dashboard
2. Välj ditt backend service
3. Gå till **Environment** tab
4. Lägg till dessa environment variables:

```
SUPABASE_URL = https://abcdefghijklmnop.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DB_PASSWORD = ditt_database_lösenord_här
```

5. Klicka på **"Save Changes"**
6. Render kommer automatiskt deploya om med nya environment variables

#### För Vercel:

1. Gå till ditt Vercel Dashboard
2. Välj ditt projekt
3. Gå till **Settings** → **Environment Variables**
4. Lägg till samma tre variabler som ovan
5. Välj environments (Production, Preview, Development)
6. Klicka på **"Save"**

## Steg 3: Kör Database Migration

### 3.1 Skapa project_databases tabellen

1. Gå till Supabase Dashboard → **SQL Editor** (vänster meny)
2. Klicka på **"New query"**
3. Öppna filen `migrations/2025_add_project_databases_table.sql` i ditt projekt
4. Kopiera hela innehållet (Ctrl+A, Ctrl+C)
5. Klistra in i SQL Editor (Ctrl+V)
6. Klicka på **"Run"** eller tryck Ctrl+Enter
7. Du bör se: "Success. No rows returned"

### 3.2 Verifiera att tabellen skapades

1. I Supabase Dashboard, gå till **Table Editor** (vänster meny)
2. Du bör nu se `project_databases` tabellen i listan
3. Klicka på den för att se strukturen

## Steg 4: Testa Database Provisioning

### 4.1 Testa lokalt

1. Starta din backend:
   ```bash
   npm run dev:server
   ```

2. Testa genom att importera ett projekt som behöver databas:
   - Använd GitHub-plugin för att importera ett MERN-projekt
   - Eller generera en fullstack-app med Chap-ZPT

3. Kontrollera logs för att se om provisioning lyckades:
   ```
   [DatabaseProvisioningService] INFO: Provisioning database
   [DatabaseProvisioningService] INFO: Supabase database provisioned
   ```

### 4.2 Verifiera i Supabase

1. Gå till Supabase Dashboard → **Table Editor**
2. Öppna `project_databases` tabellen
3. Du bör se en rad med:
   - `user_id`: Användarens ID
   - `project_id`: Projektets ID
   - `database_type`: "postgresql"
   - `provider`: "supabase"
   - `status`: "active"
   - `connection_string`: (krypterad)

## Steg 5: Förstå hur det fungerar

### Automatisk Provisioning Flow

1. **Användare genererar/importerar projekt** som behöver databas
2. **DatabaseSetupService** detekterar databas-behov (MongoDB, PostgreSQL, MySQL)
3. **DatabaseProvisioningService** kontrollerar om API-nycklar finns
4. Om ja → Skapar databas automatiskt via Supabase API
5. Connection string krypteras och sparas i `project_databases` tabellen
6. `.env.example` uppdateras med faktisk connection string
7. Användare får meddelande: "✅ Databas automatiskt skapad!"

### Vad händer tekniskt?

När systemet provisionerar en databas:

1. **Skapar unik schema** per projekt i Supabase
2. **Genererar connection string** med projektets credentials
3. **Krypterar connection string** med `CredentialVault` innan lagring
4. **Sparar i databasen** för framtida användning

### Connection String Format

Connection strings som genereras ser ut så här:

```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true
```

- **Port 6543**: Connection pooling (rekommenderat för production)
- **Port 5432**: Direct connection (används för migrations)

## Steg 6: Troubleshooting

### Problem: "Supabase credentials not configured"

**Lösning**:
- Kontrollera att alla tre environment variables är satta
- Verifiera att `SUPABASE_URL` är korrekt (ska sluta med `.supabase.co`)
- Kontrollera att `SUPABASE_SERVICE_ROLE_KEY` är komplett (börjar med `eyJ...`)

### Problem: "Failed to provision Supabase database"

**Lösning**:
- Kontrollera att Service Role Key är korrekt
- Verifiera att database password är rätt
- Kolla Supabase Dashboard för eventuella fel
- Kontrollera backend logs för mer detaljer

### Problem: "Database already provisioned"

**Lösning**:
- Ett projekt kan bara ha en databas
- Om du vill ändra, radera raden i `project_databases` tabellen
- Eller uppdatera `status` till 'failed' och försök igen

### Problem: Connection string är null när man hämtar den

**Lösning**:
- Kontrollera att `CredentialVault` fungerar korrekt
- Verifiera att encryption key är satt i environment variables
- Kolla att databasen har status 'active' i `project_databases` tabellen

## Steg 7: Production Best Practices

### Säkerhet

1. **ALDRIG committa** `SUPABASE_SERVICE_ROLE_KEY` till git
2. **Använd environment variables** för alla secrets
3. **Rotera keys regelbundet** i Supabase Dashboard
4. **Använd Row Level Security (RLS)** för användardata

### Monitoring

1. **Övervaka Supabase Dashboard** för databas-användning
2. **Kolla logs** för provisioning-fel
3. **Sätt upp alerts** för ovanlig aktivitet
4. **Övervaka connection pool** användning

### Skalning

- **Free tier**: 500 MB databas, 2 GB bandwidth
- **Pro tier**: 8 GB databas, 50 GB bandwidth
- **Överväg Neon** för större projekt (serverless PostgreSQL)

## Ytterligare Resurser

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase API Reference](https://supabase.com/docs/reference)
- [PostgreSQL Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

## Support

Om du stöter på problem:
1. Kolla backend logs för detaljerade felmeddelanden
2. Verifiera att alla environment variables är korrekt satta
3. Testa connection string manuellt i Supabase Dashboard
4. Kontrollera att `project_databases` tabellen finns och är korrekt strukturerad

---

**Klart!** 🎉 Nu är Supabase konfigurerat för automatisk databas-provisioning. När användare genererar eller importerar projekt kommer databaser att skapas automatiskt!


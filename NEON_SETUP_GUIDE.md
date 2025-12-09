# Neon Setup Guide för Database Provisioning

## Översikt

Denna guide visar hur du konfigurerar Neon (serverless PostgreSQL) för automatisk databas-provisioning för användarnas projekt. Neon är ett utmärkt alternativ till Supabase med serverless-arkitektur och automatisk scaling.

## Steg 1: Skapa Neon-projekt

### 1.1 Skapa konto och projekt

1. Gå till [neon.tech](https://neon.tech)
2. Klicka på **"Sign Up"** eller **"Log In"** om du redan har ett konto
3. Logga in med GitHub, Google eller email
4. Efter inloggning, klicka på **"Create a project"**
5. Fyll i:
   - **Name**: T.ex. "AI Library Production" eller "vik-databases"
   - **Region**: Välj närmaste region (t.ex. "Europe (Frankfurt)" för Sverige)
   - **PostgreSQL version**: Välj senaste versionen (t.ex. "16")
   - **Compute size**: Välj "Free" för att börja (eller "0.25 vCPU" för production)
6. Klicka på **"Create project"**
7. Vänta 1-2 minuter medan projektet skapas

### 1.2 Hämta API-nycklar och Connection Info

När projektet är klart:

1. I Neon Dashboard, gå till **Settings** → **API Keys** (vänster meny)
2. Klicka på **"Create API Key"**
3. Ge den ett namn: "AI Library Provisioning"
4. Klicka på **"Create"**
5. **VIKTIGT**: Kopiera API-nyckeln direkt - du kan bara se den en gång!
   - **Spara detta som**: `NEON_API_KEY`

#### Project ID

1. I Neon Dashboard, gå till **Settings** → **General**
2. Hitta **"Project ID"** (ser ut som: `ep-xxxxx-xxxxx`)
3. **Spara detta som**: `NEON_PROJECT_ID`

#### Connection String (för referens)

1. I Neon Dashboard, gå till **Dashboard** (hem)
2. Du ser din connection string under "Connection Details"
3. Format: `postgresql://[user]:[password]@[host]/[database]?sslmode=require`
4. **Notera**: Denna används för att ansluta till databasen, men API:et skapar nya branches automatiskt

## Steg 2: Konfigurera Environment Variables

### 2.1 Lokal Development (.env)

Lägg till dessa i din `.env` fil i projektets root:

```env
# Neon Configuration för Database Provisioning
NEON_API_KEY=neon_api_key_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEON_PROJECT_ID=ep-xxxxx-xxxxx
```

**Viktigt**: 
- Ersätt `neon_api_key_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` med din faktiska API key
- Ersätt `ep-xxxxx-xxxxx` med din faktiska Project ID

### 2.2 Production (Render/Vercel)

#### För Render:

1. Gå till ditt Render Dashboard
2. Välj ditt backend service
3. Gå till **Environment** tab
4. Lägg till dessa environment variables:

```
NEON_API_KEY = neon_api_key_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEON_PROJECT_ID = ep-xxxxx-xxxxx
```

5. Klicka på **"Save Changes"**
6. Render kommer automatiskt deploya om med nya environment variables

#### För Vercel:

1. Gå till ditt Vercel Dashboard
2. Välj ditt projekt
3. Gå till **Settings** → **Environment Variables**
4. Lägg till samma två variabler som ovan
5. Välj environments (Production, Preview, Development)
6. Klicka på **"Save"**

## Steg 3: Kör Database Migration

### 3.1 Skapa project_databases tabellen

Neon använder PostgreSQL, så vi kan använda samma migration som för Supabase:

1. I Neon Dashboard, gå till **SQL Editor** (vänster meny)
2. Klicka på **"New query"**
3. Öppna filen `migrations/2025_add_project_databases_table.sql` i ditt projekt
4. Kopiera hela innehållet (Ctrl+A, Ctrl+C)
5. Klistra in i SQL Editor (Ctrl+V)
6. Klicka på **"Run"** eller tryck Ctrl+Enter
7. Du bör se: "Success. No rows returned"

### 3.2 Verifiera att tabellen skapades

1. I Neon Dashboard, gå till **Tables** (vänster meny)
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
   [DatabaseProvisioningService] INFO: Neon database provisioned
   ```

### 4.2 Verifiera i Neon

1. Gå till Neon Dashboard → **Branches** (vänster meny)
2. Du bör se nya branches skapade för varje provisioned projekt
3. Varje branch har sin egen connection string
4. Gå till **Tables** → `project_databases` för att se sparade konfigurationer

## Steg 5: Förstå hur det fungerar

### Automatisk Provisioning Flow

1. **Användare genererar/importerar projekt** som behöver databas
2. **DatabaseSetupService** detekterar databas-behov (PostgreSQL)
3. **DatabaseProvisioningService** kontrollerar om Neon API-nycklar finns
4. Om ja → Skapar ny branch automatiskt via Neon API
5. Varje branch får sin egen connection string
6. Connection string krypteras och sparas i `project_databases` tabellen
7. `.env.example` uppdateras med faktisk connection string
8. Användare får meddelande: "✅ Databas automatiskt skapad!"

### Vad är en Branch?

Neon använder en unik "branch"-koncept:
- **Main branch**: Din huvuddatabas
- **Project branches**: Varje användarprojekt får sin egen branch
- **Isolation**: Varje branch är helt isolerad från andra
- **Connection strings**: Varje branch har sin egen unika connection string

### Connection String Format

Connection strings som genereras ser ut så här:

```
postgresql://[user]:[password]@[host]/[database]?sslmode=require
```

- **SSL required**: Neon kräver SSL för alla anslutningar
- **Automatic scaling**: Neon skalar automatiskt baserat på användning
- **Serverless**: Ingen server-hantering behövs

## Steg 6: Neon API Integration

### Hur DatabaseProvisioningService använder Neon API

När systemet provisionerar en databas:

1. **API Call**: `POST https://console.neon.tech/api/v2/projects/{project_id}/branches`
2. **Request Body**:
   ```json
   {
     "branch": {
       "name": "project-{projectId}-{timestamp}"
     }
   }
   ```
3. **Response**: Innehåller branch ID och connection URI
4. **Spara**: Connection URI krypteras och sparas i databasen

### API Endpoints som används

- **Create Branch**: `POST /api/v2/projects/{project_id}/branches`
- **List Branches**: `GET /api/v2/projects/{project_id}/branches`
- **Get Branch**: `GET /api/v2/projects/{project_id}/branches/{branch_id}`

## Steg 7: Troubleshooting

### Problem: "Neon API key not configured"

**Lösning**:
- Kontrollera att `NEON_API_KEY` är satt i environment variables
- Verifiera att API-nyckeln är korrekt (börjar med `neon_api_key_`)
- Kontrollera att API-nyckeln inte har expirerat (skapa ny i Neon Dashboard)

### Problem: "Neon Project ID not configured"

**Lösning**:
- Kontrollera att `NEON_PROJECT_ID` är satt
- Verifiera att Project ID är korrekt (format: `ep-xxxxx-xxxxx`)
- Hitta Project ID i Settings → General i Neon Dashboard

### Problem: "Failed to provision Neon database"

**Lösning**:
- Kontrollera att API-nyckeln har rätt permissions
- Verifiera att Project ID är korrekt
- Kolla Neon Dashboard för eventuella fel eller rate limits
- Kontrollera backend logs för detaljerade felmeddelanden

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
- Verifiera att branch fortfarande finns i Neon Dashboard

## Steg 8: Production Best Practices

### Säkerhet

1. **ALDRIG committa** `NEON_API_KEY` till git
2. **Använd environment variables** för alla secrets
3. **Rotera API keys regelbundet** i Neon Dashboard
4. **Använd connection pooling** för bättre prestanda
5. **Aktivera SSL** för alla anslutningar (krävs av Neon)

### Monitoring

1. **Övervaka Neon Dashboard** för:
   - Branch-användning
   - Connection counts
   - Query performance
   - Storage usage
2. **Kolla logs** för provisioning-fel
3. **Sätt upp alerts** i Neon Dashboard för:
   - High connection counts
   - Storage limits
   - Query timeouts

### Skalning

- **Free tier**: 
  - 0.5 GB storage
  - 1 project
  - Unlimited branches
  - Perfect för development/testing
- **Launch tier**: 
  - 10 GB storage
  - Unlimited projects
  - Better performance
  - Recommended för production
- **Scale tier**: 
  - 50+ GB storage
  - Auto-scaling
  - High performance
  - För stora applikationer

### Branch Management

- **Automatic cleanup**: Överväg att radera oanvända branches
- **Branch naming**: Systemet använder formatet `project-{id}-{timestamp}`
- **Isolation**: Varje branch är helt isolerad - perfekt för multi-tenant

## Steg 9: Neon vs Supabase

### När ska du välja Neon?

✅ **Välj Neon om:**
- Du vill ha serverless PostgreSQL
- Du behöver automatisk scaling
- Du vill ha branch-baserad isolation
- Du behöver bättre prestanda för stora applikationer
- Du vill ha mer kontroll över databasen

### När ska du välja Supabase?

✅ **Välj Supabase om:**
- Du behöver auth, storage, och realtime features
- Du vill ha en allt-i-ett lösning
- Du behöver Row Level Security (RLS) policies
- Du vill ha en enklare setup

### Hybrid Approach

Du kan faktiskt använda båda:
- **Supabase**: För plattformens huvuddatabas (users, projects, etc.)
- **Neon**: För användarnas projekt-databaser (automatisk provisioning)

## Steg 10: Ytterligare Resurser

- [Neon Documentation](https://neon.tech/docs)
- [Neon API Reference](https://neon.tech/docs/api)
- [Neon Branching Guide](https://neon.tech/docs/guides/branching)
- [Connection Pooling](https://neon.tech/docs/guides/connection-pooling)
- [Neon Pricing](https://neon.tech/pricing)

## Support

Om du stöter på problem:
1. Kolla backend logs för detaljerade felmeddelanden
2. Verifiera att alla environment variables är korrekt satta
3. Testa API-nyckeln manuellt via Neon Dashboard
4. Kontrollera att `project_databases` tabellen finns och är korrekt strukturerad
5. Kolla Neon Dashboard → Branches för att se om branches skapas
6. Kontakta Neon support via [Discord](https://discord.gg/neondatabase) eller [email](support@neon.tech)

---

**Klart!** 🎉 Nu är Neon konfigurerat för automatisk databas-provisioning. När användare genererar eller importerar projekt kommer databaser att skapas automatiskt som isolerade branches i Neon!

## Snabbstart Checklista

- [ ] Skapa konto på [neon.tech](https://neon.tech)
- [ ] Skapa nytt projekt
- [ ] Skapa API key i Settings → API Keys
- [ ] Kopiera Project ID från Settings → General
- [ ] Lägg till `NEON_API_KEY` och `NEON_PROJECT_ID` i `.env`
- [ ] Lägg till samma variabler i production environment (Render/Vercel)
- [ ] Kör migration i Neon SQL Editor
- [ ] Testa genom att importera/generera ett projekt
- [ ] Verifiera att branch skapades i Neon Dashboard


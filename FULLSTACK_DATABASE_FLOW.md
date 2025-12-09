# Fullstack App med Databas - Hela Flödet

## Översikt

När du ber Elon generera en fullstack-app med databas, kommer systemet automatiskt:
1. ✅ Detektera databas-behov
2. ✅ Provisionera en Neon-databas (om konfigurerad)
3. ✅ Skapa en isolerad branch i Neon för projektet
4. ✅ Generera `.env.example` med `PROJECT_DATABASE_URL` (inte `DATABASE_URL`)
5. ✅ **INGEN konflikt** med plattformens `DATABASE_URL`

## Hela Flödet Steg-för-Steg

### Steg 1: Du ber Elon generera app

**Exempel:**
```
"Generera en fullstack e-commerce app med React frontend, Express backend och PostgreSQL databas"
```

### Steg 2: Systemet detekterar databas-behov

- `AnalysisAgent` analyserar din prompt
- Detekterar nyckelord: "database", "postgresql", "backend", "fullstack"
- Skapar en `GenerationPlan` med `backend-base` och `backend-routes` faser

### Steg 3: Kod genereras

- `IncrementalOrchestrator` genererar kod i faser:
  - Frontend (React/Vite)
  - Backend (Express server)
  - Database models/migrations
  - API routes

### Steg 4: Databas provisioneras automatiskt

När backend-generering är klar:

1. **DatabaseSetupService** analyserar genererade filer
   - Hittar `package.json` med `pg` eller `drizzle-orm`
   - Detekterar: "Detta projekt behöver PostgreSQL"

2. **DatabaseProvisioningService** provisionerar databas
   - Kontrollerar: `NEON_API_KEY` och `NEON_PROJECT_ID` finns?
   - Om ja → Skapar ny branch i Neon via API
   - Får tillbaka connection string för den nya branchen
   - Sparar connection string krypterat i `project_databases` tabellen

3. **Connection String genereras**
   ```
   postgresql://neondb_owner:password@ep-shiny-frost-aggk3jci-pooler.c-2.eu-central-1.aws.neon.tech/project-78-1234567890?sslmode=require
   ```
   - Varje projekt får sin egen unika branch
   - Isolerad från andra projekt
   - Isolerad från plattformens huvuddatabas

### Steg 5: `.env.example` genereras

Systemet skapar `.env.example` med:

```env
# Environment variables for My E-commerce App
# Copy this file to .env and fill in your actual values

# Database Configuration (postgresql)
# Use PROJECT_DATABASE_URL to avoid conflict with platform DATABASE_URL
PROJECT_DATABASE_URL=postgresql://neondb_owner:password@ep-shiny-frost-aggk3jci-pooler.c-2.eu-central-1.aws.neon.tech/project-78-1234567890?sslmode=require

# Note: Some frameworks expect DATABASE_URL. If needed, you can alias it:
# DATABASE_URL=${PROJECT_DATABASE_URL}

# Application
NODE_ENV=development
PORT=3000
```

### Steg 6: Fullstack Integration

- `FullstackIntegrationService` verifierar att:
  - Frontend API client använder rätt backend URL
  - Backend CORS är konfigurerad
  - Environment variables är korrekt satta

## Vad är PROJECT_DATABASE_URL?

`PROJECT_DATABASE_URL` är connection string för **användarens projekt-databas** (inte plattformens databas).

### Struktur:

```
PROJECT_DATABASE_URL=postgresql://[user]:[password]@[host]/[database]?sslmode=require
```

### Exempel (Neon):

```
PROJECT_DATABASE_URL=postgresql://neondb_owner:npg_jh5y6IMaJPGl@ep-shiny-frost-aggk3jci-pooler.c-2.eu-central-1.aws.neon.tech/project-78-1234567890?sslmode=require
```

### Vad den innehåller:

- **User**: Database user (t.ex. `neondb_owner`)
- **Password**: Database password
- **Host**: Neon branch endpoint (t.ex. `ep-shiny-frost-aggk3jci-pooler.c-2.eu-central-1.aws.neon.tech`)
- **Database**: Branch/database name (t.ex. `project-78-1234567890`)
- **Parameters**: `sslmode=require` (SSL krävs för Neon)

## Varför PROJECT_DATABASE_URL och inte DATABASE_URL?

### Plattformens DATABASE_URL:
```env
# I Render backend environment
DATABASE_URL=postgresql://neondb_owner:password@ep-shiny-frost-aggk3jci-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
```
- Används av **plattformen själv**
- För plattformens huvuddatabas (users, projects, agents, etc.)
- **MÅSTE** heta `DATABASE_URL` för att plattformen ska fungera

### Användarens PROJECT_DATABASE_URL:
```env
# I användarens projekt .env.example
PROJECT_DATABASE_URL=postgresql://neondb_owner:password@ep-shiny-frost-aggk3jci-pooler.c-2.eu-central-1.aws.neon.tech/project-78-1234567890?sslmode=require
```
- Används av **användarens genererade app**
- För användarens projekt-databas (deras egen data)
- **MÅSTE** heta `PROJECT_DATABASE_URL` för att undvika konflikt

## Isolation och Säkerhet

### Varje projekt får sin egen databas:

1. **Neon Branch**: Varje projekt får en unik branch
   - `project-78-1234567890` (för projekt ID 78)
   - `project-79-1234567891` (för projekt ID 79)
   - Helt isolerade från varandra

2. **Plattformens databas**: Separerad
   - `neondb` (plattformens huvuddatabas)
   - Innehåller: users, projects, agents, etc.
   - Används bara av plattformen

3. **Ingen konflikt**: 
   - Olika variabelnamn (`DATABASE_URL` vs `PROJECT_DATABASE_URL`)
   - Olika databaser (olika branches)
   - Olika connection strings

## Användning i Genererad Kod

### Backend (Express):

```javascript
// server/config/database.js
const { Pool } = require('pg');

// Använd PROJECT_DATABASE_URL för projektets databas
const pool = new Pool({
  connectionString: process.env.PROJECT_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;
```

### Om ramverket kräver DATABASE_URL:

```env
# I projektets .env
PROJECT_DATABASE_URL=postgresql://...
DATABASE_URL=${PROJECT_DATABASE_URL}  # Alias för ramverket
```

## Exempel: Hela Flödet

### 1. Du säger till Elon:
```
"Generera en todo-app med React, Express och PostgreSQL"
```

### 2. Systemet genererar:
- ✅ `client/` - React frontend
- ✅ `server/` - Express backend
- ✅ `server/models/Todo.js` - Database model
- ✅ `server/routes/todos.js` - API routes
- ✅ `server/.env.example` - Med `PROJECT_DATABASE_URL`

### 3. Systemet provisionerar:
- ✅ Skapar Neon branch: `project-80-1234567892`
- ✅ Sparar connection string i `project_databases` tabellen
- ✅ Uppdaterar `server/.env.example` med faktisk connection string

### 4. Du får:
- ✅ En färdig fullstack-app
- ✅ En provisioned databas på Neon
- ✅ `.env.example` med `PROJECT_DATABASE_URL`
- ✅ **INGEN konflikt** med plattformens databas

## Sammanfattning

✅ **Ja, du får en färdig app med Neon-databas utan konflikt!**

- Plattformens databas: `DATABASE_URL` → `neondb` (plattformens data)
- Ditt projekts databas: `PROJECT_DATABASE_URL` → `project-XX-XXXXX` (ditt projekts data)
- Helt isolerade och separerade
- Automatiskt provisionerad när du genererar/importerar projekt

**PROJECT_DATABASE_URL** = Connection string för din genererade apps databas (inte plattformens databas)


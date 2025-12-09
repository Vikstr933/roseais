# Database Provisioning Guide

## Översikt

Plattformen kan nu automatiskt provisionera databaser för användarnas projekt när de genererar fullstack-applikationer eller importerar projekt från GitHub som kräver databaser.

## Hur det fungerar

### 1. Automatisk Detektering

När ett projekt genereras eller importeras:
- `DatabaseSetupService` analyserar projektfiler (`package.json`, `requirements.txt`, etc.)
- Detekterar om projektet behöver MongoDB, PostgreSQL eller MySQL
- Skapar `.env.example` med databas-konfiguration

### 2. Automatisk Provisioning

Om databas behövs och API-nycklar är konfigurerade:
- `DatabaseProvisioningService` skapar automatiskt en databas
- Stöder flera providers:
  - **Supabase** (PostgreSQL) - Rekommenderat
  - **Neon** (PostgreSQL) - Serverless alternativ
  - **MongoDB Atlas** (MongoDB) - För MERN-stack projekt

### 3. Säker Lagring

- Connection strings krypteras innan de sparas i databasen
- En databas per projekt (unik constraint)
- Status tracking: `active`, `pending`, `failed`

## Konfiguration

### Environment Variables

För att aktivera automatisk provisioning, lägg till dessa i `.env`:

```env
# Supabase (PostgreSQL)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DB_PASSWORD=your-database-password

# Neon (PostgreSQL)
NEON_API_KEY=your-neon-api-key
NEON_PROJECT_ID=your-neon-project-id

# MongoDB Atlas
MONGODB_ATLAS_API_KEY=your-atlas-api-key
MONGODB_ATLAS_PROJECT_ID=your-atlas-project-id
```

### Database Migration

Kör migration för att skapa `project_databases` tabellen:

```bash
# I Supabase SQL Editor, kör:
migrations/2025_add_project_databases_table.sql
```

## Användning

### För Importerade Projekt (GitHub)

När användare importerar ett projekt från GitHub:
1. Systemet detekterar databas-behov automatiskt (MongoDB, PostgreSQL, MySQL)
2. Om API-nycklar finns → databas provisioneras automatiskt
3. Connection string sparas krypterat
4. `.env.example` uppdateras med faktisk connection string
5. Användare får instruktioner om manuell setup om API-nycklar saknas

**Exempel: MERN Stack App**
- Systemet detekterar `mongoose` i `package.json`
- Om `MONGODB_ATLAS_API_KEY` finns → försöker skapa MongoDB Atlas databas
- Om inte → ger instruktioner för manuell MongoDB Atlas setup

### För Genererade Projekt

När användare genererar en fullstack-app:
1. Systemet detekterar databas-behov automatiskt
2. Om API-nycklar finns → databas provisioneras automatiskt
3. Connection string sparas krypterat
4. `.env.example` uppdateras med faktisk connection string
5. Användare får meddelande: "✅ Databas automatiskt skapad!"

### För Importerade Projekt

När användare importerar från GitHub:
1. `GitHubPlugin` anropar `DatabaseSetupService`
2. Om databas behövs → `DatabaseProvisioningService` provisionerar
3. Connection string sparas och `.env.example` skapas
4. Användare informeras om databas-status

### Fallback till Manuell Setup

Om API-nycklar saknas:
- Systemet ger instruktioner för manuell setup
- `.env.example` skapas med placeholder-värden
- Användare måste själv skapa databas och uppdatera connection string

## API

### Provision Database

```typescript
import { databaseProvisioningService } from './services/DatabaseProvisioningService';

const result = await databaseProvisioningService.provisionDatabase(
  userId,
  projectId,
  'postgresql', // eller 'mongodb', 'mysql'
  'My Project Name'
);

if (result.success) {
  console.log('Database provisioned:', result.databaseId);
  console.log('Connection string:', result.connectionString);
}
```

### Get Database Connection

```typescript
const connectionString = await databaseProvisioningService.getDatabaseConnection(
  userId,
  projectId
);
```

## Databas Schema

```sql
CREATE TABLE project_databases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  database_type TEXT NOT NULL, -- 'mongodb', 'postgresql', 'mysql'
  provider TEXT NOT NULL, -- 'supabase', 'neon', 'mongodb-atlas', 'manual'
  connection_string TEXT NOT NULL, -- Encrypted
  database_url TEXT, -- Provider dashboard URL
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT project_databases_project_id_unique UNIQUE (project_id)
);
```

## Säkerhet

- ✅ Connection strings krypteras med `CredentialVault`
- ✅ En databas per projekt (unik constraint)
- ✅ CASCADE delete när projekt raderas
- ✅ Status tracking för felhantering

## Nästa Steg

1. **Konfigurera API-nycklar** i production environment
2. **Kör migration** för att skapa `project_databases` tabellen
3. **Testa provisioning** genom att generera/importera ett projekt som behöver databas
4. **Verifiera** att connection strings sparas korrekt och är krypterade

## Supportade Providers

### Supabase (PostgreSQL)
- ✅ Gratis tier tillgänglig
- ✅ Enkel API-integration
- ✅ Rekommenderat för de flesta projekt

### Neon (PostgreSQL)
- ✅ Serverless PostgreSQL
- ✅ Automatisk scaling
- ✅ Bra för production

### MongoDB Atlas (MongoDB)
- ✅ Gratis tier tillgänglig
- ✅ För MERN-stack projekt
- ✅ Automatisk provisioning via API

## Troubleshooting

### "Automatic database provisioning not available"
- Kontrollera att API-nycklar är satta i environment variables
- Verifiera att provider-API:et är tillgängligt

### "Database already provisioned"
- Ett projekt kan bara ha en databas
- Kontrollera `project_databases` tabellen för befintlig konfiguration

### Connection string är null
- Kontrollera att provisioning lyckades (`status = 'active'`)
- Verifiera att `CredentialVault` fungerar korrekt


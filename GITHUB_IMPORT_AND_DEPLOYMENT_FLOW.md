# GitHub Import och Deployment Flow

## ✅ Vad som fungerar nu

### 1. GitHub Import via Elon/Chap-ZPT

När du importerar en GitHub repo:

1. **Filer importeras** ✅
   - Alla filer från repot kopieras till projektet
   - Binära filer (bilder) hanteras korrekt som Base64 data URIs
   - Monorepo-strukturer (client/ och server/) detekteras automatiskt

2. **Språk och Framework detekteras** ✅
   - Systemet analyserar `package.json` och kod
   - Detekterar JavaScript/TypeScript, React, Vue, etc.
   - Rekommenderar lämpliga agents

3. **Database Requirements detekteras** ✅
   - Systemet analyserar dependencies (mongoose, mongodb, pg, etc.)
   - Detekterar om projektet behöver MongoDB, PostgreSQL eller MySQL
   - Skapar `.env.example` automatiskt med rätt format

4. **Automatisk Database Provisioning (om API-nycklar finns)** ✅
   - Om `MONGODB_ATLAS_API_KEY` + `MONGODB_ATLAS_PROJECT_ID` finns → skapar MongoDB Atlas databas
   - Om `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_URL` + `SUPABASE_DB_PASSWORD` finns → skapar Supabase databas
   - Om `NEON_API_KEY` + `NEON_PROJECT_ID` finns → skapar Neon databas
   - Connection string sparas **krypterat** i `project_databases` tabellen
   - Connection string läggs automatiskt i `.env.example`

5. **API Key Instructions (om API-nycklar saknas)** ✅
   - Systemet informerar användaren om att API-nycklar saknas
   - Ger direkta länkar till MongoDB Atlas, Supabase, Neon
   - Ger instruktioner för manuell setup

6. **Dev Server i WebContainer** ✅
   - Monorepo-strukturer hanteras korrekt
   - `npm install` körs i både `client/` och `server/` om de finns
   - Dev server startar korrekt

## ⚠️ Vad som saknas/behöver förbättras

### 1. Connection Strings vid Deployment

**Nuvarande status:**
- Connection strings sparas i `project_databases` tabellen (krypterat) ✅
- Connection strings läggs i `.env.example` ✅
- **MEN:** Connection strings läggs INTE automatiskt som environment variables vid Vercel deployment ❌

**Vad behöver fixas:**
- `ProductionDeploymentService.deployToVercel()` behöver hämta connection string från `project_databases`
- Lägga till connection string som environment variable i Vercel deployment
- Använda rätt variabelnamn (`MONGODB_URI` för MongoDB, `PROJECT_DATABASE_URL` för PostgreSQL)

### 2. Användarens API Keys

**Nuvarande status:**
- Systemet använder **plattformens** API keys (MONGODB_ATLAS_API_KEY, etc.) för att skapa databaser ✅
- Connection strings sparas per användare och projekt ✅
- **MEN:** Användaren kan inte ange sina egna API keys för att skapa databaser ❌

**Vad behöver fixas (framtida förbättring):**
- UI för användare att ange sina egna MongoDB Atlas/Supabase/Neon API keys
- Spara användarens API keys krypterat
- Använd användarens API keys istället för plattformens när de finns

## 📋 Detaljerat Flow

### Scenario 1: Import med API-nycklar konfigurerade

```
1. Användare: "@Elon importera https://github.com/user/mern-app.git"
2. Systemet:
   - Importerar alla filer ✅
   - Detekterar MongoDB-behov ✅
   - Försöker automatiskt skapa MongoDB Atlas databas ✅
   - Sparar connection string krypterat i project_databases ✅
   - Uppdaterar .env.example med faktisk connection string ✅
   - Informerar användaren: "✅ Databas automatiskt skapad!"
3. Användare kan:
   - Starta dev server i WebContainer ✅
   - Se projektet köra med databas ✅
   - Deploya till Vercel (men connection string läggs INTE automatiskt till) ⚠️
```

### Scenario 2: Import utan API-nycklar

```
1. Användare: "@Elon importera https://github.com/user/mern-app.git"
2. Systemet:
   - Importerar alla filer ✅
   - Detekterar MongoDB-behov ✅
   - Detekterar att API-nycklar saknas ✅
   - Skapar .env.example med placeholder ✅
   - Informerar användaren med länkar till MongoDB Atlas ✅
3. Användare kan:
   - Starta dev server i WebContainer (men databas fungerar inte) ⚠️
   - Skapa MongoDB Atlas cluster manuellt ✅
   - Uppdatera .env.example med sin connection string ✅
   - Deploya till Vercel (men måste lägga till connection string manuellt i Vercel) ⚠️
```

### Scenario 3: Deployment till Vercel

**Nuvarande flow:**
```
1. Användare: "deploy to vercel"
2. Systemet:
   - Validerar filer ✅
   - Skapar GitHub repo ✅
   - Deployar till Vercel ✅
   - **MEN:** Lägger INTE till database connection string som env var ❌
3. Användare måste:
   - Gå till Vercel dashboard manuellt
   - Lägga till MONGODB_URI eller PROJECT_DATABASE_URL manuellt
```

**Önskat flow:**
```
1. Användare: "deploy to vercel"
2. Systemet:
   - Validerar filer ✅
   - Skapar GitHub repo ✅
   - Hämtar connection string från project_databases ✅
   - Dekrypterar connection string ✅
   - Lägger till som environment variable i Vercel deployment ✅
   - Deployar till Vercel ✅
3. Användare:
   - Får fungerande deployment med databas automatiskt! ✅
```

## 🔧 Nästa Steg för Fullständig Implementation

### 1. Fixa Deployment med Connection Strings

**Fil att uppdatera:** `server/services/ProductionDeploymentService.ts`

**Ändringar behövs:**
```typescript
// I deployToVercel() metoden:
// 1. Hämta connection string från project_databases
const { databaseProvisioningService } = await import('./DatabaseProvisioningService');
const connectionString = await databaseProvisioningService.getDatabaseConnection(userId, projectId);

// 2. Lägg till som environment variable
if (connectionString) {
  // Detektera databas-typ från project_databases
  const dbConfig = await db.select()
    .from(projectDatabases)
    .where(eq(projectDatabases.projectId, projectId))
    .limit(1);
  
  if (dbConfig[0]) {
    const dbType = dbConfig[0].databaseType;
    if (dbType === 'mongodb') {
      environmentVariables.push({
        key: 'MONGODB_URI',
        value: connectionString,
        target: ['production', 'preview', 'development']
      });
    } else if (dbType === 'postgresql') {
      environmentVariables.push({
        key: 'PROJECT_DATABASE_URL',
        value: connectionString,
        target: ['production', 'preview', 'development']
      });
      // Om framework kräver DATABASE_URL, lägg till alias
      environmentVariables.push({
        key: 'DATABASE_URL',
        value: connectionString,
        target: ['production', 'preview', 'development']
      });
    }
  }
}
```

### 2. Förbättra API Key Management (Framtida)

- UI för användare att ange sina egna API keys
- Spara användarens API keys krypterat i `user_credentials` tabellen
- Använd användarens API keys när de finns, annars fallback till plattformens

## 📝 Sammanfattning

### ✅ Fungerar nu:
- GitHub import
- Database detection
- Automatisk database provisioning (om API-nycklar finns)
- Connection strings sparas krypterat
- Dev server i WebContainer
- Monorepo-stöd

### ⚠️ Behöver fixas:
- Connection strings läggs INTE automatiskt till vid Vercel deployment
- Användare måste lägga till connection string manuellt i Vercel dashboard

### 🎯 Önskat beteende:
- Connection strings hämtas automatiskt från `project_databases` vid deployment
- Läggs till som environment variables i Vercel automatiskt
- Användare behöver inte göra något manuellt


# MongoDB Atlas API Key Permissions Guide

## Översikt

För att plattformen ska kunna automatiskt provisionera MongoDB Atlas databaser för användarnas projekt, behöver API-nyckeln ha specifika permissions.

## Rekommenderad Roll: Project Owner

### Varför Project Owner?

**Project Owner** ger fullständig kontroll över projektet och möjliggör:

✅ **Skapa och hantera clusters**
- Skapa nya MongoDB clusters
- Konfigurera cluster-inställningar
- Starta/stoppa clusters

✅ **Skapa Database Users**
- Skapa nya database users automatiskt
- Sätta lösenord för users
- Tilldela roller till users

✅ **Hantera Network Access**
- Lägga till IP-adresser i whitelist
- Konfigurera network access rules

✅ **Läsa Connection Strings**
- Hämta connection strings för clusters
- Generera connection strings med users

✅ **Hantera Databaser**
- Skapa databaser i clusters
- Hantera database collections

## Roller och Permissions

### 1. Project Owner (Rekommenderat) ⭐

**När ska du använda:**
- För automatisk provisioning av databaser
- När systemet behöver skapa users och clusters automatiskt
- För fullständig kontroll över projektet

**Permissions:**
- ✅ Fullständig kontroll över projektet
- ✅ Skapa/hantera clusters
- ✅ Skapa/hantera database users
- ✅ Hantera network access
- ✅ Läsa connection strings
- ✅ Hantera databaser

**Säkerhet:**
- Begränsad till ett specifikt projekt
- Kan inte påverka andra projekt
- Kan inte ändra organisation settings

### 2. Organization Project Creator

**När ska du använda:**
- Om du vill att systemet ska kunna skapa nya projekt automatiskt
- För multi-project provisioning

**Permissions:**
- ✅ Skapa nya projekt
- ✅ Hantera projekt inom organisationen
- ⚠️ Kan påverka flera projekt

**Säkerhet:**
- Mer omfattande permissions
- Använd endast om absolut nödvändigt

### 3. Project Read Only

**När ska du använda:**
- ❌ **INTE TILLRÄCKLIGT** för automatisk provisioning
- Endast för att läsa projektinformation

**Permissions:**
- ✅ Läsa projektinformation
- ❌ Kan inte skapa clusters
- ❌ Kan inte skapa users
- ❌ Kan inte provisionera databaser

## Steg-för-Steg: Skapa API Key med Rätt Permissions

### Steg 1: Gå till API Keys

1. Logga in på [MongoDB Atlas](https://cloud.mongodb.com)
2. Välj ditt projekt
3. Gå till **Project Settings** (⚙️ ikonen)
4. Klicka på **Access Manager** i vänstermenyn
5. Klicka på **API Keys** tab

### Steg 2: Skapa API Key

1. Klicka **Create API Key**
2. Fyll i formuläret:
   - **Description:** "AI Library Platform - Database Provisioning"
   - **Project Access:** Välj ditt projekt
   - **Project Permissions:** Välj **Project Owner**
3. Klicka **Next**

### Steg 3: Spara Credentials

1. **VIKTIGT:** Spara både **Public Key** och **Private Key**
2. Private Key visas bara en gång!
3. Kopiera båda till en säker plats

### Steg 4: Konfigurera i Backend

Lägg till i din `.env` eller Render environment variables:

```env
MONGODB_ATLAS_API_KEY=your-public-key-here
MONGODB_ATLAS_PROJECT_ID=your-project-id-here
```

## Säkerhetsbest Practices

### 1. Principle of Least Privilege

✅ **Gör:**
- Använd **Project Owner** för ett specifikt projekt
- Begränsa till det projekt som behövs
- Rotera API keys regelbundet

❌ **Gör inte:**
- Använd Organization-level permissions om inte nödvändigt
- Dela API keys publikt
- Använd samma API key för flera olika ändamål

### 2. API Key Management

✅ **Gör:**
- Ge API keys beskrivande namn
- Dokumentera var varje API key används
- Rotera keys var 3-6 månader
- Ta bort oanvända keys

❌ **Gör inte:**
- Commita API keys till Git
- Dela keys via email/chat
- Använd samma key för development och production

### 3. Monitoring

✅ **Gör:**
- Övervaka API key usage i Atlas dashboard
- Sätt upp alerts för ovanlig aktivitet
- Granska logs regelbundet

## Vad Händer Om Permissions Saknas?

### Scenario 1: Project Read Only

**Resultat:**
- ❌ Systemet kan inte skapa clusters
- ❌ Systemet kan inte skapa database users
- ❌ Automatisk provisioning misslyckas
- ✅ Användare får instruktioner för manuell setup

**Felmeddelande:**
```
MongoDB Atlas API error: Insufficient permissions to create database user
```

### Scenario 2: Project Owner (Korrekt)

**Resultat:**
- ✅ Systemet kan skapa clusters
- ✅ Systemet kan skapa database users
- ✅ Automatisk provisioning fungerar
- ✅ Connection strings genereras automatiskt

## API Operations som Krävs

För automatisk provisioning behöver systemet kunna:

1. **GET /api/atlas/v1.0/groups/{GROUP_ID}/clusters**
   - Lista befintliga clusters
   - Kräver: Project Owner

2. **POST /api/atlas/v1.0/groups/{GROUP_ID}/clusters**
   - Skapa nya clusters
   - Kräver: Project Owner

3. **POST /api/atlas/v1.0/groups/{GROUP_ID}/databaseUsers**
   - Skapa database users
   - Kräver: Project Owner

4. **GET /api/atlas/v1.0/groups/{GROUP_ID}/clusters/{CLUSTER_NAME}**
   - Hämta cluster information
   - Kräver: Project Owner eller Read Only

5. **GET /api/atlas/v1.0/groups/{GROUP_ID}/clusters/{CLUSTER_NAME}/connectionStrings**
   - Hämta connection strings
   - Kräver: Project Owner eller Read Only

## Checklista

### Innan Du Skapar API Key

- [ ] Har du ett MongoDB Atlas projekt?
- [ ] Vet du vilket projekt API-nyckeln ska ha access till?
- [ ] Har du förstått skillnaden mellan Project Owner och Organization Project Creator?

### När Du Skapar API Key

- [ ] Väljer **Project Owner** som roll
- [ ] Väljer rätt projekt
- [ ] Ger API-nyckeln ett beskrivande namn
- [ ] Sparar både Public Key och Private Key
- [ ] Lagrar keys på en säker plats

### Efter Du Skapat API Key

- [ ] Lagt till `MONGODB_ATLAS_API_KEY` i backend environment variables
- [ ] Lagt till `MONGODB_ATLAS_PROJECT_ID` i backend environment variables
- [ ] Testat att provisioning fungerar
- [ ] Dokumenterat var API-nyckeln används

## Felsökning

### Problem: "Insufficient permissions"

**Lösning:**
1. Kontrollera att API-nyckeln har **Project Owner** roll
2. Verifiera att API-nyckeln är kopplad till rätt projekt
3. Kontrollera att `MONGODB_ATLAS_PROJECT_ID` matchar projektet

### Problem: "API key not found"

**Lösning:**
1. Verifiera att `MONGODB_ATLAS_API_KEY` är korrekt (Public Key)
2. Kontrollera att API-nyckeln inte har raderats
3. Verifiera att API-nyckeln är aktiv i Atlas dashboard

### Problem: "Project not found"

**Lösning:**
1. Verifiera att `MONGODB_ATLAS_PROJECT_ID` är korrekt
2. Kontrollera att API-nyckeln har access till projektet
3. Verifiera projekt-ID i Atlas dashboard (Project Settings → General)

## Ytterligare Resurser

- **MongoDB Atlas API Documentation:** https://www.mongodb.com/docs/atlas/reference/api-resources-spec/v2/
- **API Authentication:** https://www.mongodb.com/docs/atlas/api/api-authentication/
- **Configure API Access:** https://www.mongodb.com/docs/atlas/configure-api-access/
- **Project Owner Role:** https://www.mongodb.com/docs/atlas/reference/user-roles/#project-owner


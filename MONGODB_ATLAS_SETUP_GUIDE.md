# MongoDB Atlas Setup Guide

## Översikt

MongoDB Atlas är en molnbaserad MongoDB-tjänst som är perfekt för MERN-stack projekt. Plattformen kan automatiskt detektera MongoDB-behov i importerade projekt och försöka provisionera en databas om API-nycklar är konfigurerade.

## Hur det fungerar

### 1. Automatisk Detektering

När ett projekt importeras från GitHub:
- Systemet analyserar `package.json` för `mongoose` eller `mongodb` dependencies
- Letar efter MongoDB connection strings (`mongodb://` eller `mongodb+srv://`)
- Detekterar `mongoose.connect()` eller `MongoClient` i kod
- Om MongoDB detekteras → skapar `.env.example` med `MONGODB_URI`

### 2. Automatisk Provisioning (Om konfigurerat)

Om `MONGODB_ATLAS_API_KEY` och `MONGODB_ATLAS_PROJECT_ID` är satta:
- Systemet försöker automatiskt skapa en MongoDB Atlas databas
- Genererar connection string och sparar den krypterat
- Uppdaterar `.env.example` med faktisk connection string

### 3. Manuell Setup (Om API-nycklar saknas)

Om API-nycklar inte är konfigurerade:
- Systemet ger instruktioner för manuell setup
- Användare får guide för att skapa MongoDB Atlas cluster
- Connection string måste läggas in manuellt i `.env`

## Konfiguration

### Steg 1: Skapa MongoDB Atlas Account

1. Gå till [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Skapa ett konto (gratis tier finns)
3. Skapa ett nytt projekt

### Steg 2: Skapa API Key

1. Gå till **Project Settings** → **Access Manager** → **API Keys**
2. Klicka **Create API Key**
3. Ge den ett namn (t.ex. "AI Library Platform")
4. **Välj Roll:**
   - **Project Owner** (Rekommenderat) - Ger fullständig kontroll över projektet
   - **Project Read Only** - Endast läsning (inte tillräckligt för provisioning)
   - **Organization Project Creator** - Om du vill skapa projekt automatiskt
5. Spara **Public Key** och **Private Key** (du ser private key bara en gång!)

**Viktigt om Permissions:**
- **Project Owner** ger behörighet att:
  - Skapa och hantera clusters
  - Skapa database users
  - Hantera IP whitelist
  - Läsa connection strings
  - Alla operationer som krävs för automatisk provisioning
- **Minimum krävs:** Project Owner för att kunna provisionera databaser automatiskt

### Steg 3: Hämta Project ID

1. Gå till **Project Settings** → **General**
2. Kopiera **Project ID** (ser ut som: `507f1f77bcf86cd799439011`)

### Steg 4: Konfigurera Environment Variables

Lägg till dessa i din `.env` fil:

```env
# MongoDB Atlas Configuration
MONGODB_ATLAS_API_KEY=your-public-api-key-here
MONGODB_ATLAS_PROJECT_ID=your-project-id-here
```

**Viktigt:**
- `MONGODB_ATLAS_API_KEY` = Public Key från steg 2
- `MONGODB_ATLAS_PROJECT_ID` = Project ID från steg 3

### Steg 5: Skapa en Database User (för automatisk provisioning)

För att automatisk provisioning ska fungera, behöver systemet kunna skapa database users:

1. Gå till **Database Access** → **Database Users**
2. Klicka **Add New Database User**
3. Välj **Password** authentication
4. Ange användarnamn och lösenord
5. Välj **Atlas Admin** som roll
6. Spara användarnamn och lösenord (behövs för connection strings)

**Alternativ:** Om du vill använda API för att skapa users automatiskt, se [MongoDB Atlas Admin API](https://www.mongodb.com/docs/atlas/reference/api-resources-spec/v2/)

## Användning

### För Importerade MERN-projekt

1. **Import från GitHub:**
   ```
   @Elon importera https://github.com/user/mern-app.git
   ```

2. **Systemet detekterar automatiskt:**
   - MongoDB dependencies i `package.json`
   - MongoDB connection strings i kod
   - Skapar `.env.example` med `MONGODB_URI`

3. **Om API-nycklar finns:**
   - Systemet försöker automatiskt skapa MongoDB Atlas databas
   - Connection string sparas krypterat
   - `.env.example` uppdateras med faktisk connection string

4. **Om API-nycklar saknas:**
   - Systemet ger instruktioner för manuell setup
   - Användare måste skapa cluster manuellt i MongoDB Atlas
   - Connection string läggs in manuellt i `.env`

### För Genererade Fullstack-appar

När användare genererar en fullstack-app med MongoDB:
1. Systemet detekterar att MongoDB behövs
2. Om API-nycklar finns → automatisk provisioning
3. Om inte → instruktioner för manuell setup

## Connection String Format

### Automatisk Provisioning
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/database-name?retryWrites=true&w=majority
```

### Manuell Setup
1. Gå till **Database** → **Connect**
2. Välj **Connect your application**
3. Kopiera connection string
4. Ersätt `<password>` med ditt lösenord
5. Ersätt `<dbname>` med ditt databasnamn

## Säkerhet

- **Connection strings krypteras** innan de sparas i databasen
- **En databas per projekt** (unik constraint)
- **Status tracking**: `active`, `pending`, `failed`
- **API keys** lagras säkert i environment variables

## Troubleshooting

### "MongoDB Atlas credentials not configured"
- Kontrollera att `MONGODB_ATLAS_API_KEY` och `MONGODB_ATLAS_PROJECT_ID` är satta i `.env`
- Starta om backend-servern efter att ha lagt till variablerna

### "Failed to provision MongoDB Atlas database"
- Kontrollera att API key har rätt behörigheter (Project Owner)
- Kontrollera att Project ID är korrekt
- Se backend logs för mer detaljer

### Connection string fungerar inte
- Kontrollera att IP-adress är whitelisted i MongoDB Atlas (Network Access)
- Kontrollera att användarnamn och lösenord är korrekt
- Kontrollera att cluster är aktivt

## Begränsningar

**Nuvarande implementation:**
- Genererar connection string template (användare måste konfigurera cluster URL manuellt)
- Skapar inte faktiska database users via API (kräver manuell setup)

**Framtida förbättringar:**
- Fullständig API-integration för att skapa clusters automatiskt
- Automatisk IP whitelisting
- Automatisk user management

## Ytterligare Resurser

- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [MongoDB Atlas Admin API](https://www.mongodb.com/docs/atlas/reference/api-resources-spec/v2/)
- [Mongoose Documentation](https://mongoosejs.com/docs/)


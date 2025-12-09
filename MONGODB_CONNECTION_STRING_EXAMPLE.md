# MongoDB Connection String - Exempel och Användning

## ⚠️ SÄKERHETSVARNING

**VIKTIGT:** Om du har delat din connection string publikt (t.ex. i chat, GitHub, etc.):
1. **Ändra lösenordet OMEDELBART** i MongoDB Atlas
2. **Skapa en ny database user** om möjligt
3. **Rotera API keys** om de har exponerats

## Connection String Format

Din connection string ser ut så här:
```
mongodb+srv://viktorstrindin93_db_user:vFDMQctgua3zG90f@cluster0.5r6tcwk.mongodb.net/?appName=Cluster0
```

### Delar av Connection String:

- `mongodb+srv://` - Protokoll (SRV för MongoDB Atlas)
- `viktorstrindin93_db_user` - Användarnamn
- `vFDMQctgua3zG90f` - **LÖSENORD** (känslig information!)
- `cluster0.5r6tcwk.mongodb.net` - Cluster hostname
- `?appName=Cluster0` - App name parameter

## Hur används denna?

### För Användarnas Importerade Projekt

När du importerar en MERN-app och systemet skapar `.env.example`, uppdatera den med din connection string:

**I användarnas projekt `.env` fil:**
```env
MONGODB_URI=mongodb+srv://viktorstrindin93_db_user:vFDMQctgua3zG90f@cluster0.5r6tcwk.mongodb.net/database-name?retryWrites=true&w=majority
```

**Viktigt:** Lägg till databasnamnet efter `/` (t.ex. `/my-ecommerce-db`)

### För Backend (Plattformen)

**DENNA CONNECTION STRING ANVÄNDS INTE I PLATTFORMENS BACKEND!**

Plattformens backend använder:
- `MONGODB_ATLAS_API_KEY` - För att skapa databaser via API
- `MONGODB_ATLAS_PROJECT_ID` - För att identifiera projektet

**Connection strings för användarnas projekt** sparas separat och krypterat i `project_databases` tabellen.

## Nästa Steg

### 1. Säkerhet (OMEDELBART om delat publikt)

1. Gå till https://cloud.mongodb.com
2. Database Access → Database Users
3. Hitta `viktorstrindin93_db_user`
4. Klicka "Edit" → "Edit Password"
5. Generera nytt säkert lösenord
6. Uppdatera connection string med nytt lösenord

### 2. Lägg till Databasnamn

Din connection string saknar databasnamn. Uppdatera till:

```
mongodb+srv://viktorstrindin93_db_user:NYTT_LÖSENORD@cluster0.5r6tcwk.mongodb.net/my-database-name?retryWrites=true&w=majority
```

### 3. IP Whitelisting

Se till att din IP-adress är whitelisted i MongoDB Atlas:
1. Network Access → Add IP Address
2. Lägg till din nuvarande IP eller `0.0.0.0/0` (för development, inte production!)

### 4. Använd i Projekt

När du importerar en MERN-app:
1. Systemet skapar `.env.example` med `MONGODB_URI`
2. Kopiera till `.env`
3. Ersätt placeholder med din faktiska connection string (med databasnamn)
4. Starta projektet

## Exempel på Komplett Connection String

```env
# För användarnas projekt .env
MONGODB_URI=mongodb+srv://viktorstrindin93_db_user:NYTT_LÖSENORD@cluster0.5r6tcwk.mongodb.net/mern-ecommerce-db?retryWrites=true&w=majority
```

## Säkerhetsbest Practices

1. **Aldrig commit connection strings** till Git
2. **Använd `.env` filer** som är i `.gitignore`
3. **Rotera lösenord regelbundet**
4. **Använd olika users** för olika projekt
5. **Begränsa IP-access** i production
6. **Använd environment variables** i deployment (Vercel, Render, etc.)


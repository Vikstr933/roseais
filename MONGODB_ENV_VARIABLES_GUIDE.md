# MongoDB Environment Variables Guide

## Översikt

Det finns **två olika typer** av MongoDB environment variables:

1. **Backend (Plattformen)** - För automatisk provisioning av MongoDB Atlas databaser
2. **Användarnas Projekt** - För att ansluta till MongoDB i deras importerade/genererade projekt

---

## 🔧 Backend Environment Variables (Render)

**Dessa sätts på BACKEND (Render) för att aktivera automatisk MongoDB Atlas provisioning:**

### Variabler som behövs:

```env
# MongoDB Atlas API Configuration (för automatisk provisioning)
MONGODB_ATLAS_API_KEY=your-public-api-key-from-atlas
MONGODB_ATLAS_PROJECT_ID=your-atlas-project-id
```

### Var sätter man dessa?

1. **Render Dashboard:**
   - Gå till ditt backend service på Render
   - Klicka på **Environment** tab
   - Lägg till:
     - `MONGODB_ATLAS_API_KEY` = Din MongoDB Atlas Public API Key
     - `MONGODB_ATLAS_PROJECT_ID` = Ditt MongoDB Atlas Project ID

2. **Lokal `.env` fil (för development):**
   - Lägg till i `server/.env`:
   ```env
   MONGODB_ATLAS_API_KEY=your-public-api-key
   MONGODB_ATLAS_PROJECT_ID=your-project-id
   ```

### Vad gör dessa variabler?

- **Aktiverar automatisk provisioning**: När användare importerar MERN-appar, kan systemet automatiskt skapa MongoDB Atlas databaser
- **Används av backend**: `DatabaseProvisioningService` använder dessa för att skapa databaser via MongoDB Atlas API

### Hur får man dessa värden?

Se: `MONGODB_ATLAS_SETUP_GUIDE.md` för detaljerade instruktioner.

**Snabbguide:**
1. Gå till https://cloud.mongodb.com
2. Project Settings → Access Manager → API Keys → Create API Key
3. Project Settings → General → Copy Project ID

---

## 📦 Användarnas Projekt Environment Variables

**Dessa sätts i ANVÄNDARNAS PROJEKT (inte i plattformens backend/frontend):**

### Variabel som behövs:

```env
# MongoDB Connection String (för användarnas projekt)
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/database-name?retryWrites=true&w=majority
```

### Var sätts denna?

**I användarnas projekt:**
- När ett MERN-projekt importeras, skapar systemet automatiskt `.env.example` med `MONGODB_URI`
- Användaren kopierar `.env.example` till `.env` och uppdaterar connection string

### Vad gör denna variabel?

- **Används av användarnas backend**: Deras Express server använder `MONGODB_URI` för att ansluta till MongoDB
- **Inte används av plattformen**: Plattformens backend/frontend använder INTE denna variabel

---

## 📋 Sammanfattning

### Backend (Render) - För Plattformen:

```env
# ✅ SÄTT DETTA PÅ BACKEND (Render)
MONGODB_ATLAS_API_KEY=your-atlas-public-api-key
MONGODB_ATLAS_PROJECT_ID=your-atlas-project-id
```

**Syfte:** Aktivera automatisk MongoDB Atlas provisioning för användarnas projekt

### Frontend (Vercel) - För Plattformen:

```env
# ❌ INGENTING FÖR MONGODB
# Frontend behöver inga MongoDB variabler
```

**Syfte:** Frontend använder inte MongoDB direkt

### Användarnas Projekt:

```env
# ✅ SÄTT DETTA I ANVÄNDARNAS PROJEKT
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
```

**Syfte:** Användarnas backend använder detta för att ansluta till MongoDB

---

## 🔄 Arbetsflöde

### Scenario 1: Automatisk Provisioning (API-nycklar konfigurerade)

1. **Backend har:**
   ```env
   MONGODB_ATLAS_API_KEY=xxx
   MONGODB_ATLAS_PROJECT_ID=yyy
   ```

2. **Användare importerar MERN-app:**
   - Systemet detekterar MongoDB-behov
   - Skapar automatiskt MongoDB Atlas databas
   - Genererar `.env.example` med faktisk connection string
   - Användaren kopierar till `.env` och kör projektet

### Scenario 2: Manuell Setup (API-nycklar saknas)

1. **Backend saknar:**
   ```env
   # MONGODB_ATLAS_API_KEY saknas
   # MONGODB_ATLAS_PROJECT_ID saknas
   ```

2. **Användare importerar MERN-app:**
   - Systemet detekterar MongoDB-behov
   - Ger instruktioner med länkar till MongoDB Atlas
   - Genererar `.env.example` med placeholder
   - Användaren skapar cluster manuellt och uppdaterar `.env`

---

## ✅ Checklista

### För Backend (Render):

- [ ] Har MongoDB Atlas account
- [ ] Har skapat API Key (Public Key)
- [ ] Har Project ID
- [ ] Har lagt till `MONGODB_ATLAS_API_KEY` i Render environment variables
- [ ] Har lagt till `MONGODB_ATLAS_PROJECT_ID` i Render environment variables
- [ ] Har startat om backend efter att ha lagt till variablerna

### För Användarnas Projekt:

- [ ] Har MongoDB Atlas cluster (eller lokal MongoDB)
- [ ] Har connection string
- [ ] Har kopierat `.env.example` till `.env`
- [ ] Har uppdaterat `MONGODB_URI` i `.env` med faktisk connection string

---

## 🔗 Ytterligare Resurser

- **MongoDB Atlas Setup:** `MONGODB_ATLAS_SETUP_GUIDE.md`
- **Database Provisioning:** `DATABASE_PROVISIONING_GUIDE.md`
- **MongoDB Atlas Dashboard:** https://cloud.mongodb.com


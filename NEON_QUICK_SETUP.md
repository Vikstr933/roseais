# Neon Quick Setup - Din Konfiguration

## ⚠️ SÄKERHETSVARNING

Du har delat känslig information (API key och lösenord) i chatten. 

**VIKTIGT - Gör detta NU:**
1. Gå till [Neon Dashboard](https://console.neon.tech) → Settings → API Keys
2. **Radera** den API key du just delade
3. **Skapa en ny** API key
4. Om du vill, ändra database password i Settings → Database → Reset Password

## Din Konfiguration

Baserat på informationen du delade:

### 1. Lägg till i din `.env` fil (lokalt):

```env
# Neon API för Database Provisioning
NEON_API_KEY=napi_xy2slp0kli2hpp190ofkz986simfejjgo043wmn0wlh97tvpn69nl4f6nz5oxndn
NEON_PROJECT_ID=broad-butterfly-61473215

# OBS: DATABASE_URL används redan för plattformens huvuddatabas i Render
# Du behöver INTE lägga till den här igen - den finns redan konfigurerad
# Lägg bara till den lokalt om du behöver den för lokal development
```

**VIKTIGT**: 
- ⚠️ **ROTERA API KEY** - Den du delade är nu komprometterad
- ⚠️ **Ändra lösenord** om du vill (npg_jh5y6IMaJPGl)
- ✅ **ALDRIG committa** `.env` filen till git

### 2. För Production (Render):

1. Gå till Render Dashboard → ditt backend service
2. Environment tab → Add Environment Variable:

```
NEON_API_KEY = [din nya API key efter rotation]
NEON_PROJECT_ID = broad-butterfly-61473215
```

**OBS**: `DATABASE_URL` finns redan konfigurerad i Render för plattformens huvuddatabas - lägg INTE till den igen!

### 3. Kör Migration

1. Gå till [Neon Dashboard](https://console.neon.tech) → SQL Editor
2. Klicka "New query"
3. Öppna `migrations/2025_add_project_databases_table.sql`
4. Kopiera innehållet och kör i SQL Editor

### 4. Testa

1. Starta backend: `npm run dev:server`
2. Importera ett projekt som behöver databas
3. Kolla Neon Dashboard → Branches för att se om ny branch skapades

## Vad varje värde är:

- **NEON_API_KEY**: Används för att automatiskt skapa branches (databaser) för användarnas projekt
- **NEON_PROJECT_ID**: Identifierar ditt Neon-projekt
- **DATABASE_URL**: (Redan konfigurerad i Render) Connection string för plattformens huvuddatabas (där users, projects, etc. sparas)

## Nästa Steg:

1. ✅ Rotera API key (VIKTIGT!)
2. ✅ Lägg till i `.env` (lokalt)
3. ✅ Lägg till i Render (production)
4. ✅ Kör migration
5. ✅ Testa provisioning

---

**Kom ihåg**: Efter att du roterat API-nyckeln, uppdatera både `.env` och Render med den nya nyckeln!


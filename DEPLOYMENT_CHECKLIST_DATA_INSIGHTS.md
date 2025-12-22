# Deployment Checklist - Data Insights Feature

## Problem
404-fel när man försöker komma åt `/api/data-insights/overview` - backend har inte deployats med den nya koden.

## Lösning

### 1. Backend Deployment (Render)
Backend behöver redeployas efter git push. Detta sker vanligtvis automatiskt om:
- Auto-deploy är aktiverat i Render
- Git push har gjorts till main/master branch

**Manuell deployment:**
1. Gå till Render Dashboard
2. Välj ditt backend service
3. Klicka på "Manual Deploy" → "Deploy latest commit"

### 2. Databasändringar
**INGA databasändringar behövs!** 

Data Insights-endpointen använder bara befintliga tabeller:
- ✅ `code_generation_sessions` (finns redan)
- ✅ `agents` (finns redan)
- ✅ `workspaces` (finns redan)
- ✅ `users` (finns redan)
- ✅ `chain_executions` (finns redan)
- ✅ `prompt_chains` (finns redan)
- ✅ `project_members` (finns redan)

Alla dessa tabeller borde redan finnas i Supabase.

### 3. Verifiering efter deployment

Efter att backend har deployats, testa:

```bash
# Testa endpoint direkt (ersätt med din backend URL)
curl https://ai-library-backend-3mmv.onrender.com/api/data-insights/overview \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Eller testa i browser console:
```javascript
fetch('/api/data-insights/overview', {
  headers: {
    'Authorization': `Bearer ${sessionToken}`
  }
})
.then(r => r.json())
.then(console.log)
```

### 4. Om problemet kvarstår

**Kontrollera:**
1. ✅ Är filen `server/routes/data-insights.ts` pushad till git?
2. ✅ Är routen registrerad i `server/routes.ts`?
3. ✅ Har backend faktiskt deployats? (kolla Render logs)
4. ✅ Finns det några fel i backend logs?

**Debugging:**
- Kolla Render logs för att se om routen registreras:
  - Sök efter: "✅ Data insights router registered at /api/data-insights"
- Om routen inte registreras, kolla om det finns TypeScript-kompileringsfel

### 5. Filerna som behöver vara deployade

- ✅ `server/routes/data-insights.ts` (ny fil)
- ✅ `server/routes.ts` (uppdaterad med import och registrering)
- ✅ `client/src/pages/DataInsights.tsx` (ny fil)
- ✅ `client/src/pages/AdminDashboard.tsx` (uppdaterad)
- ✅ `client/src/App.tsx` (uppdaterad med route)

## Snabbfix

Om du vill testa lokalt först:

```bash
# Starta backend lokalt
npm run dev:server

# I en annan terminal, starta frontend
npm run dev:client

# Testa sedan endpoint
curl http://localhost:5000/api/data-insights/overview \
  -H "Authorization: Bearer YOUR_TOKEN"
```


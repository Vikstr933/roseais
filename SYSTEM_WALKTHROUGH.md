# 🚀 System Walkthrough - Hur Ditt System Fungerar

**Datum:** 2025-11-30  
**Syfte:** Enkel förklaring av hur kodgenerering fungerar i ditt system

---

## 📋 TL;DR - Snabb Översikt

1. **Du skriver en prompt** → "Skapa en todo-app"
2. **AnalysisAgent** analyserar → Skapar en plan med faser
3. **IncrementalOrchestrator** kör faserna → Genererar kod steg för steg
4. **Agenterna från databasen** används → `component-architect` och `component-developer`
5. **Koden sparas** → I ditt projekt

**JA, dina agenter i databasen används!** ✅

---

## 🔄 Komplett Flow

### **Steg 1: Användaren skriver en prompt**

```
Användare: "Skapa en todo-app med React"
    ↓
POST /api/prompts/generate
```

**Var:** `client/src/pages/PromptPlayground.tsx` → `server/routes/prompts.ts`

---

### **Steg 2: Systemet bestämmer vilken metod att använda**

**Kod:** `server/routes/prompts.ts:910`

```typescript
// ALWAYS use incremental generation - it's the standard way
console.log('🔄 Using INCREMENTAL generation mode (always enabled)');
return await handleIncrementalGeneration(...);
```

**Svar:** Systemet använder **ALLTID** incremental generation (inte den gamla orchestration-metoden)

---

### **Steg 3: AnalysisAgent skapar en plan**

**Kod:** `server/routes/prompts.ts:1852` → `server/services/IncrementalOrchestrator.ts` → `server/services/AnalysisAgent.ts`

**Vad händer:**
1. `AnalysisAgent` laddar `component-architect` agenten från databasen
2. Använder agentens `systemPrompt` för att analysera
3. Skapar en `GenerationPlan` med faser:

```typescript
// AnalysisAgent.ts:302
private async getAgentConfig() {
  const agentResults = await db
    .select()
    .from(agents)
    .where(eq(agents.id, 'component-architect')); // ✅ Laddar från databas!
  
  return {
    systemPrompt: agent.systemPrompt,  // ✅ Från databas
    model: agent.model,                  // ✅ Från databas
    temperature: agent.temperature      // ✅ Från databas
  };
}
```

**Resultat:** En plan med faser, t.ex.:
```json
{
  "appName": "Todo App",
  "phases": [
    { "phase": 1, "files": ["package.json", "tsconfig.json"], "agentId": "component-developer" },
    { "phase": 2, "files": ["src/App.tsx"], "agentId": "component-developer" },
    { "phase": 3, "files": ["src/components/TodoList.tsx"], "agentId": "component-developer" }
  ]
}
```

---

### **Steg 4: IncrementalOrchestrator kör varje fas**

**Kod:** `server/services/IncrementalOrchestrator.ts:83`

**Vad händer för varje fas:**

1. **Ladda agent från databas:**
```typescript
// IncrementalOrchestrator.ts:279
const agentConfig = await this.getAgentConfig(phase.agentId); // ✅ Laddar component-developer från DB

// getAgentConfig() gör:
const agentResults = await db
  .select()
  .from(agents)
  .where(eq(agents.id, 'component-developer')); // ✅ Från databas!
```

2. **Generera kod med agentens inställningar:**
```typescript
// IncrementalOrchestrator.ts:288
const response = await this.aiCodeGenerator.generateComponent({
  prompt: phasePrompt,
  systemPrompt: agentConfig.systemPrompt,  // ✅ Från databas-agenten!
  // Agentens model och temperature används också
});
```

3. **Validera och fixa:**
```typescript
// Fixar syntaxfel automatiskt
phaseResult.files = await this.fixPhase(phaseResult.files, errors, existingFiles, phase);
```

4. **Spara filer:**
```typescript
// Sparar till projektet
await this.saveFiles(phaseResult.files, projectId);
```

---

### **Steg 5: Resultatet skickas till frontend**

**Via SSE (Server-Sent Events):**
- `GENERATION_START` - Startar
- `PLAN_CREATED` - Planen är klar
- `PHASE_PROGRESS` - Varje fas progress
- `FILE_GENERATED` - Varje fil genererad
- `GENERATION_COMPLETE` - Klart!

**Frontend:** `client/src/pages/PromptPlayground.tsx` lyssnar på dessa events och visar live updates

---

## 🤖 Vilka Agenter Används?

### **1. `component-architect` Agent**
- **Används för:** Analys och planering
- **När:** Första steget (AnalysisAgent)
- **Var:** `server/services/AnalysisAgent.ts:302`
- **Från databas:** ✅ JA

### **2. `component-developer` Agent**
- **Används för:** Kodgenerering
- **När:** Varje fas som genererar kod
- **Var:** `server/services/IncrementalOrchestrator.ts:279`
- **Från databas:** ✅ JA

### **3. Andra agenter i databasen?**
- **Status:** Kan användas, men AnalysisAgent är hårdkodad att använda `component-developer`
- **Var:** Du kan se dem i Agent Manager-sidan
- **Hur använda:** Uppdatera AnalysisAgent för att välja rätt agent baserat på uppgift
- **Se:** `AGENT_CUSTOMIZATION_GUIDE.md` för detaljerad guide

---

## 📊 Databasstruktur

### **Agents Tabellen:**
```sql
SELECT * FROM agents WHERE id IN ('component-architect', 'component-developer');
```

**Viktiga kolumner:**
- `id` - Agent-ID (t.ex. "component-developer")
- `systemPrompt` - Systemprompten som används ✅
- `model` - AI-modell (t.ex. "claude-sonnet-4-5-20250929") ✅
- `temperature` - Temperatur-inställning ✅
- `is_active` - Om agenten är aktiv

---

## 🔍 Var Hittar Jag Koden?

### **Kodgenerering:**
1. **Entry Point:** `server/routes/prompts.ts:910` → `handleIncrementalGeneration()`
2. **Orchestrator:** `server/services/IncrementalOrchestrator.ts`
3. **Analysis:** `server/services/AnalysisAgent.ts`
4. **Code Generator:** `server/services/AICodeGenerator.ts`

### **Agent Loading:**
1. **AnalysisAgent:** `server/services/AnalysisAgent.ts:302` → `getAgentConfig()`
2. **IncrementalOrchestrator:** `server/services/IncrementalOrchestrator.ts:929` → `getAgentConfig(agentId)`

### **Frontend:**
1. **Playground:** `client/src/pages/PromptPlayground.tsx`
2. **SSE Events:** Lyssnar på `agent-event` events

---

## ✅ Checklista: Används Mina Agenter?

### **Test 1: Kolla databasen**
```sql
SELECT id, name, is_active, model, temperature 
FROM agents 
WHERE id IN ('component-architect', 'component-developer');
```

**Förväntat resultat:**
- Båda agenterna ska finnas
- `is_active` ska vara `true` (eller `1`)
- `systemPrompt` ska innehålla instruktioner

### **Test 2: Kolla loggarna**
När du genererar kod, leta efter:
```
[IncrementalOrchestrator] Using agent component-developer
[AnalysisAgent] Loaded agent component-architect from database
```

### **Test 3: Ändra en agent i databasen**
1. Gå till Agent Manager-sidan
2. Ändra `systemPrompt` för `component-developer`
3. Generera kod igen
4. Du ska se din ändring användas! ✅

---

## 🎯 Sammanfattning

### **Används orchestration eller incremental?**
**Svar:** **INCREMENTAL** (alltid på)

### **Används agenterna från databasen?**
**Svar:** **JA!** ✅
- `component-architect` för analys
- `component-developer` för kodgenerering

### **Hur fungerar kodgenerering?**
1. AnalysisAgent analyserar → Skapar plan
2. IncrementalOrchestrator kör faserna → Genererar kod
3. Varje fas använder `component-developer` agenten från databasen
4. Koden sparas till projektet

### **Var kan jag ändra agenter?**
- **Agent Manager-sidan** i din plattform
- **Databasen direkt:** `UPDATE agents SET systemPrompt = '...' WHERE id = 'component-developer'`

---

## 🚀 Nästa Steg

1. **Testa:** Generera kod och kolla loggarna
2. **Experimentera:** Ändra `component-developer` agentens prompt
3. **Utöka:** Lägg till fler agenter för specifika uppgifter (t.ex. testning, dokumentation)

---

**Frågor?** Kolla koden eller fråga mig! 😊


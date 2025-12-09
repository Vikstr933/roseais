# 🤖 Agent Customization Guide - Lägga Till Nya Agenter

**Datum:** 2025-11-30  
**Syfte:** Förklara hur du lägger till nya agenter och hur de används

---

## 📋 Nuvarande Situation

### **Vad händer om du skapar en ny agent?**

**Kort svar:** Den kommer **INTE** automatiskt användas just nu, men systemet **KAN** använda den om du konfigurerar det rätt.

### **Varför?**

1. **AnalysisAgent är hårdkodad:**
   - I `AnalysisAgent.ts:202` står det: `"Use 'component-developer' as agentId for code generation phases"`
   - AnalysisAgent skapar alltid planer med `agentId: "component-developer"`

2. **Men systemet stödjer olika agenter:**
   - `IncrementalOrchestrator` kan använda **vilken agent som helst** baserat på `phase.agentId`
   - Om agenten finns i databasen, laddas den och används
   - Om agenten inte finns, fallback till default

---

## ✅ Hur Systemet Fungerar Nu

### **Steg 1: AnalysisAgent skapar plan**

```typescript
// AnalysisAgent.ts:186
{
  "phase": "base",
  "description": "Project foundation",
  "files": ["package.json", "tsconfig.json"],
  "agentId": "component-developer"  // ← Hårdkodad här
}
```

### **Steg 2: IncrementalOrchestrator laddar agenten**

```typescript
// IncrementalOrchestrator.ts:279
const agentConfig = await this.getAgentConfig(phase.agentId); // Laddar från DB

// getAgentConfig() gör:
const agentResults = await db
  .select()
  .from(agents)
  .where(eq(agents.id, phase.agentId)); // ✅ Söker efter agentId från planen

if (agentResults.length > 0) {
  // ✅ Använder agenten från databasen!
  return {
    systemPrompt: agent.systemPrompt,
    model: agent.model,
    temperature: agent.temperature
  };
} else {
  // ❌ Fallback om agenten inte finns
  return defaultConfig;
}
```

**Så:** Om `phase.agentId` pekar på en agent som finns i databasen, används den! ✅

---

## 🎯 Hur Använda Nya Agenter

### **Metod 1: Ändra AnalysisAgent (Rekommenderat)**

**Problem:** AnalysisAgent är hårdkodad att använda `component-developer`

**Lösning:** Uppdatera AnalysisAgent för att välja agenter baserat på uppgift:

```typescript
// I AnalysisAgent.ts, ändra buildAnalysisPrompt():

// Istället för:
"agentId": "component-developer"

// Använd smart selektion:
"agentId": this.selectAgentForPhase(phase, userPrompt)

// Lägg till metod:
private selectAgentForPhase(phase: string, prompt: string): string {
  // Styling-fas? Använd styling-agent
  if (phase.includes('style') || phase.includes('css')) {
    return 'component-stylist'; // Om den finns i DB
  }
  
  // Test-fas? Använd test-agent
  if (phase.includes('test') || phase.includes('spec')) {
    return 'component-qa'; // Om den finns i DB
  }
  
  // Dokumentation? Använd docs-agent
  if (phase.includes('readme') || phase.includes('doc')) {
    return 'component-documenter'; // Om den finns i DB
  }
  
  // Default: component-developer
  return 'component-developer';
}
```

### **Metod 2: Manuell Agent-Selektion (Enklare)**

**För nuvarande:** Skapa agenten i databasen, men den används inte automatiskt.

**För framtiden:** Vi kan uppdatera AnalysisAgent för att:
1. Kolla vilka agenter som finns i databasen
2. Välja rätt agent baserat på uppgift
3. Använda specialiserade agenter för olika faser

---

## 💡 Fördelar Med Fler Agenter

### **1. Specialisering = Bättre Kvalitet**

**Exempel: Styling-Agent**
```typescript
// component-stylist agent
systemPrompt: `
Du är en expert på CSS och modern design.
- Skapa alltid responsiv design
- Använd CSS Grid och Flexbox
- Inkludera dark mode support
- Följ modern design trends
`
```

**Resultat:** Bättre CSS än om `component-developer` gör allt!

### **2. Olika Modeller för Olika Uppgifter**

**Exempel:**
- **component-developer:** Claude Sonnet (kreativ kod)
- **component-qa:** Claude Haiku (snabb validering, billigare)
- **component-stylist:** Claude Sonnet (design kräver kreativitet)

**Resultat:** 20-30% kostnadsbesparing + snabbare validering!

### **3. Olika Temperaturer**

**Exempel:**
- **component-developer:** temperature: 0.3 (konsistent kod)
- **component-stylist:** temperature: 0.7 (kreativ design)
- **component-qa:** temperature: 0.1 (exakt validering)

**Resultat:** Bättre resultat för varje uppgift!

---

## 🚀 Praktiska Exempel

### **Exempel 1: Lägg Till Styling-Agent**

**1. Skapa agenten i databasen:**
```sql
INSERT INTO agents (
  id, 
  name, 
  system_prompt, 
  model, 
  temperature,
  is_active
) VALUES (
  'component-stylist',
  'CSS & Styling Expert',
  'Du är en expert på modern CSS och design. Skapa alltid responsiv, tillgänglig design med CSS Grid/Flexbox...',
  'claude-sonnet-4-5-20250929',
  0.7,
  true
);
```

**2. Uppdatera AnalysisAgent:**
```typescript
// I buildAnalysisPrompt(), ändra:
if (phase.includes('css') || phase.includes('style')) {
  agentId = 'component-stylist';
}
```

**3. Resultat:**
- CSS-faser använder nu `component-stylist` ✅
- Bättre styling-kvalitet! ✅

### **Exempel 2: Lägg Till Test-Agent**

**1. Skapa agenten:**
```sql
INSERT INTO agents (
  id,
  name,
  system_prompt,
  model,
  temperature,
  is_active
) VALUES (
  'component-qa',
  'Quality Assurance Agent',
  'Du är en QA-expert. Skapa omfattande tester med hög coverage. Fokusera på edge cases...',
  'claude-haiku-3',  -- Billigare för validering
  0.1,                -- Låg temperatur för exakthet
  true
);
```

**2. Lägg till test-fas i planen:**
```typescript
// AnalysisAgent kan lägga till en test-fas:
{
  phase: "testing",
  description: "Generate comprehensive tests",
  files: ["src/**/*.test.tsx"],
  agentId: "component-qa"  // ✅ Använder QA-agenten!
}
```

---

## 🔧 Förbättringar Vi Kan Göra

### **1. Smart Agent-Selektion i AnalysisAgent**

**Nuvarande:**
```typescript
agentId: "component-developer"  // Alltid samma
```

**Förbättring:**
```typescript
agentId: await this.selectBestAgent(phase, userPrompt)

// selectBestAgent() gör:
// 1. Kollar vilka agenter som finns i databasen
// 2. Väljer rätt agent baserat på:
//    - Phase-typ (base, core, styling, testing)
//    - User prompt (nämner "test", "style", etc.)
//    - Agent capabilities (från databasen)
```

### **2. Agent Capabilities i Databasen**

**Lägg till kolumn:**
```sql
ALTER TABLE agents ADD COLUMN capabilities JSONB DEFAULT '{}'::jsonb;

-- Exempel:
UPDATE agents SET capabilities = '{
  "canGenerateCode": true,
  "canGenerateTests": false,
  "canGenerateStyles": true,
  "canGenerateDocs": false,
  "specialties": ["react", "typescript", "css"]
}' WHERE id = 'component-stylist';
```

**Användning:**
```typescript
// AnalysisAgent väljer agent baserat på capabilities
const suitableAgents = agents.filter(agent => 
  agent.capabilities.canGenerateStyles && 
  phase.includes('style')
);
```

### **3. Multi-Agent Phases**

**För komplexa faser, använd flera agenter:**
```typescript
{
  phase: "complete-component",
  agents: [
    { agentId: "component-developer", task: "Generate component code" },
    { agentId: "component-stylist", task: "Generate CSS styling" },
    { agentId: "component-qa", task: "Generate tests" }
  ]
}
```

---

## 📊 Sammanfattning

### **Nuvarande Status:**
- ✅ Systemet **KAN** använda nya agenter
- ❌ AnalysisAgent är **hårdkodad** att använda `component-developer`
- ✅ IncrementalOrchestrator **stödjer** olika agenter

### **Vad Du Kan Göra Nu:**
1. **Skapa nya agenter** i databasen
2. **Uppdatera AnalysisAgent** för att välja rätt agent
3. **Experimentera** med olika agenter för olika uppgifter

### **Fördelar:**
- 🎯 **Bättre kvalitet** genom specialisering
- 💰 **Lägre kostnad** genom rätt modell per uppgift
- ⚡ **Snabbare** genom parallell körning
- 🔧 **Flexibilitet** att anpassa systemet

### **Nästa Steg:**
1. Skapa en test-agent (t.ex. `component-stylist`)
2. Uppdatera AnalysisAgent för att använda den
3. Testa och se skillnaden!

---

**Vill du att jag implementerar smart agent-selektion?** 🚀


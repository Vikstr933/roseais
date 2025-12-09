# Export/Import Fix - Sammanfattning

## Problem
Komponenter exporterades som `export default function Features()` men importerades som `import { Features }`, vilket orsakade build-fel:
```
"Features" is not exported by "src/components/Features.tsx", imported by "src/App.tsx"
```

## Lösning
Istället för att fixa problemet efteråt med en auto-fixer, har vi uppdaterat **kodgenerationen direkt** så att komponenter exporteras korrekt från början.

## Ändringar i koden

### 1. `server/services/AICodeGenerator.ts`
- ✅ Lagt till tydliga export/import-regler i system prompten
- ✅ Uppdaterat exempel för att visa korrekt export/import-matchning
- ✅ Uppdaterat `createStubFile` för att använda named exports för komponenter

### 2. `server/services/IncrementalOrchestrator.ts`
- ✅ Lagt till export/import-regler i `buildPhasePrompt`
- ✅ Uppdaterat exempel i output format
- ✅ Uppdaterat `getDefaultPrompt` för `component-developer` agent

### 3. `server/services/AnalysisAgent.ts`
- ✅ Uppdaterat `getDefaultPrompt` för `component-architect` agent

### 4. `server/services/ProductionDeploymentService.ts`
- ✅ Tagit bort auto-fixer för export/import-mismatches
- ✅ Lagt till kommentar om att problemet ska fixas vid kodgeneration

## Viktiga regler som nu ingår i prompts

1. **Komponenter i `src/components/*.tsx`**: MÅSTE använda NAMED exports
   - ✅ `export function Features() { ... }`
   - ✅ `import { Features } from './components/Features'`

2. **Main App (`src/App.tsx`)**: Använd DEFAULT export
   - ✅ `export default function App() { ... }`
   - ✅ `import App from './App'`

3. **Matchning**: Export-typ MÅSTE matcha import-typ
   - Named import → named export
   - Default import → default export

## ⚠️ VIKTIGT: Uppdatera Agent Prompts i Supabase

Systemet använder agents från databasen (Supabase). Du behöver uppdatera agent prompts där också!

### Steg 1: Kör SQL-scriptet
Kör `scripts/update_agent_prompts_export_import.sql` i Supabase SQL Editor.

### Steg 2: Verifiera
Kontrollera att prompts är uppdaterade:
```sql
SELECT id, name, 
       system_prompt LIKE '%Export/Import Matching%' as has_rules
FROM agents 
WHERE id IN ('component-developer', 'component-architect');
```

### Steg 3: Testa
Generera ett nytt projekt och kontrollera att:
- Alla komponenter i `src/components/` använder named exports
- `App.tsx` importerar dem korrekt
- `npm run build` fungerar utan fel

## Fallback
Om agent prompts inte finns i databasen, används default prompts från koden som redan är uppdaterade.

## Dokumentation
- `UPDATE_AGENT_PROMPTS_FOR_EXPORT_IMPORT.md` - Detaljerad guide
- `scripts/update_agent_prompts_export_import.sql` - SQL-script för Supabase


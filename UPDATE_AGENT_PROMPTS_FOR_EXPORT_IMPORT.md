# Guide: Uppdatera Agent Prompts i Supabase för Export/Import Matching

## Problem
Komponenter exporteras som `export default function Features()` men importeras som `import { Features }`, vilket orsakar build-fel.

## Lösning
Vi behöver uppdatera agent prompts i Supabase-databasen för att inkludera tydliga instruktioner om export/import-matching.

## Agents som behöver uppdateras

### 1. `component-developer` (används i IncrementalOrchestrator)
- **Används för**: Kodgeneration i olika faser
- **Var**: `server/services/IncrementalOrchestrator.ts` → `getAgentConfig('component-developer')`

### 2. `component-architect` (används i AnalysisAgent)
- **Används för**: Analys och planering
- **Var**: `server/services/AnalysisAgent.ts` → `getAgentConfig()`

### 3. Andra agents som genererar React-komponenter
- Kolla vilka agents som finns i databasen och används för kodgeneration

## SQL för att uppdatera prompts

### Steg 1: Kolla nuvarande prompts
```sql
SELECT id, name, system_prompt 
FROM agents 
WHERE id IN ('component-developer', 'component-architect')
ORDER BY id;
```

### Steg 2: Lägg till Export/Import-sektion i prompts

#### För `component-developer`:
```sql
UPDATE agents
SET system_prompt = system_prompt || E'\n\n' || E'## 🚨 CRITICAL: Export/Import Matching Rules 🚨
**MISMATCHED EXPORTS/IMPORTS WILL BREAK THE BUILD:**

1. **Components in `src/components/*.tsx`**: MUST use NAMED exports
   - ✅ CORRECT: `export function Features() { ... }` or `export const Features = () => { ... }`
   - ✅ CORRECT: Import as `import { Features } from ''./components/Features'';`
   - ❌ WRONG: `export default function Features() { ... }` (if imported as `import { Features }`)

2. **Main App (`src/App.tsx`)**: Use DEFAULT export
   - ✅ CORRECT: `export default function App() { ... }`
   - ✅ CORRECT: Import as `import App from ''./App'';`

3. **Matching Rule**: Export type MUST match import type
   - Named import `import { ComponentName }` requires named export `export function ComponentName()`
   - Default import `import ComponentName` requires default export `export default function ComponentName()`

4. **Best Practice**: For ALL components in `src/components/`, use NAMED exports:
   - ✅ `export function Hero() { ... }`
   - ✅ `export function Features() { ... }`
   - ✅ `export function Stats() { ... }`
   - Then import: `import { Hero, Features, Stats } from ''./components/...'';`

**VERIFICATION CHECKLIST:**
- [ ] If I write `import { ComponentName }`, the component file has `export function ComponentName()` or `export const ComponentName = ...`
- [ ] If I write `import ComponentName`, the component file has `export default function ComponentName()`
- [ ] All components in `src/components/` use named exports
- [ ] Only `App.tsx` uses default export'
WHERE id = 'component-developer';
```

#### För `component-architect`:
```sql
UPDATE agents
SET system_prompt = system_prompt || E'\n\n' || E'## 🚨 CRITICAL: Export/Import Matching Rules 🚨
**When planning component structure, ensure:**

1. **Components in `src/components/*.tsx`**: MUST use NAMED exports
   - ✅ CORRECT: `export function Features() { ... }`
   - ✅ CORRECT: Import as `import { Features } from ''./components/Features'';`

2. **Main App (`src/App.tsx`)**: Use DEFAULT export
   - ✅ CORRECT: `export default function App() { ... }`

3. **Matching Rule**: Export type MUST match import type
   - Named import requires named export
   - Default import requires default export

4. **Best Practice**: For ALL components in `src/components/`, use NAMED exports'
WHERE id = 'component-architect';
```

### Steg 3: Verifiera uppdateringar
```sql
SELECT id, name, 
       LENGTH(system_prompt) as prompt_length,
       system_prompt LIKE '%Export/Import Matching%' as has_export_rules
FROM agents 
WHERE id IN ('component-developer', 'component-architect')
ORDER BY id;
```

## Alternativ: Uppdatera via Supabase Dashboard

1. Gå till Supabase Dashboard → Table Editor → `agents`
2. Hitta agenten (t.ex. `component-developer`)
3. Klicka på raden för att redigera
4. I `system_prompt`-fältet, lägg till export/import-sektionen längst ner
5. Spara ändringarna

## Viktiga punkter

- **Komponenter i `src/components/`**: Använd ALLTID named exports (`export function ComponentName()`)
- **App.tsx**: Använd default export (`export default function App()`)
- **Matchning**: Export-typ MÅSTE matcha import-typ
- **Verifiering**: Kontrollera alltid att exports matchar imports innan kod genereras

## Testa efter uppdatering

1. Generera ett nytt projekt med komponenter
2. Kontrollera att alla komponenter i `src/components/` använder named exports
3. Kontrollera att `App.tsx` importerar dem korrekt med named imports
4. Kör `npm run build` för att verifiera att det fungerar

## Fallback

Om agent prompt inte finns i databasen, används default prompten från koden:
- `IncrementalOrchestrator.getDefaultPrompt()` - redan uppdaterad med export/import-regler
- `AnalysisAgent.getDefaultPrompt()` - behöver uppdateras om den används


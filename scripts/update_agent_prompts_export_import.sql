-- SQL Script: Uppdatera Agent Prompts för Export/Import Matching
-- Kör detta i Supabase SQL Editor för att lägga till export/import-regler i agent prompts

-- ============================================================================
-- EXPORT/IMPORT RULES SECTION (lägg till i alla relevanta agent prompts)
-- ============================================================================

-- Regel-sektion som ska läggas till i prompts
DO $$
DECLARE
  export_import_section TEXT;
BEGIN
  export_import_section := E'\n\n## 🚨 CRITICAL: Export/Import Matching Rules 🚨
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
- [ ] Only `App.tsx` uses default export';

  -- ============================================================================
  -- UPPDATERA component-developer AGENT
  -- ============================================================================
  UPDATE agents
  SET system_prompt = system_prompt || export_import_section
  WHERE id = 'component-developer'
    AND system_prompt NOT LIKE '%Export/Import Matching Rules%';

  -- ============================================================================
  -- UPPDATERA component-architect AGENT (kortare version för planering)
  -- ============================================================================
  UPDATE agents
  SET system_prompt = system_prompt || E'\n\n## 🚨 CRITICAL: Component Export/Import Structure 🚨
When planning component structure, ensure:
- Components in `src/components/*.tsx` use NAMED exports: `export function ComponentName() { ... }`
- Main App (`src/App.tsx`) uses DEFAULT export: `export default function App() { ... }`
- Import statements match export types (named import → named export, default import → default export)
- All components in `src/components/` should use named exports for consistency'
  WHERE id = 'component-architect'
    AND system_prompt NOT LIKE '%Component Export/Import Structure%';

  -- ============================================================================
  -- UPPDATERA ANDRA AGENTS SOM GENERERAR REACT-KOMPONENTER
  -- (Lägg till fler agent IDs här om de finns)
  -- ============================================================================
  
  -- Exempel: Om det finns andra agents som genererar komponenter
  -- UPDATE agents
  -- SET system_prompt = system_prompt || export_import_section
  -- WHERE id IN ('other-agent-id-1', 'other-agent-id-2')
  --   AND system_prompt NOT LIKE '%Export/Import Matching Rules%';

  RAISE NOTICE 'Agent prompts updated successfully!';
END $$;

-- ============================================================================
-- VERIFIERA UPPDATERINGAR
-- ============================================================================
SELECT 
  id,
  name,
  LENGTH(system_prompt) as prompt_length,
  CASE 
    WHEN system_prompt LIKE '%Export/Import Matching Rules%' THEN '✅ Has export/import rules'
    WHEN system_prompt LIKE '%Component Export/Import Structure%' THEN '✅ Has export/import structure'
    ELSE '❌ Missing export/import rules'
  END as export_import_status,
  LEFT(system_prompt, 200) || '...' as prompt_preview
FROM agents 
WHERE id IN ('component-developer', 'component-architect')
ORDER BY id;


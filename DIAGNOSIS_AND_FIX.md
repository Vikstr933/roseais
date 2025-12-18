# Diagnos: Varför använder inte Elon kodgenereringsverktygen?

## Problem 1: Database Error (FIXAT ✅)

**Felet:**
```
error: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

**Orsak:**
- `ContextLearningService` försöker använda `ON CONFLICT (pattern_name)` 
- Men unique constraint saknas i databasen
- Detta förhindrar att learning systemet fungerar korrekt

**Lösning:**
- Skapad fix-migration: `migrations/2025_12_18_fix_agent_learning_patterns_unique_constraint.sql`
- Denna migration lägger till explicit unique constraint/index för `pattern_name`

**Kör migrationen:**
```sql
-- Kör denna migration för att fixa problemet
\i migrations/2025_12_18_fix_agent_learning_patterns_unique_constraint.sql
```

---

## Problem 2: Varför använder inte Elon kodgenereringsverktygen?

### Analys av koden:

1. **PersonalAssistantAgent (Elon) HAR `generate_code` tool:**
   - Tool finns definierad (rad 163-164 i PersonalAssistantAgent.ts)
   - Men den läggs bara till när det finns playground context ELLER selected project (rad 1243-1247)

2. **När tool INTE är tillgänglig:**
   - Ingen playground context skickas med request
   - Inget projekt är valt
   - Då kan inte Elon använda `generate_code` tool

3. **När tool ÄR tillgänglig men inte används:**
   - System prompten kanske inte instruerar tillräckligt starkt att använda tool
   - AI:n väljer att ge kod direkt i chatten istället
   - Detta är ett prompt/system prompt problem

### Lösningar:

#### Lösning A: Säkerställ att playground context skickas

När användaren är i playground och pratar med Elon, måste playground context skickas med:

```typescript
// I frontend när användaren chattar med Elon från playground
const playgroundContext = {
  projectId: currentProject?.id,
  currentProject: currentProject?.name,
  filesCount: files.length,
  filePaths: files.map(f => f.path),
  // ... etc
};

// Skicka med i request
await omniAssistant.processRequest(userId, message, {
  playgroundContext: playgroundContext
});
```

#### Lösning B: Förbättra system prompten för Elon

Uppdatera system prompten i databasen för att instruera Elon att:
1. **ALLTID** använda `generate_code` tool när användaren ber om kod/projekt
2. **ALDRIG** bara ge kod i chatten när tool är tillgänglig
3. Förklara att tool skapar filer direkt i projektet

**SQL för att uppdatera prompten:**
```sql
UPDATE agents 
SET system_prompt = system_prompt || '

🚨 CRITICAL: CODE GENERATION TOOL USAGE 🚨

When user asks you to:
- Create a project/website/application
- Generate code files
- Build something new

YOU MUST:
1. Use the generate_code tool (if available)
2. NEVER just paste code in chat
3. Explain that you are using the tool to create files

The generate_code tool:
- Creates actual files in the project
- Makes code immediately available
- Is the CORRECT way to generate code

Only provide code in chat if:
- generate_code tool is NOT available
- User explicitly asks for code to copy/paste
- You are explaining existing code

When generate_code IS available, you MUST use it instead of pasting code.
'
WHERE id = 'personal-assistant';
```

#### Lösning C: Lägg till explicit instruktion i tool description

Uppdatera `generate_code` tool description för att vara mer explicit:

```typescript
{
  name: 'generate_code',
  description: `🚨 USE THIS TOOL WHEN USER ASKS FOR CODE/PROJECTS 🚨
  
Generate code for applications in the playground. This tool CREATES ACTUAL FILES in the project.

**CRITICAL:**
- When user asks to create a project/website/app → USE THIS TOOL
- When user asks for code files → USE THIS TOOL  
- NEVER just paste code in chat when this tool is available
- This tool is PREFERRED over providing code in chat

The tool will:
1. Create all necessary files
2. Make code immediately available in playground
3. Allow user to see/preview code instantly

Only provide code in chat if this tool is NOT available.`
}
```

---

## Rekommenderad åtgärd:

1. **Kör database fix migrationen** (för att fixa learning systemet)
2. **Kontrollera att playground context skickas** när användaren är i playground
3. **Uppdatera system prompten** för att instruera starkare om tool usage
4. **Testa** genom att be Elon skapa ett projekt och se om tool används

---

## Ytterligare debugging:

För att se om tool är tillgänglig när användaren chattar:

```typescript
// Lägg till logging i PersonalAssistantAgent.ts
logger.info('Available tools for request', {
  userId,
  hasPlaygroundContext: !!options?.playgroundContext,
  hasSelectedProject: this.selectedProjects.has(sessionId),
  toolsAvailable: tools.map(t => t.name)
});
```

Detta visar om `generate_code` tool faktiskt är tillgänglig när användaren chattar.


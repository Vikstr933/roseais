# 🔄 Code Generation System Flow

**Last Updated:** November 11, 2025  
**Purpose:** Visual documentation of the complete code generation flow

---

## 📊 Complete Flow Diagram (Mermaid)

```mermaid
flowchart TD
    Start([User Request: "Create a todo list app"]) --> API[POST /api/prompts/generate]
    
    API --> Auth{Authenticated?}
    Auth -->|No| Reject[401 Unauthorized]
    Auth -->|Yes| Validate[Validate Request Schema]
    
    Validate --> Knowledge[Load Relevant Knowledge Context]
    Knowledge --> AgentSelect[Agent Selector: Analyze Prompt]
    
    AgentSelect --> SelectAgents{Select Agents}
    SelectAgents -->|Simple| SingleAgent[Single Agent]
    SelectAgents -->|Complex| MultiAgent[Multi-Agent Orchestration]
    
    MultiAgent --> Phase0[Phase 0: Component Architect]
    Phase0 --> ArchPrompt[Build Architecture Prompt]
    ArchPrompt --> ArchAPI[Direct Anthropic API Call]
    ArchAPI --> ArchResponse[Markdown Architecture Analysis]
    ArchResponse --> Phase1[Phase 1: Component Developer]
    
    Phase1 --> DevPrompt[Build Code Generation Prompt]
    DevPrompt --> DevSystemPrompt{System Prompt Source}
    DevSystemPrompt -->|Orchestrated| AgentDB[Load from agents table<br/>component-developer]
    DevSystemPrompt -->|Legacy| PromptDB[Load from prompt_templates<br/>code_generator.code_generator]
    
    AgentDB --> DevAPI[AICodeGenerator.generateComponent]
    PromptDB --> DevAPI
    
    DevAPI --> MultiModel[MultiModelAIService]
    MultiModel --> ModelSelect{Select Model}
    ModelSelect -->|Quality| Claude[Claude Sonnet 4.5]
    ModelSelect -->|Speed| GPT4[GPT-4]
    
    Claude --> AIRequest[Anthropic API Request]
    AIRequest --> AIResponse[AI Response]
    
    AIResponse --> PreValidate{Pre-Validation}
    PreValidate -->|Has Markdown Wrapper| StripMarkdown[Strip ```json ... ```]
    PreValidate -->|No Wrapper| CheckFormat
    
    StripMarkdown --> CheckFormat{Format Check}
    CheckFormat -->|Starts with [| ValidJSON[Valid JSON Array]
    CheckFormat -->|Starts with #| RejectMarkdown[Reject: Markdown]
    CheckFormat -->|Other| RejectOther[Reject: Unknown Format]
    
    ValidJSON --> ParseJSON[Parse JSON Array]
    ParseJSON --> ExtractFiles[Extract Files Array]
    
    ExtractFiles --> SyntaxFix{Has Syntax Errors?}
    SyntaxFix -->|Yes| MultiPassFix[Multi-Pass Syntax Fixer]
    SyntaxFix -->|No| WriteFiles
    
    MultiPassFix --> FixReturn[Fix: return (; return {; return [;]
    FixReturn --> FixArray[Fix: .map(; .filter(;]
    FixArray --> FixLiteral[Fix: ;} ;) ;]]
    FixLiteral --> WriteFiles
    
    WriteFiles --> CreateWorkspace[Create Workspace Directory]
    CreateWorkspace --> WriteFile[Write Each File to Disk]
    WriteFile --> Phase2[Phase 2: Component QA]
    
    Phase2 --> QAPrompt[Build QA Prompt]
    QAPrompt --> QAAPI[Direct Anthropic API Call]
    QAAPI --> QAResponse[QA Analysis]
    
    QAResponse --> FinalResponse[Return Response]
    FinalResponse --> SSE[Send SSE Updates to Client]
    SSE --> End([Success: Files Generated])
    
    RejectMarkdown --> Error[Error Response]
    RejectOther --> Error
    Error --> EndError([Error: Generation Failed])
    
    style Start fill:#e1f5ff
    style End fill:#d4edda
    style EndError fill:#f8d7da
    style ValidJSON fill:#d4edda
    style RejectMarkdown fill:#f8d7da
    style MultiPassFix fill:#fff3cd
```

---

## 🔍 Detailed Step-by-Step Flow

### **Step 1: Request Reception**
```
User → POST /api/prompts/generate
Body: { prompt: "Create a todo list app", ... }
```

**File:** `server/routes/prompts.ts:702`

---

### **Step 2: Authentication & Validation**
```
Middleware: authenticateUser
Middleware: validateRequest(userPromptSchema)
```

**Files:**
- `server/middleware/auth.ts`
- `server/validation/schemas.ts`

---

### **Step 3: Knowledge Context Loading**
```
KnowledgeService.calculateRelevance(prompt)
→ Returns relevant knowledge items from database
```

**File:** `server/services/KnowledgeService.ts`

---

### **Step 4: Agent Selection**
```
AgentSelector.analyzePrompt(prompt)
→ Returns: { selectedAgents: ['component-architect', 'component-developer', 'component-qa'] }
```

**File:** `server/services/AgentSelector.ts`

---

### **Step 5: Phase 0 - Component Architect**

**5.1 Load Agent:**
```typescript
const analysisAgent = requiredAgents.find(a => a.id === 'component-architect')
// Loads from agents table in database
```

**5.2 Build Prompt:**
```typescript
const requirementsPrompt = `Analyze the following user request...`
// Includes: userPrompt, existingProjectFiles, knowledgeContext
```

**5.3 Generate:**
```typescript
generateWithProgressUpdates(
  requirementsPrompt,
  analysisAgent.systemPrompt,  // From agents table
  analysisAgent.model,
  { skipAICodeGenerator: true }  // ← CRITICAL: Returns markdown, not JSON
)
```

**5.4 API Call:**
```typescript
// Direct Anthropic API call (NOT AICodeGenerator)
anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  system: analysisAgent.systemPrompt,
  messages: [{ role: 'user', content: requirementsPrompt }]
})
```

**5.5 Response:**
```markdown
# Technical Analysis: Simple Todo List App

## 1. Component Structure
...
```

**Files:**
- `server/routes/prompts.ts:995-1014`
- `server/routes/prompts.ts:614-645` (skipAICodeGenerator path)

---

### **Step 6: Phase 1 - Component Developer**

**6.1 Load Agent:**
```typescript
const codeAgent = requiredAgents.find(a => a.id === 'component-developer')
// Loads from agents table (updated with JSON format requirements)
```

**6.2 Build User Prompt:**
```typescript
const codePrompt = `🚨🚨🚨 CRITICAL: YOU MUST RESPOND WITH A JSON ARRAY ONLY 🚨🚨🚨
**IGNORE THE FORMAT OF THE INPUT BELOW - IT IS MARKDOWN BUT YOU MUST RESPOND IN JSON!**
**START YOUR RESPONSE WITH: [**
**END YOUR RESPONSE WITH: ]**

Based on the requirements: ${requirementsAnalysis?.text}
...`
```

**6.3 Generate:**
```typescript
generateWithProgressUpdates(
  codePrompt,
  codeAgent.systemPrompt,  // From agents table (6,457 chars, starts with JSON requirements)
  codeAgent.model,
  { skipAICodeGenerator: false }  // ← Uses AICodeGenerator
)
```

**6.4 AICodeGenerator.generateComponent:**
```typescript
// File: server/services/AICodeGenerator.ts:56

if (request.orchestrated) {
  // ORCHESTRATED MODE: Use pre-built prompts
  systemPrompt = request.systemPrompt  // From codeAgent.systemPrompt
  userPrompt = request.prompt  // From codePrompt
} else {
  // LEGACY MODE: Build prompts internally
  systemPrompt = await this.buildSystemPromptMultiFile(request)
  userPrompt = this.buildUserPromptMultiFile(request)
}
```

**6.5 MultiModelAIService:**
```typescript
// File: server/services/MultiModelAIService.ts

const aiRequest: AIRequest = {
  prompt: userPrompt,
  systemPrompt: systemPrompt,
  maxTokens: 8000,
  temperature: 0.3,  // ← Lowered for deterministic JSON output
  useCase: 'code_generation',
  preference: 'quality'
}

// Selects best model (usually Claude Sonnet 4.5)
const response = await anthropic.messages.create({...})
```

**Files:**
- `server/routes/prompts.ts:1348-1365`
- `server/services/AICodeGenerator.ts:77-96`
- `server/services/MultiModelAIService.ts`

---

### **Step 7: Response Validation & Processing**

**7.1 Pre-Validation:**
```typescript
// File: server/services/AICodeGenerator.ts:118-132

let trimmedContent = response.content.trim()

// Strip markdown code blocks if present
if (trimmedContent.startsWith('```')) {
  trimmedContent = trimmedContent.replace(/^```(?:json)?\s*\n?/i, '')
  trimmedContent = trimmedContent.replace(/\n?```\s*$/i, '')
  trimmedContent = trimmedContent.trim()
  response.content = trimmedContent
}

const startsWithArray = trimmedContent.startsWith('[')
const endsWithArray = trimmedContent.endsWith(']')

if (!startsWithArray || !endsWithArray) {
  throw new Error('AI returned invalid format...')
}
```

**7.2 Parse JSON:**
```typescript
const parseResult = this.parseMultiFileResponse(response.content)
// Extracts: [{ path: "src/App.tsx", content: "..." }, ...]
```

**7.3 Multi-Pass Syntax Fixer:**
```typescript
// File: server/services/AICodeGenerator.ts:982-1081

// Fix common syntax errors:
// - return (; → return (
// - return {; → return {
// - return [; → return [
// - .map(; → .map(
// - ;} → }
// - ;) → )
// Runs up to 10 passes until no more fixes
```

**Files:**
- `server/services/AICodeGenerator.ts:118-176`
- `server/services/AICodeGenerator.ts:982-1081`

---

### **Step 8: File Writing**

**8.1 Create Workspace:**
```typescript
const workspaceId = Date.now().toString()
const workspaceDir = path.join(process.cwd(), 'workspaces', workspaceId)
await fs.mkdir(workspaceDir, { recursive: true })
```

**8.2 Write Files:**
```typescript
for (const file of files) {
  const filePath = path.join(workspaceDir, file.path)
  const fileDir = path.dirname(filePath)
  await fs.mkdir(fileDir, { recursive: true })
  await fs.writeFile(filePath, file.content)
}
```

**Files:**
- `server/routes/prompts.ts:664-671`

---

### **Step 9: Phase 2 - Component QA (Optional)**

**9.1 Build QA Prompt:**
```typescript
const qaPrompt = `Review the generated code: ${generatedCode.text}`
```

**9.2 Generate:**
```typescript
qaAnalysis = await generateWithProgressUpdates(
  qaPrompt,
  qaAgent.systemPrompt,
  qaAgent.model,
  { skipAICodeGenerator: true }  // Returns markdown analysis
)
```

**Files:**
- `server/routes/prompts.ts:1370-1400`

---

### **Step 10: Response & SSE Updates**

**10.1 Build Response:**
```typescript
finalResponse = {
  type: 'component',
  text: componentText,
  files: updatedFiles,
  metadata: { ... }
}
```

**10.2 Send SSE Updates:**
```typescript
sendSSEUpdate(req, 'GENERATION_COMPLETE', {
  files: updatedFiles,
  workspaceId: workspaceId
})
```

**Files:**
- `server/routes/prompts.ts:1400-1450`

---

## 🔑 Key Decision Points

### **1. Orchestrated vs Legacy Mode**
```
if (request.orchestrated) {
  // Use pre-built prompts from orchestrator
  systemPrompt = request.systemPrompt
} else {
  // Build prompts internally (database lookup)
  systemPrompt = await this.buildSystemPromptMultiFile(request)
}
```

### **2. Agent Selection**
```
AgentSelector.analyzePrompt(prompt)
→ Returns: ['component-architect', 'component-developer', 'component-qa']
```

### **3. Skip AICodeGenerator Flag**
```
if (skipAICodeGenerator) {
  // Direct API call (for architect, QA - returns markdown)
} else {
  // AICodeGenerator (for developer - expects JSON)
}
```

### **4. Pre-Validation**
```
if (startsWithArray && endsWithArray) {
  // Valid JSON → Parse
} else {
  // Invalid → Reject
}
```

---

## 📁 Key Files & Their Roles

| File | Role |
|------|------|
| `server/routes/prompts.ts` | Main orchestration logic, agent coordination |
| `server/services/AICodeGenerator.ts` | Code generation, validation, syntax fixing |
| `server/services/MultiModelAIService.ts` | Model selection, API calls |
| `server/services/AgentSelector.ts` | Analyzes prompt, selects agents |
| `server/services/PromptManager.ts` | Loads prompts from database |
| `server/services/KnowledgeService.ts` | Retrieves relevant knowledge context |
| `db/schema-pg.ts` | Database schema (agents, prompt_templates tables) |

---

## 🎯 Prompt Sources

### **Orchestrated Mode:**
1. **System Prompt:** `agents` table → `component-developer.systemPrompt`
2. **User Prompt:** Built in `server/routes/prompts.ts` → `codePrompt`

### **Legacy Mode:**
1. **System Prompt:** `prompt_templates` table → `code_generator.code_generator`
2. **User Prompt:** Built in `AICodeGenerator.buildUserPromptMultiFile()`

---

## 🛡️ Defense Layers

### **Layer 1: Database Prompts**
- JSON format requirements at top of system prompt
- Multiple reminders throughout prompt

### **Layer 2: User Prompt**
- Explicit JSON format instructions
- "IGNORE MARKDOWN INPUT" warnings

### **Layer 3: Pre-Validation**
- Checks format before parsing
- Strips markdown wrappers if present

### **Layer 4: Temperature Control**
- Lower temperature (0.3) for deterministic output

### **Layer 5: Multi-Pass Syntax Fixer**
- Fixes common syntax errors post-generation
- Up to 10 passes

---

## 📊 Response Format Evolution

### **Architect Response:**
```markdown
# Technical Analysis: Simple Todo List App

## 1. Component Structure
...
```

### **Developer Response:**
```json
[
  {
    "path": "src/App.tsx",
    "content": "import React from 'react';..."
  },
  {
    "path": "src/main.tsx",
    "content": "..."
  }
]
```

### **QA Response:**
```markdown
# Code Quality Review

## Issues Found:
...
```

---

## 🔄 Error Handling

### **Pre-Validation Errors:**
```
❌ AI returned invalid format. Expected JSON array but got: Markdown
→ Solution: Strip markdown wrappers (implemented)
```

### **Parsing Errors:**
```
❌ Failed to parse JSON
→ Solution: Multi-strategy JSON parser with fallbacks
```

### **Syntax Errors:**
```
❌ SyntaxError: Unexpected token
→ Solution: Multi-pass syntax fixer
```

---

## 🚀 Performance Optimizations

1. **Prompt Caching:** 5-minute TTL in PromptManager
2. **Rate Limiting:** Per-instance rate limiter
3. **Model Selection:** Automatic based on use case
4. **Progress Updates:** Real-time SSE updates to client

---

---

## 📊 ASCII Flowchart (Simplified)

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER REQUEST                                  │
│              "Create a todo list app"                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              POST /api/prompts/generate                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1. Authenticate User (middleware)                        │   │
│  │ 2. Validate Request Schema                               │   │
│  │ 3. Rate Limit Check                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              LOAD CONTEXT                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ • Load Relevant Knowledge (KnowledgeService)            │   │
│  │ • Load Existing Project Files (if projectId provided)  │   │
│  │ • Get Active Agents from Database                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              AGENT SELECTION                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ AgentSelector.analyzePrompt(userPrompt)                 │   │
│  │                                                          │   │
│  │ Returns:                                                │   │
│  │   selectedAgents: [                                    │   │
│  │     'component-architect',                              │   │
│  │     'component-developer',                              │   │
│  │     'component-qa'                                      │   │
│  │   ]                                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
        ┌─────────────────────────────────────┐
        │   PHASE 0: Component Architect      │
        └─────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
┌──────────────────┐          ┌──────────────────┐
│ Load Agent       │          │ Build Prompt      │
│ from agents      │          │ (includes:        │
│ table            │          │  - userPrompt    │
│                  │          │  - knowledge      │
│ systemPrompt:    │          │  - existing files│
│ (markdown        │          │ )                 │
│ analysis)        │          └──────────────────┘
└──────────────────┘                    │
                                       ▼
                         ┌──────────────────────────┐
                         │ Direct Anthropic API     │
                         │ (skipAICodeGenerator)    │
                         │                          │
                         │ Returns: Markdown        │
                         └──────────────────────────┘
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │ Architecture Analysis    │
                         │ (Markdown format)        │
                         └──────────────────────────┘
                                       │
                                       ▼
        ┌─────────────────────────────────────┐
        │   PHASE 1: Component Developer      │
        └─────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
┌──────────────────┐          ┌──────────────────┐
│ Load Agent       │          │ Build Prompt      │
│ from agents      │          │ (includes:        │
│ table            │          │  - requirements  │
│                  │          │  - JSON format    │
│ systemPrompt:    │          │    requirements  │
│ (JSON format     │          │  - file structure│
│ requirements)    │          │ )                 │
└──────────────────┘          └──────────────────┘
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │ AICodeGenerator          │
                         │ .generateComponent()     │
                         └──────────────────────────┘
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │ MultiModelAIService      │
                         │                          │
                         │ • Select Model           │
                         │   (Claude Sonnet 4.5)    │
                         │ • Temperature: 0.3      │
                         │ • Call Anthropic API     │
                         └──────────────────────────┘
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │ AI Response               │
                         │ (May be wrapped in        │
                         │  markdown code blocks)    │
                         └──────────────────────────┘
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │ PRE-VALIDATION            │
                         │                          │
                         │ 1. Strip markdown        │
                         │    wrappers if present   │
                         │ 2. Check starts with [   │
                         │ 3. Check ends with ]     │
                         │ 4. Reject if invalid     │
                         └──────────────────────────┘
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │ PARSE JSON                │
                         │                          │
                         │ Extract files array:     │
                         │ [                         │
                         │   {path: "...",           │
                         │    content: "..."},       │
                         │   ...                     │
                         │ ]                         │
                         └──────────────────────────┘
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │ MULTI-PASS SYNTAX FIXER  │
                         │                          │
                         │ Fix patterns:            │
                         │ • return (; → return (   │
                         │ • return {; → return {    │
                         │ • .map(; → .map(         │
                         │ • ;} → }                 │
                         │                          │
                         │ Up to 10 passes          │
                         └──────────────────────────┘
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │ CREATE WORKSPACE         │
                         │                          │
                         │ workspaces/{timestamp}/  │
                         └──────────────────────────┘
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │ WRITE FILES              │
                         │                          │
                         │ For each file:           │
                         │ • Create directory       │
                         │ • Write file content     │
                         └──────────────────────────┘
                                       │
                                       ▼
        ┌─────────────────────────────────────┐
        │   PHASE 2: Component QA (Optional)   │
        └─────────────────────────────────────┘
                         │
                         ▼
                         ┌──────────────────────────┐
                         │ QA Analysis              │
                         │ (Markdown format)        │
                         └──────────────────────────┘
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │ RETURN RESPONSE          │
                         │                          │
                         │ {                         │
                         │   type: 'component',      │
                         │   files: [...],           │
                         │   text: "...",             │
                         │   workspaceId: "..."      │
                         │ }                         │
                         └──────────────────────────┘
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │ SEND SSE UPDATES         │
                         │                          │
                         │ • GENERATION_COMPLETE    │
                         │ • File list              │
                         │ • Workspace ID           │
                         └──────────────────────────┘
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │ ✅ SUCCESS               │
                         │                          │
                         │ Files generated and      │
                         │ written to workspace     │
                         └──────────────────────────┘
```

---

## 🔑 Key Decision Points

### **Decision 1: Orchestrated vs Legacy Mode**
```
Is request.orchestrated === true?
├─ YES → Use pre-built prompts from orchestrator
│         systemPrompt = request.systemPrompt (from agents table)
│         userPrompt = request.prompt (from orchestrator)
│
└─ NO  → Build prompts internally
          systemPrompt = await buildSystemPromptMultiFile()
          userPrompt = buildUserPromptMultiFile()
```

### **Decision 2: Skip AICodeGenerator?**
```
Is skipAICodeGenerator === true?
├─ YES → Direct Anthropic API call
│         (For architect, QA - returns markdown)
│
└─ NO  → Use AICodeGenerator
          (For developer - expects JSON)
```

### **Decision 3: Response Format Validation**
```
Does response start with ```?
├─ YES → Strip markdown wrapper
│         Remove ```json and closing ```
│
└─ NO  → Continue validation

Does cleaned response start with [ and end with ]?
├─ YES → Valid JSON → Parse
│
└─ NO  → Reject with error
```

### **Decision 4: Syntax Errors?**
```
After parsing, check for syntax errors:
├─ Has errors? → Run Multi-Pass Syntax Fixer
│                (Up to 10 passes)
│
└─ No errors? → Write files directly
```

---

## 📊 Data Flow

```
User Input
    │
    ├─→ Knowledge Context (from database)
    │
    ├─→ Agent Selection (AgentSelector)
    │
    ├─→ Phase 0: Architect
    │   │
    │   ├─→ System Prompt (agents table)
    │   ├─→ User Prompt (built in orchestrator)
    │   ├─→ Direct API Call
    │   └─→ Markdown Response
    │
    ├─→ Phase 1: Developer
    │   │
    │   ├─→ System Prompt (agents table, 6,457 chars)
    │   │   └─→ Starts with JSON format requirements
    │   │
    │   ├─→ User Prompt (built in orchestrator)
    │   │   └─→ Includes architect's analysis
    │   │   └─→ Explicit JSON format instructions
    │   │
    │   ├─→ AICodeGenerator.generateComponent()
    │   │   ├─→ MultiModelAIService
    │   │   │   └─→ Anthropic API (Claude Sonnet 4.5)
    │   │   │
    │   │   ├─→ Pre-Validation
    │   │   │   ├─→ Strip markdown wrappers
    │   │   │   └─→ Validate JSON format
    │   │   │
    │   │   ├─→ Parse JSON
    │   │   │   └─→ Extract files array
    │   │   │
    │   │   └─→ Multi-Pass Syntax Fixer
    │   │       └─→ Fix common errors
    │   │
    │   └─→ JSON Response (files array)
    │
    ├─→ Phase 2: QA (optional)
    │   │
    │   ├─→ System Prompt (agents table)
    │   ├─→ User Prompt (includes generated code)
    │   ├─→ Direct API Call
    │   └─→ Markdown Response
    │
    └─→ Final Response
        ├─→ Files written to workspace
        ├─→ SSE updates sent
        └─→ Success response
```

---

**Status:** ✅ **COMPLETE**  
**Last Updated:** November 11, 2025


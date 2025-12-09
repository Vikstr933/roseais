# 📊 Multi-Agent Architecture Diagrams

Visual representations of current vs. target architecture.

---

## Current System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                │
│              (Enters prompt in chat interface)              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  PromptPlayground.tsx                        │
│  ┌───────────────┐  ┌────────────┐  ┌──────────────────┐  │
│  │  Chat Panel   │  │  Editor    │  │  Preview         │  │
│  │  (Input)      │  │  (Monaco)  │  │  (WebContainer)  │  │
│  └───────────────┘  └────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓ POST /api/prompts/generate
┌─────────────────────────────────────────────────────────────┐
│                    Express Server                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │            OrchestrationAgent.ts                      │  │
│  │  (Coordinates sequential agent execution)             │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│              ┌───────────────┼───────────────┐              │
│              ↓               ↓               ↓              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ UIDesigner   │  │ CodeGenerator│  │ Completion   │     │
│  │ Agent        │  │ Agent        │  │ Agent        │     │
│  │ (Placeholder)│  │ (Implemented)│  │ (Placeholder)│     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         ⚠️                  ✅                 ⚠️            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              CodeGeneratorAgent.ts                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         AICodeGenerator.ts                            │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │     Anthropic Claude 3.5 Sonnet                 │  │  │
│  │  │  (Multi-file JSON generation)                   │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     Generated Files                          │
│  [src/App.tsx, src/components/*, src/types/*, ...]         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓ SSE Events
┌─────────────────────────────────────────────────────────────┐
│               Frontend (Real-time Updates)                   │
│  • Files appear in Editor                                   │
│  • Preview updates in iframe                                │
│  • Process tab shows agent progress                         │
└─────────────────────────────────────────────────────────────┘

⏱️  Total Time: 30-40 seconds (sequential)
🤖 Active Agents: 1 (CodeGeneratorAgent)
📦 Output: 5-10 files
```

---

## Target System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                │
│        (Enters prompt: "Build a recipe manager")            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              EnhancedOrchestrationAgent.ts                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  STEP 1: Analyze Complexity                           │  │
│  │  • Detect features (CRUD, search, auth, etc.)         │  │
│  │  • Estimate component count                           │  │
│  │  • Determine backend needs                            │  │
│  │  → Result: complexity = "medium", 8 components        │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  STEP 2: Select Agents (Dynamic)                      │  │
│  │  • Select 12 agents based on complexity               │  │
│  │  • Frontend: 6 agents                                 │  │
│  │  • Backend: 3 agents (detected need)                  │  │
│  │  • Quality: 3 agents                                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  STEP 3: Create Execution Plan (DAG)                  │  │
│  │                                                        │  │
│  │  Phase 1 (Parallel):                                  │  │
│  │    • RequirementsAgent                                │  │
│  │    • UIDesignerAgent                                  │  │
│  │                                                        │  │
│  │  Phase 2 (Parallel, depends on Phase 1):              │  │
│  │    • ComponentArchitectAgent                          │  │
│  │    • APIDesignerAgent                                 │  │
│  │    • DatabaseArchitectAgent                           │  │
│  │                                                        │  │
│  │  Phase 3 (Parallel, depends on Phase 2):              │  │
│  │    • ComponentGeneratorAgent (x3)                     │  │
│  │    • StyleGeneratorAgent                              │  │
│  │    • BackendGeneratorAgent                            │  │
│  │                                                        │  │
│  │  Phase 4 (Parallel, depends on Phase 3):              │  │
│  │    • TypeCheckAgent                                   │  │
│  │    • SecurityAgent                                    │  │
│  │    • TestGeneratorAgent                               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Execute Parallel (with SharedMemory)               │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Phase 1: Analysis (2 agents, 8 seconds)               │ │
│  │ ┌────────────────┐    ┌────────────────┐             │ │
│  │ │ Requirements   │    │ UI Designer    │             │ │
│  │ │ Agent          │    │ Agent          │             │ │
│  │ └────────────────┘    └────────────────┘             │ │
│  │         │                      │                       │ │
│  │         ↓                      ↓                       │ │
│  │   SharedMemory                                         │ │
│  │   ├─ features: [CRUD, search, categories]             │ │
│  │   ├─ colors: { primary: '#3b82f6', ... }              │ │
│  │   └─ layout: { sidebar: true, header: true }          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Phase 2: Architecture (3 agents, 3 seconds)           │ │
│  │ ┌──────────┐  ┌──────────┐  ┌──────────┐            │ │
│  │ │Component │  │   API    │  │ Database │            │ │
│  │ │Architect │  │ Designer │  │Architect │            │ │
│  │ └──────────┘  └──────────┘  └──────────┘            │ │
│  │      │              │              │                  │ │
│  │      ↓              ↓              ↓                  │ │
│  │ SharedMemory                                          │ │
│  │ ├─ componentTree: { Header, RecipeForm, ... }        │ │
│  │ ├─ apiEndpoints: [GET /recipes, POST /recipes, ...]  │ │
│  │ └─ dbSchema: { recipes, categories, ... }            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Phase 3: Code Generation (5 agents, 5 seconds)        │ │
│  │ ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐              │ │
│  │ │Comp│  │Comp│  │Comp│  │Style│  │Back│              │ │
│  │ │Gen │  │Gen │  │Gen │  │Gen  │  │end │              │ │
│  │ │ 1  │  │ 2  │  │ 3  │  │     │  │Gen │              │ │
│  │ └────┘  └────┘  └────┘  └────┘  └────┘              │ │
│  │    │       │       │       │       │                  │ │
│  │    ↓       ↓       ↓       ↓       ↓                  │ │
│  │ [App.tsx] [RecipeForm] [RecipeList] [styles] [API]   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Phase 4: Quality Assurance (3 agents, 2 seconds)      │ │
│  │ ┌──────────┐  ┌──────────┐  ┌──────────┐            │ │
│  │ │TypeCheck │  │ Security │  │   Test   │            │ │
│  │ │  Agent   │  │  Agent   │  │   Gen    │            │ │
│  │ └──────────┘  └──────────┘  └──────────┘            │ │
│  │      │              │              │                  │ │
│  │      ↓              ↓              ↓                  │ │
│  │ [Fix TS errors] [No vulns] [Add tests]               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: Integration & Validation                           │
│  • Merge all generated files                                │
│  • Validate completeness (all imports exist)                │
│  • Check quality metrics (TypeScript errors, tests, etc.)   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 6: Self-Correction (if needed)                        │
│  • Retry failed agents (up to 3 times)                      │
│  • Fix validation errors                                    │
│  • Request user clarification if stuck                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  Production-Ready App                        │
│  Frontend:                                                   │
│  • src/App.tsx                                              │
│  • src/components/Header.tsx                                │
│  • src/components/RecipeForm.tsx                            │
│  • src/components/RecipeList.tsx                            │
│  • src/components/CategoryFilter.tsx                        │
│  • src/types/index.ts                                       │
│  • src/utils/helpers.ts                                     │
│  • src/hooks/useRecipes.ts                                  │
│  • src/index.css (Tailwind)                                 │
│                                                              │
│  Backend:                                                    │
│  • server/routes/recipes.ts                                 │
│  • server/db/schema.ts                                      │
│  • server/middleware/validation.ts                          │
│                                                              │
│  Tests:                                                      │
│  • tests/RecipeForm.test.tsx                                │
│  • tests/RecipeList.test.tsx                                │
│                                                              │
│  Config:                                                     │
│  • package.json (with all dependencies)                     │
│  • tsconfig.json                                            │
│  • vite.config.ts                                           │
│  • README.md                                                │
└─────────────────────────────────────────────────────────────┘

⏱️  Total Time: 18 seconds (parallel)
🤖 Active Agents: 12 (peak 5 concurrent)
📦 Output: 15-20 files (frontend + backend)
✅ Quality: 95% deployable without fixes
```

---

## Agent Dependency Graph (DAG)

```
Legend:
  [Agent] → depends on
  {Agent} ← provides data to

Phase 1: Analysis
┌─────────────────┐      ┌─────────────────┐
│ Requirements    │      │  UI Designer    │
│     Agent       │      │     Agent       │
└────────┬────────┘      └────────┬────────┘
         │                        │
         │                        │
         ↓                        ↓
    SharedMemory.set('features')  SharedMemory.set('design')
         │                        │
         └────────┬───────────────┘
                  ↓

Phase 2: Architecture (depends on Phase 1)
         ┌────────────────────────┐
         │                        │
    ┌────↓─────┐  ┌────↓─────┐  ┌────↓─────┐
    │Component │  │   API    │  │ Database │
    │Architect │  │ Designer │  │Architect │
    └────┬─────┘  └────┬─────┘  └────┬─────┘
         │             │             │
         ↓             ↓             ↓
    SM.set('arch') SM.set('api') SM.set('db')
         │             │             │
         └─────────────┴─────────────┘
                       ↓

Phase 3: Code Generation (depends on Phase 2)
         ┌─────────────────────────────────┐
         │                                 │
    ┌────↓────┐ ┌────↓────┐ ┌────↓────┐ ┌────↓────┐ ┌────↓────┐
    │CompGen  │ │CompGen  │ │CompGen  │ │ Style   │ │Backend  │
    │  #1     │ │  #2     │ │  #3     │ │   Gen   │ │   Gen   │
    └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
         │           │           │           │           │
         └───────────┴───────────┴───────────┴───────────┘
                                 ↓
                            [Files Generated]
                                 ↓

Phase 4: Quality (depends on Phase 3)
         ┌───────────────────────────────┐
         │                               │
    ┌────↓────┐  ┌────↓────┐  ┌────↓────┐
    │TypeCheck│  │ Security│  │  Test   │
    │  Agent  │  │  Agent  │  │  Gen    │
    └────┬────┘  └────┬────┘  └────┬────┘
         │            │            │
         └────────────┴────────────┘
                      ↓
                [Validated App]
```

---

## Execution Timeline Comparison

### BEFORE (Sequential)
```
0s    10s   20s   30s   40s
│─────│─────│─────│─────│
│ Requirements Analysis  │
      │ UI Design        │
            │ Code Gen          │
                  │ Completion   │
                        │ ✅ Done

Total: 40 seconds
Parallel Efficiency: 25% (only 1 agent active at a time)
```

### AFTER (Parallel)
```
0s    5s    10s   15s   20s
│─────│─────│─────│─────│
│ P1: Req + UI Design   │
      │ P2: Arch (x3)   │
            │ P3: Gen (x5) │
                  │ P4: QA  │
                        │ ✅ Done

Total: 18 seconds
Parallel Efficiency: 75% (5-10 agents active at once)
Speedup: 2.2x faster

With more optimization:
0s    10s   20s
│─────│─────│
│ All phases optimized │
      │           │ ✅ Done

Total: 10-12 seconds
Parallel Efficiency: 90%
Speedup: 4x faster
```

---

## Data Flow: Shared Memory

```
┌─────────────────────────────────────────────────────────┐
│               Shared Memory System                       │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Key-Value Store (Map<string, any>)                │ │
│  ├────────────────────────────────────────────────────┤ │
│  │  features: {                                       │ │
│  │    type: 'CRUD',                                   │ │
│  │    entities: ['Recipe', 'Category'],               │ │
│  │    authentication: true,                           │ │
│  │    search: true                                    │ │
│  │  }                                                 │ │
│  ├────────────────────────────────────────────────────┤ │
│  │  design: {                                         │ │
│  │    layout: 'sidebar',                              │ │
│  │    colors: { primary: '#3b82f6', ... },            │ │
│  │    components: ['Header', 'Sidebar', 'Content']    │ │
│  │  }                                                 │ │
│  ├────────────────────────────────────────────────────┤ │
│  │  componentTree: {                                  │ │
│  │    App: {                                          │ │
│  │      children: ['Header', 'RecipeForm', 'List'],   │ │
│  │      state: ['recipes', 'selectedCategory']        │ │
│  │    }                                               │ │
│  │  }                                                 │ │
│  ├────────────────────────────────────────────────────┤ │
│  │  apiEndpoints: [                                   │ │
│  │    { method: 'GET', path: '/recipes', ... },       │ │
│  │    { method: 'POST', path: '/recipes', ... }       │ │
│  │  ]                                                 │ │
│  ├────────────────────────────────────────────────────┤ │
│  │  databaseSchema: {                                 │ │
│  │    tables: ['recipes', 'categories'],              │ │
│  │    relations: { recipes: 'categories' }            │ │
│  │  }                                                 │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Access Control:                                        │
│  • Agents can read all keys                             │
│  • Agents can write to their own keys                   │
│  • OrchestratorAgent can write to any key               │
│  • Locks prevent race conditions                        │
└─────────────────────────────────────────────────────────┘
```

---

## Frontend Integration: Process Tab

```
┌─────────────────────────────────────────────────────────────┐
│  Process Tab (Real-time Agent Progress)                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Overall Progress: ████████████░░░░░░░░ 60%                 │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📋 Requirements Agent                          ✅       │ │
│  │ Breaking down your idea into specifications            │ │
│  │ └─ Completed in 8.2s                                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🎨 UI Designer Agent                           ✅       │ │
│  │ Crafting a beautiful interface                         │ │
│  │ └─ Completed in 7.9s                                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🏗️ Component Architect Agent                  🔄       │ │
│  │ Designing component hierarchy                          │ │
│  │ └─ In progress... (3.1s elapsed)                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ⚡ Code Generator Agent #1                    ⏳       │ │
│  │ Waiting for dependencies...                            │ │
│  │ └─ Depends on: Component Architect                     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [5 more agents pending...]                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Legend:
  ✅ = Completed
  🔄 = In Progress
  ⏳ = Pending
  ❌ = Failed
```

---

## File Structure Output Comparison

### BEFORE (Basic Multi-File)
```
generated-app/
├── src/
│   ├── App.tsx                 (200 lines)
│   ├── components/
│   │   └── RecipeForm.tsx      (150 lines)
│   └── types/
│       └── index.ts            (30 lines)
├── package.json                (generated)
└── tsconfig.json               (generated)

Total: 5 files, ~400 LOC
Issues:
  ⚠️ Missing tests
  ⚠️ No backend
  ⚠️ No documentation
  ⚠️ TypeScript errors (20+)
  ⚠️ No validation
```

### AFTER (Production-Ready)
```
generated-app/
├── client/
│   ├── src/
│   │   ├── App.tsx                          (150 lines, ✅)
│   │   ├── components/
│   │   │   ├── Header.tsx                   (80 lines, ✅)
│   │   │   ├── RecipeForm.tsx               (120 lines, ✅)
│   │   │   ├── RecipeList.tsx               (100 lines, ✅)
│   │   │   ├── RecipeCard.tsx               (60 lines, ✅)
│   │   │   └── CategoryFilter.tsx           (70 lines, ✅)
│   │   ├── hooks/
│   │   │   ├── useRecipes.ts                (50 lines, ✅)
│   │   │   └── useCategories.ts             (40 lines, ✅)
│   │   ├── contexts/
│   │   │   └── RecipeContext.tsx            (80 lines, ✅)
│   │   ├── types/
│   │   │   └── index.ts                     (60 lines, ✅)
│   │   ├── utils/
│   │   │   └── helpers.ts                   (40 lines, ✅)
│   │   ├── index.css                        (200 lines, ✅)
│   │   └── main.tsx                         (20 lines, ✅)
│   ├── tests/
│   │   ├── RecipeForm.test.tsx              (100 lines, ✅)
│   │   └── RecipeList.test.tsx              (80 lines, ✅)
│   ├── package.json                         (✅ deps correct)
│   ├── tsconfig.json                        (✅)
│   ├── vite.config.ts                       (✅)
│   └── README.md                            (✅ docs)
│
├── server/
│   ├── routes/
│   │   └── recipes.ts                       (150 lines, ✅)
│   ├── db/
│   │   └── schema.ts                        (80 lines, ✅)
│   ├── middleware/
│   │   └── validation.ts                    (60 lines, ✅)
│   ├── index.ts                             (100 lines, ✅)
│   └── package.json                         (✅)
│
└── docker-compose.yml                       (✅)

Total: 25 files, ~1,800 LOC
Quality:
  ✅ All tests passing
  ✅ TypeScript: 0 errors
  ✅ ESLint: 0 warnings
  ✅ Security: No vulnerabilities
  ✅ Accessibility: WCAG AA compliant
  ✅ Documentation: Complete
  ✅ Deployable: One-click deploy
```

---

## Agent Communication Patterns

### Pattern 1: Sequential Dependencies
```
RequirementsAgent
       ↓ (provides features list)
ComponentArchitectAgent
       ↓ (provides component tree)
ComponentGeneratorAgent
       ↓ (provides generated code)
TypeCheckAgent
```

### Pattern 2: Parallel Independence
```
                ┌─→ StyleGeneratorAgent
UIDesignerAgent ├─→ ColorPaletteAgent
                └─→ LayoutAgent
```

### Pattern 3: Fan-out / Fan-in
```
ComponentArchitectAgent
       ├─→ ComponentGeneratorAgent #1 (Header)
       ├─→ ComponentGeneratorAgent #2 (Form)
       ├─→ ComponentGeneratorAgent #3 (List)
       └─→ ComponentGeneratorAgent #4 (Card)
              ↓ ↓ ↓ ↓
         IntegrationAgent (merge all)
```

### Pattern 4: Feedback Loop
```
CodeGeneratorAgent
       ↓
TypeCheckAgent (finds 5 errors)
       ↓
RefactoringAgent (fixes errors)
       ↓
TypeCheckAgent (re-check → 0 errors)
       ↓
✅ Done
```

---

## Tech Stack Visualization

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND                                 │
├─────────────────────────────────────────────────────────────┤
│  React 18.3.1 + TypeScript 5.7.2                            │
│  Vite 7.1.7 (build tool)                                    │
│  TanStack React Query 5.60.5 (server state)                 │
│  Wouter 3.3.5 (routing)                                     │
│  Framer Motion 11.13.1 (animations)                         │
│  Monaco Editor (code editor)                                │
│  WebContainer API (browser-based preview)                   │
│  Tailwind CSS + shadcn/ui (UI components)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND                                  │
├─────────────────────────────────────────────────────────────┤
│  Node.js + Express 4.21.2 + TypeScript                      │
│  Anthropic Claude 3.5 Sonnet (AI)                           │
│  Drizzle ORM 0.44.6 (database)                              │
│  Upstash Redis (caching + rate limiting)                    │
│  Stripe 19.1.0 (payments)                                   │
│  Sentry (error tracking)                                    │
│  WebSocket (real-time updates)                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   DATABASE                                   │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL (Supabase/Neon)                                 │
│  • 25+ tables                                               │
│  • Row Level Security (RLS)                                 │
│  • Connection pooling                                       │
│  • Automatic migrations                                     │
│                                                              │
│  Fallback: SQLite (development)                             │
└─────────────────────────────────────────────────────────────┘
```

---

**These diagrams provide a visual reference for understanding the transformation from a basic sequential system to an advanced parallel multi-agent orchestration platform.**

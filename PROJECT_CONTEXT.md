# AI Library – Project Context

## What This Platform Does
- Full-stack AI development environment that lets users describe an app in natural language and receive a complete React/Vite codebase orchestrated by multiple specialized AI agents.
- Ships with real-time collaboration (shared workspaces, chat, session history), Monaco editing, component preview, project sharing/deployment, and an auxiliary assistant (“Elon”) for research/tasks outside the playground.

## High-Level Architecture
- **Frontend (`client/`)**: React 18 + TypeScript + Vite with Tailwind/Radix UI, TanStack Query, Monaco editor, Framer Motion animations.
- **Backend (`server/`)**: Express (Node 20) with REST + SSE endpoints, Passport auth, WebSocket hooks, and Drizzle ORM for PostgreSQL.
- **Database (`db/`)**: PostgreSQL (Supabase/Neon targeted) managed via Drizzle + raw SQL migrations; stores users, workspaces, agent definitions, sessions, chat, etc.
- **AI + Tooling**: Anthropic Claude (primary) and OpenAI as fallbacks, prompt orchestration layer, WebContainer-based dev server for instant previews, plus Deployment + Plugin services.

## Key Frontend Areas
- `src/pages/PromptPlayground.tsx`: Main IDE-like experience (Chap-ZPT chat, editor, preview, sessions, settings, dev-server controls).
- `src/components/ComponentLibrary`, `EnhancedFileExplorer`, `ProjectSharing`, `ProductionDeployment`: Compose the workspace toolset.
- `src/components/OmniAssistant/OmniAssistant.tsx`: “Elon” assistant with memory, plugin hooks, and the ability to forward prompts/code to the playground.
- `src/pages/AgentManager.tsx`: CRUD UI for AI agents with filtering, generation, and plugin toggles.
- Contexts/hooks (`contexts/WorkspaceContext`, `contexts/AuthContext`, `hooks/useProjectManagement`, etc.) keep sessions, auth, and project metadata in sync across tabs.

## Key Backend Areas
- `server/index.ts`: Express bootstrap (security, logging, SSE, router mounting, COOP/COEP headers for WebContainer support).
- `server/routes/agents.ts`: Agent CRUD + generation endpoints, including validation middleware.
- `server/routes/workspaces.ts`, `server/routes/components.ts`, `server/routes/omniassistant.ts`: Handle project persistence, component generation, OmniAssistant messaging, etc.
- `server/services/WebContainerService` (frontend) & `services/PromptManager`, `DeploymentService`: glue between AI orchestration, preview deployment, and external integrations.

## Development Workflow
1. **Install deps**: `npm install`
2. **Environment**: copy `env.example` → `.env`; set `DATABASE_URL` (Postgres) plus AI keys, session secrets, optional Stripe/Vercel tokens.
3. **Database**: `npm run db:push` (Drizzle) or apply SQL migrations in `migrations/`.
4. **Start dev servers**: `npm run dev` (runs Vite + Express concurrently on ports 5173/3001 via Vite proxy).
5. **Testing/Lint**: `npm run test`, `npm run lint`, `npm run check`.

## Notable Behaviors
- WebContainer preview only works in browsers with SharedArrayBuffer (COOP/COEP headers are set server-side); otherwise deployment falls back to server-managed preview links.
- Workspace data (files/chat/pending prompts) persists via `WorkspaceContext` and is synced back to the backend for collaboration.
- Agent definitions are multi-tenant: system agents (visible to all) plus user-defined agents filtered in `/api/agents`.

## Reference Docs in Repo
- `README.md`: Comprehensive overview + feature list.
- `DATABASE.md`, `ENV_SETUP_GUIDE.md`, `DEPLOYMENT_GUIDE.md`: Setup details.
- Numerous audit/fix summaries (`COMPREHENSIVE_SYSTEM_AUDIT_REPORT.md`, etc.) capture previous investigations and can be used for historical context.

Use this file as the quick entry point for new contributors before diving into the deeper documentation set.


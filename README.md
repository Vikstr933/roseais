# AI Library - Intelligent Development Platform

> A comprehensive full-stack AI development platform featuring multi-agent orchestration, real-time collaboration, and intelligent code generation powered by Claude and GPT-4.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646cff.svg)](https://vitejs.dev/)

## Overview

**AI Library** is a production-ready AI development platform that enables users to generate complete React applications through intelligent multi-agent orchestration. The platform combines the power of Claude and GPT-4 with a sophisticated agent coordination system, comprehensive knowledge base, and real-time collaboration features.

### What Makes It Unique

- **Multi-Agent Orchestration**: Specialized AI agents work together to handle complex development tasks
- **Intelligent Knowledge Base**: Dynamic integration of AI company documentation, frameworks, and best practices
- **Real-Time Collaboration**: WebSocket-based multi-user workspaces with live updates
- **One-Click Deployment**: Seamless integration with GitHub and Vercel
- **Production Monitoring**: Built-in Sentry integration and comprehensive logging
- **Cost Optimization**: Multi-model support with intelligent fallback strategies

## Key Features

### 1. AI-Powered Code Generation

- Generate complete React applications from natural language prompts
- Multi-file project structures with TypeScript support
- Automatic dependency management and configuration
- Tailwind CSS styling with responsive design patterns
- Interactive components with hooks and state management
- LocalStorage persistence and error handling

### 2. Multi-Agent Orchestration System

Eight specialized AI agents work together to deliver high-quality code:

- **OrchestrationAgent**: Master coordinator managing workflows and dependencies
- **RequirementsAgent**: Analyzes prompts and extracts feature requirements
- **ComponentArchitectAgent**: Plans component structure and file organization
- **UIDesignerAgent**: Designs UI layouts and responsive patterns
- **StyleGeneratorAgent**: Creates Tailwind CSS themes and animations
- **CodeGeneratorAgent**: Writes production-ready React/TypeScript code
- **CompletionAgent**: Validates code quality and ensures best practices

### 3. Comprehensive Knowledge Base

- **14 AI Companies**: OpenAI, Anthropic, Google, Hugging Face, Cohere, and more
- **8 Development Frameworks**: React, Vue, Angular, FastAPI, NestJS, Django, etc.
- **6 Workspace Templates**: ML Development, API Integration, Data Dashboards, etc.
- **50+ AI Models**: Detailed capabilities, parameters, and use cases
- **Automatic Relevance Detection**: Smart knowledge injection based on prompt analysis

### 4. Real-Time Collaboration

- Multi-user workspaces with WebSocket synchronization
- Live file editing and change broadcasting
- Real-time chat messaging
- User activity tracking and cursor positions
- Shared project state management

### 5. Production Deployment

- **GitHub Integration**: Automatic repository creation and push
- **Vercel Deployment**: One-click production hosting
- **WebContainer**: Browser-based preview and execution
- **Dev Servers**: Local Vite development servers
- **Storage Options**: Cloudflare R2 and AWS S3 support

### 6. User Management & Monetization

- **Authentication**: Email/password, OAuth (GitHub, Google), JWT tokens
- **Role-Based Access**: User, Admin, Superadmin levels
- **Subscription Tiers**:
  - Free: 100K tokens/month
  - Pro: 1M tokens/month
  - Team: 3M tokens/month
  - Enterprise: Unlimited
- **Stripe Integration**: Payment processing and subscription management
- **Usage Tracking**: Token consumption and cost analytics

### 7. Developer Experience

- **Monaco Editor**: VS Code-like editing experience
- **Live Preview**: Instant component rendering
- **File Explorer**: Hierarchical project navigation with animations
- **Agent Monitor**: Real-time agent activity visualization
- **Session History**: Track and replay previous generations
- **System Logs**: Comprehensive logging dashboard

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  (Vite Dev Server - Port 5173)                          │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Prompt   │  │  Monaco  │  │ Preview  │             │
│  │ Editor   │  │  Editor  │  │ Window   │             │
│  └──────────┘  └──────────┘  └──────────┘             │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │  Agent   │  │   File   │  │ Session  │             │
│  │ Monitor  │  │ Explorer │  │ History  │             │
│  └──────────┘  └──────────┘  └──────────┘             │
└─────────────────────────────────────────────────────────┘
                        ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────┐
│                   Express Backend                        │
│  (Node.js Server - Port 3001)                           │
│                                                          │
│  ┌────────────────────────────────────────────┐        │
│  │         Orchestration Layer                 │        │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐ │        │
│  │  │Orchestr- │  │ Shared   │  │Execution │ │        │
│  │  │ation     │  │ Memory   │  │  Graph   │ │        │
│  │  │Agent     │  │          │  │          │ │        │
│  │  └──────────┘  └──────────┘  └──────────┘ │        │
│  └────────────────────────────────────────────┘        │
│                                                          │
│  ┌────────────────────────────────────────────┐        │
│  │         Specialized Agents                  │        │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │        │
│  │  │ Req  │ │  UI  │ │Style │ │ Code │      │        │
│  │  │Agent │ │Agent │ │Agent │ │Agent │      │        │
│  │  └──────┘ └──────┘ └──────┘ └──────┘      │        │
│  └────────────────────────────────────────────┘        │
│                                                          │
│  ┌────────────────────────────────────────────┐        │
│  │            Core Services                    │        │
│  │  • Knowledge Service  • AI Generator        │        │
│  │  • WebSocket Service  • Deployment Service  │        │
│  │  • Rate Limiter       • Performance Monitor │        │
│  └────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
                        ↕ PostgreSQL Driver
┌─────────────────────────────────────────────────────────┐
│              PostgreSQL Database                         │
│  • Users & Auth      • Workspaces & Projects            │
│  • Agents & Config   • Sessions & History               │
│  • Knowledge Base    • Usage & Billing                  │
└─────────────────────────────────────────────────────────┘
```

### Multi-Agent Coordination Flow

```
                        User Prompt
                             ↓
                    ┌────────────────┐
                    │ Orchestration  │
                    │     Agent      │
                    └────────────────┘
                             ↓
        ┌────────────────────┼────────────────────┐
        ↓                    ↓                     ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Requirements │    │   Component  │    │      UI      │
│    Agent     │    │  Architect   │    │   Designer   │
└──────────────┘    └──────────────┘    └──────────────┘
        ↓                    ↓                     ↓
        └────────────────────┼────────────────────┘
                             ↓
                    ┌────────────────┐
                    │     Shared     │
                    │     Memory     │
                    └────────────────┘
                             ↓
        ┌────────────────────┼────────────────────┐
        ↓                    ↓                     ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    Style     │    │     Code     │    │  Completion  │
│  Generator   │    │  Generator   │    │    Agent     │
└──────────────┘    └──────────────┘    └──────────────┘
        ↓                    ↓                     ↓
        └────────────────────┼────────────────────┘
                             ↓
                    Generated Components
```

## Technology Stack

### Frontend

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 7
- **UI Library**: Radix UI (30+ components)
- **Styling**: Tailwind CSS 3.4 + Tailwind Typography
- **State Management**: TanStack Query (React Query) 5.60
- **Forms**: React Hook Form + Zod validation
- **Editor**: Monaco Editor (VS Code-like experience)
- **Routing**: Wouter 3 (lightweight router)
- **Animations**: Framer Motion 11
- **Icons**: Lucide React
- **Charts**: Recharts 2

### Backend

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js 4.21
- **Database**: PostgreSQL (Supabase/Neon) - See [DATABASE.md](./DATABASE.md)
- **ORM**: Drizzle ORM 0.44
- **Authentication**: Passport.js + Express Session
- **Real-time**: WebSocket (ws 8.18)
- **Validation**: Zod 3.25
- **Monitoring**: Sentry v10.17
- **File Operations**: Archiver, execa
- **Rate Limiting**: rate-limiter-flexible

### AI Services

- **Primary AI**: Anthropic Claude (3.5 Sonnet, 4.5)
- **Alternative**: OpenAI GPT-4o
- **Multi-Model Support**: Flexible provider abstraction
- **Cost Optimization**: Intelligent model selection

### Infrastructure

- **Database**: PostgreSQL (Supabase/Neon)
- **Storage**: Cloudflare R2, AWS S3
- **Deployment**: Vercel, GitHub
- **Monitoring**: Sentry
- **Payments**: Stripe

## Getting Started

### Prerequisites

- Node.js 20 or higher
- **PostgreSQL 16 or higher** (NOT SQLite, NOT MySQL)
- npm or yarn
- Git

**Database Note**: This project uses PostgreSQL exclusively. See [DATABASE.md](./DATABASE.md) for detailed setup instructions.

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd newai
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/ai_library"

# AI Services
ANTHROPIC_API_KEY="your_anthropic_key"
OPENAI_API_KEY="your_openai_key"

# Authentication
SESSION_SECRET="your_session_secret"
JWT_SECRET="your_jwt_secret"

# GitHub Integration (optional)
GITHUB_TOKEN="your_github_token"

# Vercel Integration (optional)
VERCEL_TOKEN="your_vercel_token"

# Stripe (optional)
STRIPE_SECRET_KEY="your_stripe_key"
STRIPE_WEBHOOK_SECRET="your_webhook_secret"

# Sentry (optional)
SENTRY_DSN="your_sentry_dsn"

# Storage (optional)
AWS_ACCESS_KEY_ID="your_aws_key"
AWS_SECRET_ACCESS_KEY="your_aws_secret"
AWS_REGION="us-east-1"
S3_BUCKET="your_bucket"

# Encryption
API_KEY_ENCRYPTION_KEY="your_encryption_key"
```

4. **Set up the database**

**Important**: This project uses PostgreSQL. For detailed database setup, see [DATABASE.md](./DATABASE.md).

```bash
npm run db:push
```

This will create all necessary tables in your PostgreSQL database.

5. **Seed the database (optional)**

```bash
npm run seed
```

This will populate the knowledge base with AI companies, frameworks, and models.

6. **Start the development servers**

```bash
npm run dev
```

This starts both the Vite frontend (port 5173) and Express backend (port 3001).

7. **Open your browser**

Navigate to [http://localhost:5173](http://localhost:5173)

## Usage

### Basic Component Generation

1. Navigate to the **Prompt Playground** at `/playground`
2. Enter a natural language description:
   ```
   Create a todo list app with add, delete, and toggle functionality.
   Use Tailwind CSS and include localStorage persistence.
   ```
3. Click **Generate**
4. Wait for the multi-agent system to generate your component
5. Preview the result in the embedded preview window
6. Edit files using the Monaco editor
7. Deploy to Vercel or download the project

### Advanced Features

#### Multi-Agent Orchestration

Enable orchestration mode for complex projects that require coordination between multiple specialized agents. The system will automatically:

- Analyze requirements and break down the task
- Assign subtasks to specialized agents
- Coordinate dependencies and execution order
- Combine results into a cohesive application

#### Real-Time Collaboration

Join a workspace for collaborative development:

- Multiple users can work on the same project simultaneously
- See live file updates from other team members
- Chat in real-time within the workspace
- Track cursor positions and user activity
- Shared project state and synchronization

#### Knowledge Base Integration

The system automatically injects relevant knowledge based on your prompt:

- Mentions of AI companies (e.g., "OpenAI", "Anthropic") include their documentation
- Framework references automatically include best practices
- API integrations include rate limiting and error handling strategies
- Component patterns include accessibility guidelines

### Development Workflows

#### Creating a Simple Component

```
Prompt: "Create a weather widget that shows temperature and conditions"
→ CodeGeneratorAgent creates the component
→ UIDesignerAgent ensures responsive layout
→ StyleGeneratorAgent applies Tailwind styling
→ Result: Complete, functional weather widget
```

#### Building a Complex Application

```
Prompt: "Build an e-commerce product page with cart, reviews, and recommendations"
→ RequirementsAgent analyzes the requirements
→ ComponentArchitectAgent plans the structure
→ UIDesignerAgent designs the layout
→ StyleGeneratorAgent creates the theme
→ CodeGeneratorAgent writes the components
→ CompletionAgent validates and ensures quality
→ Result: Production-ready e-commerce page
```

## Project Structure

```
newai/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/         # UI components
│   │   │   ├── AgentMonitor/   # Agent activity visualization
│   │   │   ├── FileExplorer/   # Project file navigation
│   │   │   └── ...             # Other components
│   │   ├── pages/              # Route pages
│   │   │   ├── NewHome.tsx     # Landing page
│   │   │   ├── PromptPlayground.tsx  # Main IDE
│   │   │   └── ...             # Other pages
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # API services
│   │   └── lib/                # Utilities
├── server/                     # Express.js backend
│   ├── agents/                 # AI agent implementations
│   │   ├── OrchestrationAgent.ts
│   │   ├── CodeGeneratorAgent.ts
│   │   ├── UIDesignerAgent.ts
│   │   └── ...                 # Other agents
│   ├── routes/                 # API routes
│   │   ├── agents.ts           # Agent management
│   │   ├── components.ts       # Component generation
│   │   ├── prompts.ts          # Prompt processing
│   │   └── ...                 # Other routes
│   ├── services/               # Backend services
│   │   ├── KnowledgeService.ts
│   │   ├── AICodeGenerator.ts
│   │   ├── WebSocketService.ts
│   │   └── ...                 # Other services
│   ├── utils/                  # Utilities
│   │   ├── ExecutionGraph.ts
│   │   ├── SharedMemory.ts
│   │   ├── FileOrchestrator.ts
│   │   └── ...                 # Other utilities
│   └── middleware/             # Express middleware
├── db/                         # Database
│   ├── index.ts                # Database connection
│   └── schema-pg.ts            # PostgreSQL schema
├── migrations/                 # Database migrations
├── deployments/                # Generated projects
├── agents/                     # Agent configurations
└── prompts/                    # System prompts
```

## API Documentation

### Authentication

**Register**
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "developer",
  "email": "dev@example.com",
  "password": "secure_password"
}
```

**Login**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "dev@example.com",
  "password": "secure_password"
}
```

### Component Generation

**Generate Component**
```http
POST /api/generate
Content-Type: application/json
Authorization: Bearer <token>

{
  "prompt": "Create a weather widget with API integration",
  "context": {
    "framework": "react",
    "styling": "tailwind",
    "typescript": true
  }
}
```

**Generate with Orchestration**
```http
POST /api/agents/orchestrate
Content-Type: application/json
Authorization: Bearer <token>

{
  "prompt": "Build a complete e-commerce product page",
  "executionGraph": {
    "nodes": [
      {
        "id": "requirements",
        "agentType": "requirements-agent",
        "dependencies": []
      },
      {
        "id": "ui-design",
        "agentType": "ui-designer",
        "dependencies": ["requirements"]
      },
      {
        "id": "code-generation",
        "agentType": "code-generator",
        "dependencies": ["ui-design"]
      }
    ]
  }
}
```

### Deployment

**Deploy to Production**
```http
POST /api/deploy
Content-Type: application/json
Authorization: Bearer <token>

{
  "componentId": "comp-123",
  "deploymentConfig": {
    "platform": "vercel",
    "createGithubRepo": true,
    "repoName": "my-awesome-app",
    "isPrivate": false
  }
}
```

### WebSocket Events

**Join Project**
```javascript
{
  type: "join_project",
  projectId: "workspace-123",
  userId: "user-456"
}
```

**File Update**
```javascript
{
  type: "file_update",
  filePath: "src/App.tsx",
  content: "// Updated content"
}
```

### API Endpoints Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agents` | GET | List all AI agents |
| `/api/agents/orchestrate` | POST | Execute orchestrated generation |
| `/api/generate` | POST | Generate React component |
| `/api/generate-with-orchestration` | POST | Multi-agent generation |
| `/api/models` | GET | Available AI models |
| `/api/companies` | GET | AI companies database |
| `/api/frameworks` | GET | Development frameworks |
| `/api/workspaces` | GET | User workspaces |
| `/api/sessions` | GET | Generation sessions |
| `/api/prompts/analyze` | POST | Analyze user prompt |
| `/api/deploy` | POST | Deploy to production |
| `/api/knowledge/relevant` | POST | Get relevant knowledge |

## Database Schema

### Core Tables

**Users**: Authentication and user management
- id, username, email, displayName, passwordHash
- tier (free, pro, team, enterprise)
- stripeCustomerId, subscriptionStatus
- role (user, admin, superadmin)

**Workspaces**: Project organization
- id, name, description, ownerId
- agentConfig (orchestration settings)
- collaborators, projectType
- lastActivity timestamp

**Agents**: AI agent configurations
- id, name, type, model
- systemPrompt, temperature, maxTokens
- tools (capabilities JSON)
- isActive status

**CodeGenerationSessions**: Generation history
- id, title, description
- inputPrompt, generatedCode
- agentId, workspaceId
- status, metadata

**ProjectFiles**: Generated files
- id, projectId, filePath, fileContent
- createdAt, updatedAt

**UsageTracking**: Token and cost tracking
- id, userId, actionType
- tokensUsed, costCents
- metadata, createdAt

## Security

### Authentication & Authorization
- Session-based authentication with secure cookies
- JWT tokens for API access
- Role-based access control (User, Admin, Superadmin)
- OAuth integration for GitHub and Google

### Input Validation
- Zod schemas on all API endpoints
- SQL injection prevention via parameterized queries
- XSS protection with input sanitization
- CORS with strict origin whitelist

### API Security
- Rate limiting per user tier
- API key encryption at rest
- Request logging and monitoring
- Security headers (CSP, X-Frame-Options)

### Data Protection
- Encrypted database connections (SSL/TLS)
- Environment variable encryption
- Secure session storage
- GDPR-compliant data handling

## Performance Optimization

### Caching
- API responses cached for 5 minutes
- Agent results memoized
- Static assets with long-lived cache headers

### Database
- Indexes on frequently queried columns
- Connection pooling with pg
- Query optimization with Drizzle ORM

### Frontend
- Code splitting with Vite
- Lazy loading of components
- Virtual scrolling for large lists
- Debounced search inputs

## Deployment

### Production Build

```bash
# Build frontend and backend
npm run build

# Start production server
npm start
```

### Docker Deployment

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=<production_database_url>
ANTHROPIC_API_KEY=<key>
OPENAI_API_KEY=<key>
SENTRY_DSN=<dsn>
```

## Troubleshooting

### Common Issues

**Database Connection Errors**
```bash
# Check PostgreSQL is running
psql -U postgres

# Verify DATABASE_URL format
# postgresql://username:password@host:port/database
```

**AI API Errors**
```bash
# Verify API keys are set
echo $ANTHROPIC_API_KEY
echo $OPENAI_API_KEY
```

**WebSocket Connection Issues**
- Check firewall allows WebSocket connections
- Ensure CORS is properly configured
- Verify ws:// protocol is used (not wss:// in development)

**Build Errors**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf .vite dist
```

## Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Code Style

- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Write tests for new features
- Update documentation

### Commit Messages

Follow conventional commits:

```
feat: Add new agent for API integration
fix: Resolve WebSocket connection issue
docs: Update API documentation
refactor: Improve code generation logic
test: Add tests for OrchestrationAgent
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- **Anthropic** for Claude AI
- **OpenAI** for GPT-4
- **Vercel** for hosting and deployment
- **Supabase** for database hosting
- **Radix UI** for accessible components
- **Tailwind CSS** for styling utilities

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

Built with care by developers, for developers.

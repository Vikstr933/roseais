# 🤖 Instructions for AI Assistant

**Context:** You're helping transform an AI code generation platform into an advanced multi-agent orchestration system.

---

## What to Read First

1. **Start here:** [TRANSFORMATION_SUMMARY.md](./TRANSFORMATION_SUMMARY.md) (5 min read)
   - Quick overview of current system
   - Target architecture
   - 12-week roadmap

2. **Deep dive:** [CODEBASE_ANALYSIS_FOR_MULTI_AGENT_TRANSFORMATION.md](./CODEBASE_ANALYSIS_FOR_MULTI_AGENT_TRANSFORMATION.md) (20 min read)
   - Complete architecture analysis
   - Every agent explained
   - Code examples and file structure

3. **Supporting docs:**
   - [ENHANCEMENTS_SUMMARY.md](./ENHANCEMENTS_SUMMARY.md) - Recent improvements
   - [POSTGRESQL_MIGRATION.md](./POSTGRESQL_MIGRATION.md) - Database setup
   - [STRIPE_SETUP_GUIDE.md](./STRIPE_SETUP_GUIDE.md) - Payment integration

---

## TL;DR for AI Assistants

### Current State
```typescript
// Existing system (simplified)
class OrchestrationAgent {
  async executeTask(prompt: string) {
    // Step 1: UI Design (placeholder)
    await uiDesignerAgent.executeTask(prompt);

    // Step 2: Code Generation (only real agent)
    const files = await codeGeneratorAgent.executeTask(prompt);

    // Step 3: Completion (placeholder)
    await completionAgent.executeTask(prompt);

    return files;
  }
}
```

**Problems:**
- Sequential execution (slow)
- Only 1 real agent (CodeGeneratorAgent)
- No intelligent task decomposition
- No parallel processing

### Target State
```typescript
// Enhanced system (goal)
class EnhancedOrchestrationAgent {
  async executeTask(prompt: string) {
    // 1. Analyze complexity
    const analysis = await this.analyzeComplexity(prompt);

    // 2. Select agents dynamically
    const agents = this.selectAgents(analysis); // 15-20 agents

    // 3. Create execution plan (DAG)
    const plan = this.createExecutionPlan(agents);

    // 4. Execute in parallel with dependencies
    const results = await this.executeParallel(plan);

    // 5. Self-correction loop
    return await this.refineWithFeedback(results);
  }
}
```

**Benefits:**
- 5-10x faster
- 20+ specialized agents
- Parallel execution
- Self-correcting

---

## Key Concepts to Understand

### 1. Current Agent System
```
OrchestrationAgent (coordinator)
├─ UIDesignerAgent (placeholder)
├─ CodeGeneratorAgent (implemented)
└─ CompletionAgent (placeholder)
```

### 2. Target Agent System
```
EnhancedOrchestrationAgent (master)
├─ FrontendOrchestrator
│  ├─ RequirementsAgent
│  ├─ ComponentArchitectAgent
│  ├─ UIDesignerAgent
│  ├─ ComponentGeneratorAgent (x3)
│  ├─ StyleGeneratorAgent
│  └─ TestGeneratorAgent
├─ BackendOrchestrator (if full-stack)
│  ├─ APIDesignerAgent
│  ├─ DatabaseArchitectAgent
│  └─ BackendGeneratorAgent
└─ QualityOrchestrator
   ├─ TypeCheckAgent
   ├─ LintAgent
   ├─ SecurityAgent
   └─ AccessibilityAgent
```

### 3. Execution Model
```
BEFORE (Sequential):
Requirements → UI Design → Code Gen → Completion
[----10s----][----10s----][---15s---][----5s---] = 40s total

AFTER (Parallel):
Phase 1: Requirements + UI Design (parallel)
Phase 2: Component Arch + API Design (parallel, depends on Phase 1)
Phase 3: Code Gen (x5) + Style Gen (parallel, depends on Phase 2)
Phase 4: Quality Checks (parallel, depends on Phase 3)
[----10s----][----3s----][----5s----][----2s---] = 20s total
```

### 4. Shared Memory System
```typescript
// Agents share context via SharedMemory
const sharedMemory = new SharedMemory();

// Agent 1 writes
await sharedMemory.set('componentArchitecture', {
  components: ['Header', 'Sidebar', 'Content'],
  hierarchy: {...}
});

// Agent 2 reads
const arch = await sharedMemory.get(['componentArchitecture']);
// Use arch to generate specific components
```

---

## Quick Start for Implementation

### Step 1: Read Existing Code
```bash
# Key files to understand:
server/agents/OrchestrationAgent.ts      # Current orchestration (310 lines)
server/agents/CodeGeneratorAgent.ts      # Only working agent (1,049 lines)
server/services/AICodeGenerator.ts       # Claude API integration (496 lines)
client/src/pages/PromptPlayground.tsx    # Main UI (2,037 lines)
```

### Step 2: Implement Foundation (Week 1-2)
```typescript
// Create these new files:
server/agents/RequirementsAgent.ts
server/agents/ComponentArchitectAgent.ts
server/utils/SharedMemory.ts
server/utils/ExecutionGraph.ts

// Enhance existing file:
server/agents/OrchestrationAgent.ts
```

### Step 3: Add Specialized Agents (Week 3-4)
```typescript
// Create 10 new agent files:
server/agents/StyleGeneratorAgent.ts
server/agents/HookGeneratorAgent.ts
server/agents/TestGeneratorAgent.ts
// ... and 7 more
```

### Step 4: Enable Parallel Execution (Week 5-6)
```typescript
// Implement DAG in OrchestrationAgent
private async executeParallel(plan: ExecutionPlan) {
  for (const phase of plan.phases) {
    // Execute all agents in this phase in parallel
    await Promise.all(phase.map(node => node.agent.executeTask(...)));
  }
}
```

---

## Common Questions

**Q: How many agents should run in parallel?**
A: Start with 2-3, gradually increase to 10-15 as you test.

**Q: What if an agent fails?**
A: Implement retry logic (up to 3 attempts) or skip non-critical agents.

**Q: How to handle dependencies between agents?**
A: Use a Directed Acyclic Graph (DAG) to track dependencies. Example:
```typescript
graph.addEdge('requirements', 'component-arch');
// component-arch won't run until requirements completes
```

**Q: How to reduce Claude API costs?**
A: Cache results, share context between agents, use smaller models for simple tasks.

**Q: How to show progress in frontend?**
A: Use Server-Sent Events (SSE) to emit per-agent progress:
```typescript
this.emitProgress({
  agent: 'ComponentGeneratorAgent',
  status: 'in_progress',
  progress: 50
});
```

---

## Code Patterns to Follow

### Pattern 1: Agent Base Class
```typescript
export abstract class BaseAgent {
  protected logger: SimpleLogger;
  protected agentName: string;

  constructor(name: string) {
    this.agentName = name;
    this.logger = new SimpleLogger(name);
  }

  abstract executeTask(task: AgentTask): Promise<any>;
}
```

### Pattern 2: Agent Task Structure
```typescript
interface AgentTask {
  prompt: string;              // User's original prompt
  context: any;                // Shared context from other agents
  sharedMemory: SharedMemory;  // Access to shared memory
  dependencies: string[];      // IDs of dependent agent results
}
```

### Pattern 3: Agent Result Structure
```typescript
interface AgentResult {
  success: boolean;
  data: any;                // Agent-specific output
  metadata: {
    duration: number;       // Execution time in ms
    tokensUsed: number;     // If using LLM
    confidence: number;     // 0-1 score
  };
  error?: string;
}
```

### Pattern 4: Parallel Execution
```typescript
async executeParallel(agents: BaseAgent[], context: any): Promise<Map<string, any>> {
  const results = new Map();

  const promises = agents.map(async (agent) => {
    try {
      const result = await agent.executeTask({ prompt, context });
      results.set(agent.name, result);
    } catch (error) {
      this.handleAgentError(agent, error);
    }
  });

  await Promise.all(promises);
  return results;
}
```

---

## Testing Strategy

### Unit Tests (Per Agent)
```typescript
describe('ComponentGeneratorAgent', () => {
  it('should generate valid React component', async () => {
    const agent = new ComponentGeneratorAgent();
    const result = await agent.executeTask({
      prompt: 'Create a todo list',
      context: {},
      sharedMemory: new SharedMemory()
    });

    expect(result.success).toBe(true);
    expect(result.data.files).toHaveLength(1);
    expect(result.data.files[0].path).toBe('src/App.tsx');
  });
});
```

### Integration Tests (Orchestration)
```typescript
describe('EnhancedOrchestrationAgent', () => {
  it('should coordinate multiple agents', async () => {
    const orchestrator = new EnhancedOrchestrationAgent();
    const result = await orchestrator.executeTask({
      prompt: 'Create a recipe manager app'
    });

    expect(result.success).toBe(true);
    expect(result.files.length).toBeGreaterThan(5);
    expect(result.metadata.agentsUsed).toBeGreaterThan(5);
  });
});
```

### Performance Tests
```typescript
describe('Performance', () => {
  it('should complete in under 20 seconds', async () => {
    const start = Date.now();
    await orchestrator.executeTask({ prompt: '...' });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(20000);
  });
});
```

---

## Debugging Tips

### 1. Enable Verbose Logging
```typescript
// In server/agents/OrchestrationAgent.ts
this.logger.setLevel('debug');
```

### 2. Track Agent Progress
```typescript
// Add timestamps to each step
console.log(`[${Date.now()}] Agent ${agent.name} starting`);
```

### 3. Visualize Execution Graph
```typescript
// Generate DOT format for Graphviz
function exportDAGToDot(graph: ExecutionGraph): string {
  let dot = 'digraph G {\n';
  for (const [from, to] of graph.edges) {
    dot += `  "${from}" -> "${to}";\n`;
  }
  dot += '}\n';
  return dot;
}
```

### 4. Monitor Shared Memory
```typescript
// Log all reads/writes
sharedMemory.on('set', (key, value) => {
  console.log(`SharedMemory[${key}] = ${JSON.stringify(value)}`);
});
```

---

## Success Criteria

### Phase 1 Complete (Week 2)
- [ ] 6 functional agents
- [ ] SharedMemory working
- [ ] 2-3 agents can run in parallel
- [ ] 30% faster than before

### Phase 3 Complete (Week 6)
- [ ] 16 functional agents
- [ ] 10-15 agents in parallel
- [ ] 5x faster than before
- [ ] Visual execution graph

### Phase 6 Complete (Week 12)
- [ ] 25+ functional agents
- [ ] Self-correction working
- [ ] Full-stack generation
- [ ] 10x faster than before

---

## Resources

### Documentation
- [Anthropic Claude API Docs](https://docs.anthropic.com/)
- [React 18 Docs](https://react.dev/)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Directed Acyclic Graph (Wikipedia)](https://en.wikipedia.org/wiki/Directed_acyclic_graph)

### Similar Systems (for inspiration)
- [Bolt.new](https://bolt.new) - Chat-based code generation
- [Lovable](https://lovable.dev) - Multi-agent app builder
- [Replit Agent](https://replit.com/agent) - AI pair programmer
- [v0.dev](https://v0.dev) - UI component generation

### Libraries to Consider
- [p-limit](https://www.npmjs.com/package/p-limit) - Limit concurrent promises
- [p-queue](https://www.npmjs.com/package/p-queue) - Promise queue
- [bottleneck](https://www.npmjs.com/package/bottleneck) - Rate limiting
- [graphlib](https://www.npmjs.com/package/graphlib) - Graph data structure

---

## Contact & Questions

If you need clarification on:
- **Architecture:** Read [CODEBASE_ANALYSIS_FOR_MULTI_AGENT_TRANSFORMATION.md](./CODEBASE_ANALYSIS_FOR_MULTI_AGENT_TRANSFORMATION.md)
- **Database:** Read [POSTGRESQL_MIGRATION.md](./POSTGRESQL_MIGRATION.md)
- **Payments:** Read [STRIPE_SETUP_GUIDE.md](./STRIPE_SETUP_GUIDE.md)
- **Recent Changes:** Read [ENHANCEMENTS_SUMMARY.md](./ENHANCEMENTS_SUMMARY.md)

**Ready to start?** Begin with Phase 1 (Foundation Enhancement) in the full analysis document.

---

**Good luck transforming this into an advanced multi-agent system! 🚀**

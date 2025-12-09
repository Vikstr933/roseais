# Agent Workflow Optimization Plan

## Current State Analysis

### 1. **Agent Execution: SEQUENTIAL (Inefficient) ❌**

**Current Implementation:**
```typescript
// server/services/IncrementalOrchestrator.ts:103
for (let i = 0; i < plan.phases.length; i++) {
  const phase = plan.phases[i];
  // Process phase sequentially
  phaseResult = await this.generatePhase(...);
  // Wait for completion before next phase
}
```

**Problem:**
- Agents run **one at a time** (sequential)
- If Phase 1 takes 10s and Phase 2 takes 8s, total = 18s
- No parallelization even when phases are independent
- Wasted time waiting for sequential completion

### 2. **Visualization: EXISTS but could be better ✅**

**Current Features:**
- `AgentMonitorPanel` component shows agent status
- Circular visualization with agent icons
- Status types: `pending`, `running`, `completed`, `failed`
- SSE events: `AGENT_PROGRESS`, `AGENT_COMPLETE`, `agent:start`, etc.

**What's Missing:**
- No dropdown in chat showing active agents
- Status messages are in collapsible section but not clearly organized
- No real-time token usage tracking
- No phase dependency visualization

### 3. **Token Usage: NOT OPTIMIZED ❌**

**Current Issues:**
- Each phase sends ALL previous files (can be huge)
- Knowledge context sent to every agent (redundant)
- No token counting or optimization
- No context summarization between phases
- Full file contents sent even when only structure needed

### 4. **Context/Research: INSUFFICIENT ⚠️**

**Current State:**
- Agents get context but not always optimal
- No pre-research phase before agents start
- Knowledge context loaded but not always relevant
- No validation that agent has enough context before starting

## Optimization Recommendations

### 🚀 **1. Parallel Agent Execution**

**Goal:** Run independent phases in parallel

**Implementation:**
```typescript
// Identify independent phases
const independentPhases = phases.filter(p => 
  p.dependencies.length === 0 || 
  p.dependencies.every(dep => completedPhases.has(dep))
);

// Run independent phases in parallel
await Promise.all(
  independentPhases.map(phase => 
    this.generatePhase(phase, ...)
  )
);
```

**Benefits:**
- 2-3x faster for multi-phase projects
- Better resource utilization
- Agents work simultaneously when possible

**Example:**
```
Before (Sequential):
Phase 1: 10s → Phase 2: 8s → Phase 3: 12s = 30s total

After (Parallel where possible):
Phase 1: 10s
Phase 2 & 3 (parallel): max(8s, 12s) = 12s
Total: 22s (27% faster)
```

### 💰 **2. Token Optimization**

**A. Context Summarization Between Phases**
```typescript
// Instead of sending all files, send summaries
const summarizeFiles = (files: File[]) => {
  return files.map(f => ({
    path: f.path,
    summary: extractKeyInfo(f.content), // Only key info
    fullContent: f.content // Only if needed
  }));
};
```

**B. Incremental Context Building**
```typescript
// Phase 1: Send full context
// Phase 2: Send only changes + summary of Phase 1
// Phase 3: Send only changes + summary of Phase 1 & 2
```

**C. Smart File Filtering**
```typescript
// Only send relevant files to each phase
const relevantFiles = existingFiles.filter(file => 
  phase.files.some(phaseFile => 
    file.path.includes(phaseFile) || 
    hasDependency(file.path, phase.files)
  )
);
```

**Estimated Savings:**
- 40-60% token reduction
- Faster AI responses (less context to process)
- Lower costs

### 🔍 **3. Pre-Research Phase**

**Goal:** Ensure agents have optimal context before starting

**Implementation:**
```typescript
class ContextResearchService {
  async prepareContextForAgent(
    agentId: string,
    userPrompt: string,
    phase: GenerationPhase
  ): Promise<EnhancedContext> {
    // 1. Load relevant knowledge
    const knowledge = await this.loadRelevantKnowledge(agentId, phase);
    
    // 2. Analyze existing files for patterns
    const patterns = await this.analyzeCodePatterns(existingFiles);
    
    // 3. Check for missing dependencies
    const dependencies = await this.checkDependencies(phase);
    
    // 4. Validate context completeness
    const isComplete = await this.validateContextCompleteness(
      knowledge, patterns, dependencies
    );
    
    if (!isComplete) {
      // Fetch additional context
      await this.enrichContext(...);
    }
    
    return {
      knowledge,
      patterns,
      dependencies,
      existingFiles: this.summarizeFiles(existingFiles)
    };
  }
}
```

**Benefits:**
- Agents start with optimal context
- Fewer errors from missing information
- Better code quality
- Reduced retry attempts

### ⚡ **4. Speed Improvements**

**A. Parallel Phase Execution** (see #1)

**B. Caching Agent Configs**
```typescript
// Cache agent configs to avoid DB queries
private agentConfigCache = new Map<string, AgentConfig>();

async getAgentConfig(agentId: string) {
  if (this.agentConfigCache.has(agentId)) {
    return this.agentConfigCache.get(agentId);
  }
  const config = await this.loadFromDB(agentId);
  this.agentConfigCache.set(agentId, config);
  return config;
}
```

**C. Batch File Operations**
```typescript
// Instead of processing files one by one
await Promise.all(
  files.map(file => this.processFile(file))
);
```

**D. Streaming Responses**
```typescript
// Stream partial results as they're generated
// Don't wait for full completion before showing progress
```

**Estimated Speed Improvement:**
- 30-50% faster overall
- Better perceived performance (streaming)
- Reduced wait times

### 📊 **5. Enhanced Visualization**

**A. Agent Status Dropdown in Chat**
```typescript
// Add to PromptPlayground.tsx
<Collapsible>
  <CollapsibleTrigger>
    🤖 Active Agents ({activeAgents.length})
  </CollapsibleTrigger>
  <CollapsibleContent>
    {activeAgents.map(agent => (
      <AgentStatusCard 
        key={agent.id}
        agent={agent}
        status={agentStatusMap.get(agent.id)}
      />
    ))}
  </CollapsibleContent>
</Collapsible>
```

**B. Token Usage Display**
```typescript
interface TokenUsage {
  phase: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
}

// Show in agent status
<TokenUsageBadge usage={tokenUsage} />
```

**C. Phase Dependency Graph**
```typescript
// Visual graph showing:
// - Which phases depend on which
// - Which are running in parallel
// - Which are blocked waiting
```

## Implementation Priority

### Phase 1: Quick Wins (1-2 days)
1. ✅ Add agent status dropdown in chat
2. ✅ Cache agent configs
3. ✅ Add token usage tracking
4. ✅ Improve status message organization

### Phase 2: Performance (3-5 days)
1. ✅ Parallel phase execution
2. ✅ Context summarization
3. ✅ Smart file filtering
4. ✅ Batch operations

### Phase 3: Quality (5-7 days)
1. ✅ Pre-research phase
2. ✅ Context validation
3. ✅ Enhanced visualization
4. ✅ Dependency graph

## Expected Results

### Performance
- **Speed:** 30-50% faster
- **Token Usage:** 40-60% reduction
- **Cost:** 40-60% lower

### Quality
- **Error Rate:** 20-30% reduction
- **Code Quality:** Better consistency
- **User Experience:** More transparent, faster feedback

### User Experience
- **Visualization:** Clear agent status
- **Transparency:** See what's happening
- **Control:** Better understanding of process

## Metrics to Track

1. **Execution Time**
   - Total time per generation
   - Time per phase
   - Parallel vs sequential comparison

2. **Token Usage**
   - Tokens per phase
   - Total tokens per generation
   - Cost per generation

3. **Quality Metrics**
   - Error rate
   - Retry attempts
   - Validation failures

4. **User Experience**
   - Time to first result
   - Perceived performance
   - User satisfaction


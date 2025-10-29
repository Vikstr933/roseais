# Agent Selection Logic Fixes

## Summary

Fixed the intelligent agent selection system to properly detect task complexity and avoid null reference errors when agents are skipped.

## Changes Made

### 1. Enhanced Complexity Detection (`server/services/AgentSelector.ts`)

**Problem**: Economy/finance apps were being marked as "simple" instead of "complex", causing only 1 agent to be selected.

**Solution**: Enhanced the complexity scoring algorithm:

- **App keywords** weight increased: `3 → 4 points`
  - Words: app, application, system, platform, website, site

- **Business domain keywords** weight increased: `2 → 3 points`
  - Added new words: tracking, tracker
  - Full list: economy, finance, budget, expense, invoice, payment, transaction, savings, spending, accounting, billing, tracking, tracker

- **Adjusted thresholds**:
  - Simple: ≤3 points (was ≤2)
  - Moderate: ≤8 points (was ≤7)
  - Complex: >8 points (was >7)

- **Added word boundary matching** for more accurate detection using regex `\b${word}\b`

### 2. Fixed Null Reference Errors (`server/routes/prompts.ts`)

**Problem**: When agents were skipped (e.g., requirements-analyst not needed), code tried to access `.text` property on null objects causing crashes.

**Solution**: Added null-safe operators and fallbacks:

**Line 727** - UI Designer prompt:
```typescript
// Before
const uiPrompt = `Based on these requirements: ${requirementsAnalysis.text}

// After
const uiPrompt = `Based on these requirements: ${requirementsAnalysis?.text || userPrompt}
```

**Lines 821-822** - Code Generator prompt:
```typescript
// Before
const codePrompt = `Based on the requirements: ${requirementsAnalysis.text}
\nUI Design: ${uiDesign.text}

// After
const codePrompt = `Based on the requirements: ${requirementsAnalysis?.text || userPrompt}
${uiDesign ? `\nUI Design: ${uiDesign.text}` : ''}
```

**Line 817** - Code generation agent selection:
```typescript
// Before
const codeAgent = activeAgents.find(...)

// After
const codeAgent = requiredAgents.find(...)
```

## Test Results

Created comprehensive test suite (`test-agent-selection.mjs`) with the following results:

✅ **Economy App**: "create an economy spending and savings app"
- Score: 14 points
- Complexity: **complex** ✓
- Breakdown: app(+4), economy(+3), savings(+3), spending(+3), and(+1)

✅ **Simple Button**: "create a button component"
- Score: 0 points
- Complexity: **simple** ✓

✅ **Budget Dashboard**: "create a budget tracking dashboard with charts and graphs"
- Score: 10 points
- Complexity: **complex** ✓
- Breakdown: budget(+3), tracking(+3), dashboard(+2), with(+1), and(+1)

✅ **Todo List**: "create a todo list app with add and delete functionality"
- Score: 6 points
- Complexity: **moderate** ✓

✅ **Calculator**: "create a simple calculator"
- Score: 0 points
- Complexity: **simple** ✓

## Impact

1. **More accurate agent selection**: Economy/finance apps now correctly identified as complex tasks
2. **No more crashes**: Null-safe operators prevent crashes when agents are skipped
3. **Optimized performance**: Simple tasks use fewer agents, complex tasks use full team
4. **Better resource usage**: System only activates agents that are actually needed

## Files Modified

- `server/services/AgentSelector.ts` - Enhanced complexity detection
- `server/routes/prompts.ts` - Added null-safe references
- `test-agent-selection.mjs` - Created test suite (new file)

## Next Steps

The system is now ready for production use with intelligent agent selection. Future enhancements could include:

1. Machine learning-based complexity detection
2. User feedback loop to improve accuracy
3. Custom complexity rules per project type
4. Performance metrics tracking

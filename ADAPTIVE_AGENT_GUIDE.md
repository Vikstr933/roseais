# Adaptive AI Agent System Guide

## Overview

Your AI agents now use **adaptive prompts** inspired by industry leaders (GPT-5/Augment Code, Claude Code, Cursor). This makes them smarter, more efficient, and less likely to do unnecessary work.

## Key Improvements

### 1. **Information First, Action Second**

**Before**: Agents might make changes immediately based on assumptions.

**Now**: Agents gather information BEFORE acting:
- Check existing code patterns
- Verify dependencies and imports exist
- Understand the codebase context
- Confirm the change is actually needed

```typescript
// Old behavior: Might add a new utility function
// New behavior: First checks if similar utility already exists
```

### 2. **Adaptive Behavior Based on Task Complexity**

**Simple Tasks** (No formal planning):
- Single file edits
- Direct answers to questions
- Simple bug fixes
- Explaining existing code

**Complex Tasks** (Use structured approach):
- Multi-file changes
- New features with dependencies
- Ambiguous requirements
- Breaking changes

The agent now **automatically decides** which approach to use.

### 3. **Efficiency First - No Unnecessary Work**

The agents now ask themselves:
- ✅ Is this change actually necessary?
- ✅ What's the smallest change that achieves the goal?
- ✅ Can I answer by explaining existing code instead?
- ❌ Am I adding features that weren't requested?
- ❌ Am I over-engineering a simple requirement?

### 4. **Clear Decision Framework**

#### When Agents WON'T Generate Code:
- User asks "how does X work?" → **Explains existing code**
- User asks "where is X?" → **Points to location**
- Request is exploratory or informational

#### When Agents WILL Generate Code:
- User explicitly requests implementation ("add", "create", "implement")
- User asks to modify behavior ("change", "update", "fix")
- User requests verification and code fails

#### When Agents ASK First:
- Installing dependencies
- Making breaking changes
- Deploying or pushing code
- Doing work beyond what was requested

### 5. **Respecting Your Codebase**

Agents now:
- Match existing code style and patterns
- Use utilities that already exist
- Don't refactor working code unless asked
- Make surgical, focused changes

## How to Use

### For Code Generation

```typescript
// Example 1: Simple request
"Create a button component"
// Agent generates: Just the button component, nothing extra

// Example 2: Feature request
"Add user authentication with login and signup"
// Agent:
// 1. Checks existing auth patterns in your codebase
// 2. Uses existing UI components
// 3. Follows your project's structure
// 4. Generates only what's needed for auth
```

### Configuration Options

You can customize agent behavior in your requests:

```typescript
{
  prompt: "Create a todo app",
  features: ["Add items", "Delete items", "Mark complete"],
  modelPreference: "quality", // or "speed" or "cost"
  // Agents will adapt based on complexity
}
```

### Best Practices

1. **Be Specific**: Clear requirements = better results
   ```
   ❌ "Make it better"
   ✅ "Add form validation for email and password fields"
   ```

2. **Trust the Agent's Judgment**:
   ```
   - Agents will ask if they need clarification
   - They'll inform you if a change isn't needed
   - They'll suggest alternatives if appropriate
   ```

3. **Provide Context When Needed**:
   ```typescript
   {
     prompt: "Add payment processing",
     context: "We're already using Stripe for subscriptions"
     // Agent will integrate with existing Stripe setup
   }
   ```

## Comparison: Before vs After

### Before (Old Prompts)
```typescript
User: "How does authentication work in this app?"

Agent: *Generates new auth system*
// Even though one already exists!
```

### After (Adaptive Prompts)
```typescript
User: "How does authentication work in this app?"

Agent: "I can see you have authentication implemented in
server/middleware/auth.ts using JWT tokens. Here's how it works:
[Explains existing code]

Would you like me to modify or extend this system?"
```

### Before (Old Prompts)
```typescript
User: "Create a simple counter component"

Agent: *Generates:*
- Counter.tsx (300 lines)
- useCounter.ts hook
- counterUtils.ts
- counterTypes.ts
- CounterButton.tsx
- CounterDisplay.tsx
- Plus tests, docs, stories...
```

### After (Adaptive Prompts)
```typescript
User: "Create a simple counter component"

Agent: *Generates:*
- Counter.tsx (50 lines, self-contained)
// Everything needed, nothing extra
```

## Key Principles for Users

### 1. Ask Questions Freely
The agent will explain code instead of rewriting it when appropriate.

### 2. Request Minimal Changes
Agents will make surgical edits, not full rewrites.

### 3. Expect Smart Defaults
Agents use your existing patterns and conventions automatically.

### 4. Provide Feedback
If an agent adds unnecessary code, tell it! The system learns from corrections.

## Advanced Features

### Multi-Agent Orchestration

For complex tasks, the orchestration agent now:
1. **Analyzes** task complexity
2. **Decides** if multiple agents are needed
3. **Coordinates** them efficiently
4. **Validates** outputs
5. **Synthesizes** final results

Example flow:
```
User: "Build a dashboard with charts and user management"

Orchestration Agent:
├─ Requirements Analyst → Breaks down requirements
├─ UI Designer → Designs dashboard layout
├─ Code Generator → Implements components
└─ Completion Agent → Validates & integrates
```

### Cost Optimization

The adaptive system reduces costs by:
- **Fewer unnecessary API calls** (information gathering is focused)
- **Smaller outputs** (no over-engineering)
- **Smart caching** (reuse context across agents)
- **Model selection** (uses faster models for simple tasks)

## Troubleshooting

### Agent Not Making Expected Changes?

The agent might have determined the change isn't needed. Check its response:
- Did it explain why?
- Did it suggest an alternative?
- Did it ask a clarifying question?

### Agent Asking Too Many Questions?

This is usually good! It means:
- Requirements are ambiguous
- Multiple valid approaches exist
- The agent is avoiding assumptions

### Agent Not Using Existing Code?

Make sure:
- Your codebase structure is clear
- Related files are in expected locations
- You provide context when needed

## Examples

### Example 1: Information Gathering

```typescript
User: "Where do we handle API errors?"

Old Behavior:
- Creates new error handling system
- Adds middleware, utilities, types
- 500 lines of new code

New Behavior:
"Your API error handling is in:
- server/middleware/errorHandler.ts (global handler)
- client/src/lib/api.ts (client-side wrapper)

They use standardized error formats with status codes.
Would you like me to modify this or add new error types?"
```

### Example 2: Adaptive Complexity

```typescript
User: "Add a search feature to the user list"

Agent Analysis:
- Simple task: Add search to existing component
- No multi-agent coordination needed
- Check existing search implementations first

Action:
1. Checks if search is used elsewhere ✓
2. Copies pattern from existing code ✓
3. Makes minimal addition to UserList ✓
4. Adds search state + filter logic ✓
5. Done - no orchestration overhead!
```

### Example 3: Efficiency

```typescript
User: "Create a login form"

Old Approach (Over-engineered):
- LoginForm.tsx
- useLoginForm.ts
- loginValidation.ts
- loginTypes.ts
- FormInput.tsx
- FormButton.tsx
- 6 files, 400+ lines

New Approach (Right-sized):
- LoginForm.tsx (one file, 80 lines)
  - Includes validation logic
  - Uses existing Button/Input from UI library
  - All types defined inline
  - Production-ready, maintainable
```

## Configuration Files

The adaptive system is configured through:

1. **AdaptiveAgentPrompts.ts** - Core prompt patterns
2. **AICodeGenerator.ts** - Integration with code generation
3. **OrchestrationAgent.ts** - Multi-agent coordination

## Monitoring and Metrics

Track agent efficiency:
- Files generated per request
- API calls made
- Tokens used
- Time to completion

Look for:
- ✅ Decreasing tokens per request
- ✅ Fewer unnecessary files
- ✅ More focused outputs
- ✅ Better code quality

## Summary

Your AI agents are now:
- **Smarter**: Gather context before acting
- **More efficient**: No unnecessary work
- **More adaptive**: Adjust to task complexity
- **More respectful**: Follow your codebase patterns
- **More economical**: Lower API costs

The key difference: **They think before they act, and only act when necessary.**

---

## Quick Reference

| Situation | Old Behavior | New Behavior |
|-----------|-------------|--------------|
| User asks "how does X work?" | Generates new code | Explains existing code |
| Simple task | May over-engineer | Minimal implementation |
| Complex task | Might guess requirements | Asks clarifying questions |
| Existing pattern exists | Might create new one | Reuses existing pattern |
| Ambiguous request | Makes assumptions | Requests clarification |
| After generation | Done | Suggests testing/verification |

## Next Steps

1. **Try it out**: Generate a new component and compare to old results
2. **Observe**: Watch how agents gather information first
3. **Provide feedback**: Help agents learn your preferences
4. **Measure**: Track cost and quality improvements

For questions or issues, check the agent logs or ask the agents directly!

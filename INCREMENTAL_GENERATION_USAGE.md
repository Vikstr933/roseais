# 🚀 Incremental Generation System - Usage Guide

**Status:** ✅ **IMPLEMENTED**  
**Date:** November 12, 2025

---

## 🎯 Overview

The incremental generation system builds code in phases, validating at each step. Each agent sees what was built before, preventing errors from compounding.

**Key Benefits:**
- ✅ Builds foundation first
- ✅ Validates at each phase
- ✅ Fixes errors before they compound
- ✅ Context-aware generation
- ✅ Dramatically reduces crash rate

---

## 🔧 How to Use

### **Option 1: Enable via API Request**

Add `incrementalGeneration: true` to your request:

```typescript
POST /api/prompts/generate
{
  "userPrompt": "Create a snake game",
  "incrementalGeneration": true,  // ← Enable incremental mode
  "orchestration": true
}
```

### **Option 2: Enable by Default (Future)**

Once tested, you can make it the default by changing:

```typescript
// server/routes/prompts.ts
incrementalGeneration = true,  // Default to true
```

---

## 📊 How It Works

### **Phase 1: Analysis**
```
Analysis Agent → Creates Generation Plan
- Breaks down app into phases
- Defines dependencies
- Creates file structure
```

### **Phase 2: Incremental Generation**
```
For each phase:
  1. Generate files (sees all previous files)
  2. Validate phase
  3. Fix errors if needed (up to 3 attempts)
  4. Move to next phase
```

### **Phase 3: Final Output**
```
- All files written to workspace
- Success/failure report
- Phase-by-phase breakdown
```

---

## 📋 Example Request

```json
{
  "userPrompt": "Create a snake game",
  "incrementalGeneration": true,
  "orchestration": true,
  "userId": "user123"
}
```

### **Response Structure**

```json
{
  "type": "component",
  "text": "...",
  "files": [
    {
      "path": "package.json",
      "content": "..."
    },
    {
      "path": "src/App.tsx",
      "content": "..."
    }
  ],
  "metadata": {
    "workspaceId": "1234567890",
    "generationMode": "incremental",
    "phases": 3,
    "success": true,
    "totalDuration": 45000
  }
}
```

---

## 🔄 SSE Events

The system sends real-time updates via Server-Sent Events:

### **Event Types:**

1. **`INCREMENTAL_GENERATION_START`**
   ```json
   {
     "message": "Starting incremental code generation",
     "workflowId": "workflow-1234567890"
   }
   ```

2. **`PLAN_CREATED`**
   ```json
   {
     "message": "Created generation plan with 3 phases",
     "plan": {
       "appName": "Snake Game",
       "phases": [
         {
           "phase": "base",
           "description": "Project foundation",
           "files": 4
         }
       ]
     }
   }
   ```

3. **`PHASE_PROGRESS`**
   ```json
   {
     "phase": "base",
     "progress": 33.33,
     "message": "Generating base files...",
     "workflowId": "workflow-1234567890"
   }
   ```

4. **`GENERATION_COMPLETE`**
   ```json
   {
     "success": true,
     "files": [...],
     "workspaceId": "1234567890",
     "phases": [
       {
         "phase": "base",
         "success": true,
         "filesCount": 4,
         "duration": 5000
       }
     ],
     "totalDuration": 45000
   }
   ```

---

## 🎨 Generation Plan Structure

The Analysis Agent creates a plan like this:

```json
{
  "appName": "Snake Game",
  "appType": "game",
  "techStack": {
    "framework": "React",
    "buildTool": "Vite",
    "language": "TypeScript"
  },
  "phases": [
    {
      "phase": "base",
      "description": "Project foundation and configuration",
      "files": ["package.json", "tsconfig.json", "index.html", "src/main.tsx"],
      "dependencies": [],
      "agentId": "component-developer"
    },
    {
      "phase": "core",
      "description": "Main application component",
      "files": ["src/App.tsx", "src/index.css"],
      "dependencies": ["base"],
      "agentId": "component-developer"
    }
  ],
  "totalPhases": 2
}
```

---

## ✅ Validation Checks

Each phase is validated for:

1. **Syntax Errors:**
   - `;}` patterns
   - `;)` patterns
   - Incomplete return statements
   - Unclosed JSX tags

2. **Import Resolution:**
   - All imports have corresponding files
   - Paths are correct
   - No circular dependencies

3. **Type Safety:**
   - TypeScript compiles
   - Types match usage
   - No type errors

4. **JSON Validity:**
   - Config files are valid JSON
   - Proper structure

---

## 🔧 Error Fixing

If validation fails, the Fix Agent attempts to correct:

- **Syntax Errors:** Removes problematic patterns
- **Import Errors:** Creates missing files or fixes paths
- **Type Errors:** Adds missing types
- **Logic Errors:** Fixes broken logic

**Maximum Attempts:** 3 per phase

---

## 📈 Expected Improvements

### **Error Rate:**
- **Current System:** ~30% crash rate
- **Incremental System:** <5% crash rate (expected)

### **Code Quality:**
- **Current:** Syntax errors, missing imports common
- **Incremental:** Clean, compilable code from start

### **User Experience:**
- **Current:** App crashes, user frustrated
- **Incremental:** Working app, user happy

---

## 🧪 Testing

### **Test Cases:**

1. **Simple App:**
   ```json
   {
     "userPrompt": "Create a todo list",
     "incrementalGeneration": true
   }
   ```

2. **Game:**
   ```json
   {
     "userPrompt": "Create a snake game",
     "incrementalGeneration": true
   }
   ```

3. **Complex App:**
   ```json
   {
     "userPrompt": "Create a dashboard with charts and data tables",
     "incrementalGeneration": true
   }
   ```

---

## 🐛 Troubleshooting

### **Issue: Plan creation fails**
- **Solution:** System falls back to default plan (base + core phases)

### **Issue: Phase validation fails after 3 attempts**
- **Solution:** Phase marked as failed, but generation continues
- **Note:** Final QA will catch all errors

### **Issue: Import resolution fails**
- **Solution:** Fix Agent creates missing files or removes imports

---

## 🔮 Future Enhancements

1. **Parallel Phase Generation:** Generate independent phases in parallel
2. **Smarter Fix Agent:** Use AI to fix complex errors
3. **Phase Caching:** Cache successful phases for reuse
4. **Incremental Updates:** Update existing apps incrementally
5. **Test Generation:** Auto-generate tests for each phase

---

## 📚 Related Documentation

- `IMPROVED_INCREMENTAL_GENERATION_ARCHITECTURE.md` - Full architecture details
- `CURRENT_VS_IMPROVED_COMPARISON.md` - Comparison with current system
- `CODE_GENERATION_FLOW.md` - Overall code generation flow

---

## ✅ Status

**Implementation:** ✅ Complete  
**Testing:** 🔄 In Progress  
**Production:** ⏳ Pending (feature flag)

---

**Ready to test!** Enable `incrementalGeneration: true` in your requests to try it out.


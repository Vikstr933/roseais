# Python Preview Architecture

## ✅ IMPLEMENTED

Both preview methods are now fully implemented:
1. **Pyodide (Browser)** - For simple Python scripts
2. **Server-Side Sandbox** - For Flask/Django/FastAPI/Streamlit

## Current State
- WebContainer supports JavaScript/Node.js (React/Vite)
- **NEW:** Pyodide supports Python scripts in browser
- **NEW:** Server-side sandbox supports Python web apps

## Solution Options

### Option 1: Pyodide (Python in Browser via WebAssembly) ⭐ RECOMMENDED FOR SIMPLE SCRIPTS
**Pros:**
- Runs entirely in browser (no server needed)
- Instant execution
- Good for data science, scripting, algorithms

**Cons:**
- No Flask/Django/FastAPI server support
- Limited networking capabilities
- Some packages not available

**Use cases:**
- Data processing scripts
- Algorithm visualization
- Learning/educational Python
- Jupyter-like notebooks

### Option 2: Server-Side Python Sandbox ⭐ RECOMMENDED FOR WEB APPS
**Pros:**
- Full Python support (Flask, Django, FastAPI)
- Can run any package
- Proper web server capabilities

**Cons:**
- Requires backend infrastructure
- Resource usage per user
- Security considerations (sandboxing)

**Implementation:**
- Docker containers with Python
- OR: Use E2B (e2b.dev) - cloud sandboxes
- OR: Use Modal/Replit API

### Option 3: Hybrid Approach ⭐ BEST OF BOTH WORLDS
- Detect project type
- Simple scripts → Pyodide (browser)
- Web apps → Server-side sandbox

---

## Implementation Plan

### Phase 1: Pyodide Integration (Browser-based)
For simple Python scripts, data processing, and learning.

```typescript
// client/src/services/PythonRuntimeService.ts
import { loadPyodide } from 'pyodide';

class PythonRuntimeService {
  private pyodide: any = null;
  
  async init() {
    this.pyodide = await loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
    });
  }
  
  async runCode(code: string): Promise<{ output: string; error?: string }> {
    // Capture stdout
    await this.pyodide.runPythonAsync(`
      import sys
      from io import StringIO
      sys.stdout = StringIO()
    `);
    
    try {
      await this.pyodide.runPythonAsync(code);
      const output = await this.pyodide.runPythonAsync('sys.stdout.getvalue()');
      return { output };
    } catch (error) {
      return { output: '', error: String(error) };
    }
  }
  
  async installPackage(packageName: string) {
    await this.pyodide.loadPackage('micropip');
    await this.pyodide.runPythonAsync(`
      import micropip
      await micropip.install('${packageName}')
    `);
  }
}
```

### Phase 2: Server-Side Sandbox (Web Apps)
For Flask, Django, FastAPI apps.

```typescript
// server/services/PythonSandboxService.ts
import { E2BCodeRunner } from 'e2b';

class PythonSandboxService {
  async runPythonApp(files: Array<{path: string, content: string}>) {
    // Option A: E2B Cloud Sandbox
    const sandbox = await E2BCodeRunner.create();
    
    // Write files
    for (const file of files) {
      await sandbox.filesystem.write(file.path, file.content);
    }
    
    // Install dependencies
    await sandbox.process.start({
      cmd: 'pip install -r requirements.txt'
    });
    
    // Start server
    const process = await sandbox.process.start({
      cmd: 'python app.py',
      onStdout: (data) => console.log(data),
      onStderr: (data) => console.error(data)
    });
    
    // Return URL (E2B provides public URL)
    return { url: sandbox.getHostUrl(5000) };
  }
}
```

### Phase 3: UI Integration

```tsx
// Detect project type and show appropriate preview
const PreviewPanel = ({ files, projectType }) => {
  if (projectType === 'python-script') {
    return <PyodidePreview files={files} />;
  }
  
  if (projectType === 'python-web') {
    return <PythonServerPreview files={files} />;
  }
  
  // Default: WebContainer for React/Node
  return <WebContainerPreview files={files} />;
};
```

---

## Recommended Implementation Order

### Week 1: Pyodide for Simple Scripts
1. Add pyodide package
2. Create PythonRuntimeService
3. Add Python output panel in playground
4. Test with basic scripts

### Week 2: E2B Integration for Web Apps
1. Sign up for E2B (free tier available)
2. Create PythonSandboxService
3. Add Flask/Django detection
4. Implement preview URL handling

### Week 3: Polish & UX
1. Loading states and progress
2. Error handling
3. Package installation UI
4. Console/terminal output

---

## Cost Considerations

| Service | Free Tier | Paid |
|---------|-----------|------|
| Pyodide | Free (browser) | Free |
| E2B | 100 hours/month | $0.05/hour |
| Modal | $30 free credits | Usage-based |
| Replit | Limited | $7/month |

---

## Security Considerations

### Pyodide (Browser)
- Isolated in browser sandbox
- No network access by default
- Safe for untrusted code

### Server-Side
- Use containerization (Docker)
- Time limits (max 5 min execution)
- Memory limits (512MB)
- Network isolation
- No root access

---

## Detection Logic

```typescript
function detectPythonProjectType(files: Array<{path: string, content: string}>): 
  'python-script' | 'python-web' | 'python-data' {
  
  const hasFlask = files.some(f => f.content.includes('from flask import'));
  const hasDjango = files.some(f => f.content.includes('django'));
  const hasFastAPI = files.some(f => f.content.includes('from fastapi import'));
  const hasStreamlit = files.some(f => f.content.includes('import streamlit'));
  
  if (hasFlask || hasDjango || hasFastAPI) return 'python-web';
  if (hasStreamlit) return 'python-data'; // Special case: Streamlit
  
  return 'python-script'; // Default: simple script, use Pyodide
}
```


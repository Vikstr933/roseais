# Input Validation with Zod ✅

## Overview
We've implemented comprehensive input validation and sanitization using Zod to prevent malicious code, validate data integrity, and catch errors early.

## What Was Added

### 1. Validation Schemas (`server/validation/schemas.ts`)
- **User Input Validation**: Prompts, file paths, component names
- **AI Output Validation**: Generated files, responses, dependencies
- **Security Checks**: Detect dangerous code patterns
- **Database Schemas**: Projects, chat messages, users
- **Helper Functions**: Sanitization, malicious code detection

### 2. Validation Middleware (`server/middleware/validation.ts`)
- `validateRequest` - Validate request body
- `validateQuery` - Validate query parameters
- `validateParams` - Validate route parameters
- `sanitizeAIResponse` - Clean AI-generated code
- `validateFileUpload` - Check file uploads
- `securityHeaders` - Add security headers

### 3. Applied to Routes
- `/api/prompts/generate` - Input validation ✅
- `/api/components/*` - Ready for validation
- All routes - Security headers

## Security Features

### 1. Dangerous Code Detection

**What We Block:**
- ❌ `child_process` imports (command execution)
- ❌ `fs` imports (file system access)
- ❌ `net` imports (network access)
- ❌ `eval()` usage (code injection)
- ❌ `Function()` constructor (code injection)
- ❌ Script tags in prompts
- ❌ Directory traversal (`../`)

**Example:**
```typescript
// This would be BLOCKED
const code = `
  const { exec } = require('child_process');
  exec('rm -rf /');
`;

// Detection
const issues = detectMaliciousCode(code);
// Returns: ['Contains child_process import (command execution)']
```

### 2. Input Sanitization

**Prompt Validation:**
```typescript
// ✅ Valid
userPrompt: "Build a todo list app"

// ❌ Invalid - too short
userPrompt: "hi"
// Error: "Prompt must be at least 3 characters"

// ❌ Invalid - contains script tag
userPrompt: "Build an app <script>alert('xss')</script>"
// Error: "Prompt cannot contain script tags"

// ❌ Invalid - dangerous function
userPrompt: "Use eval() to process data"
// Error: "Prompt cannot contain dangerous JavaScript functions"
```

**File Path Validation:**
```typescript
// ✅ Valid paths
"src/App.tsx"
"components/Button/index.tsx"
"styles/main.css"

// ❌ Invalid paths
"../../../etc/passwd" // Directory traversal
"/absolute/path" // Absolute paths not allowed
"file with spaces.ts" // Invalid characters
```

### 3. Component Name Validation

```typescript
// ✅ Valid names
"TodoList"
"UserProfile"
"DashboardCard"

// ❌ Invalid names
"todoList" // Must be PascalCase
"Todo-List" // No hyphens allowed
"123Todo" // Can't start with number
```

### 4. Package.json Validation

**Allowed Dependencies:**
- ✅ `react`, `react-dom`
- ✅ `@types/*`
- ✅ `typescript`, `vite`
- ✅ `tailwind`, `@tailwindcss/*`
- ✅ `lucide-react`, `framer-motion`
- ✅ `@tanstack/*`, `zustand`, `zod`
- ✅ `@radix-ui/*`

**Blocked Dependencies:**
- ❌ `express`, `axios` (backend in frontend)
- ❌ `puppeteer`, `playwright` (automation)
- ❌ `crypto-js`, `bcrypt` (security in frontend)
- ❌ Any unknown packages

```typescript
// ✅ Valid package.json
{
  "dependencies": {
    "react": "^18.0.0",
    "lucide-react": "^0.263.0"
  }
}

// ❌ Invalid - dangerous package
{
  "dependencies": {
    "puppeteer": "^21.0.0" // Not in whitelist
  }
}
```

## API Validation Examples

### User Prompt Generation

**Request:**
```bash
POST /api/prompts/generate
Content-Type: application/json

{
  "userPrompt": "Build a calculator app",
  "model": "claude-3-5-sonnet-20241022",
  "temperature": 0.7
}
```

**Validation:**
1. ✅ Check prompt length (3-5000 chars)
2. ✅ Check for script tags
3. ✅ Check for dangerous functions
4. ✅ Validate model enum
5. ✅ Validate temperature range (0-2)

**Success Response:**
```json
{
  "type": "component",
  "files": [...]
}
```

**Error Response (validation failed):**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "userPrompt",
      "message": "Prompt must be at least 3 characters"
    }
  ],
  "type": "VALIDATION_ERROR"
}
```

### Project Creation

**Request:**
```bash
POST /api/workspaces
Content-Type: application/json

{
  "name": "My Project",
  "description": "A todo app",
  "type": "react"
}
```

**Validation:**
1. ✅ Name: 1-100 characters
2. ✅ Description: max 500 characters
3. ✅ Type: enum ['react', 'vue', 'svelte', 'next', 'other']

### Chat Messages

**Request:**
```bash
POST /api/workspaces/1/chat
Content-Type: application/json

{
  "message": "Add dark mode",
  "messageType": "user"
}
```

**Validation:**
1. ✅ Message: 1-5000 characters
2. ✅ Type: enum ['user', 'assistant', 'system']

## Using Validation in Your Code

### Backend Routes

```typescript
import { validateRequest } from '../middleware/validation';
import { userPromptSchema } from '../validation/schemas';

router.post(
  '/api/your-endpoint',
  authenticateUser,
  validateRequest(userPromptSchema), // Add validation
  async (req, res) => {
    // req.body is now validated and type-safe
    const { userPrompt } = req.body;
    // ...
  }
);
```

### Custom Validation Schema

```typescript
import { z } from 'zod';

const customSchema = z.object({
  email: z.string().email(),
  age: z.number().min(18).max(120),
  role: z.enum(['user', 'admin']),
});

router.post(
  '/api/users',
  validateRequest(customSchema),
  async (req, res) => {
    // req.body is validated
  }
);
```

### Manual Validation

```typescript
import { userPromptSchema } from '../validation/schemas';

async function processPrompt(data: any) {
  try {
    // Validate manually
    const validated = await userPromptSchema.parseAsync(data);
    
    // Use validated data
    return generateCode(validated.userPrompt);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation errors:', error.errors);
    }
    throw error;
  }
}
```

### Frontend Validation

```typescript
import { z } from 'zod';

const formSchema = z.object({
  prompt: z.string().min(3).max(5000),
  temperature: z.number().min(0).max(2),
});

function PromptForm() {
  const [errors, setErrors] = useState<string[]>([]);
  
  const handleSubmit = async (data: any) => {
    try {
      // Validate on client-side before sending
      const validated = formSchema.parse(data);
      
      // Send to API
      await api.generate(validated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors(error.errors.map(e => e.message));
      }
    }
  };
}
```

## Security Best Practices

### 1. Always Validate User Input

❌ Bad:
```typescript
router.post('/api/generate', async (req, res) => {
  const prompt = req.body.userPrompt; // No validation!
  await generateCode(prompt);
});
```

✅ Good:
```typescript
router.post(
  '/api/generate',
  validateRequest(userPromptSchema),
  async (req, res) => {
    const { userPrompt } = req.body; // Validated!
    await generateCode(userPrompt);
  }
);
```

### 2. Sanitize AI Outputs

❌ Bad:
```typescript
const code = await ai.generate(prompt);
await executeCode(code); // Dangerous!
```

✅ Good:
```typescript
const code = await ai.generate(prompt);

// Check for malicious patterns
const issues = detectMaliciousCode(code);
if (issues.length > 0) {
  throw new Error(`Unsafe code: ${issues.join(', ')}`);
}

// Sanitize
const sanitized = sanitizeFileContent(code);
await executeCode(sanitized);
```

### 3. Whitelist, Don't Blacklist

❌ Bad (blacklist):
```typescript
// Try to block everything bad
if (code.includes('eval') || code.includes('exec')) {
  throw new Error('Dangerous code');
}
```

✅ Good (whitelist):
```typescript
// Only allow known-safe packages
const allowedPackages = ['react', 'lucide-react'];
if (!allowedPackages.some(pkg => packageName.startsWith(pkg))) {
  throw new Error('Package not allowed');
}
```

### 4. Layer Your Security

```typescript
router.post(
  '/api/generate',
  authenticateUser,           // 1. Auth
  validateRequest(schema),    // 2. Validate
  rateLimitAI,               // 3. Rate limit
  sanitizeAIResponse,        // 4. Sanitize
  async (req, res) => {
    // 5. Business logic
  }
);
```

## Testing Validation

### Test Valid Input

```bash
curl -X POST http://localhost:3001/api/prompts/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userPrompt": "Build a todo app",
    "model": "claude-3-5-sonnet-20241022"
  }'
```

**Expected:** Success (200)

### Test Invalid Input - Too Short

```bash
curl -X POST http://localhost:3001/api/prompts/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userPrompt": "hi"
  }'
```

**Expected:** Error (400)
```json
{
  "error": "Validation failed",
  "details": [{
    "field": "userPrompt",
    "message": "Prompt must be at least 3 characters"
  }]
}
```

### Test Invalid Input - Script Tag

```bash
curl -X POST http://localhost:3001/api/prompts/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userPrompt": "Build app <script>alert(1)</script>"
  }'
```

**Expected:** Error (400)
```json
{
  "error": "Validation failed",
  "details": [{
    "field": "userPrompt",
    "message": "Prompt cannot contain script tags"
  }]
}
```

### Test Invalid Input - Wrong Model

```bash
curl -X POST http://localhost:3001/api/prompts/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userPrompt": "Build a todo app",
    "model": "invalid-model"
  }'
```

**Expected:** Error (400)
```json
{
  "error": "Validation failed",
  "details": [{
    "field": "model",
    "message": "Invalid enum value. Expected 'claude-3-5-sonnet-20241022' | 'gpt-4' | ..."
  }]
}
```

## Monitoring

### View Validation Failures in Sentry

1. Go to Sentry dashboard
2. Filter by "VALIDATION_ERROR"
3. See most common validation failures
4. Identify patterns and improve UX

### Common Validation Errors

| Error | Frequency | Solution |
|-------|-----------|----------|
| Prompt too short | High | Add client-side validation |
| Invalid model | Medium | Use dropdown instead of text input |
| Invalid file path | Low | Auto-generate paths |

## Summary

✅ **Step 3 (Input Validation) - COMPLETE!**

**Protection Added:**
- 🛡️ XSS prevention (script tag blocking)
- 🛡️ Code injection prevention (eval, Function blocking)
- 🛡️ Directory traversal prevention (../ blocking)
- 🛡️ Malicious package prevention (whitelist)
- 🛡️ Data integrity (type checking, ranges)
- 🛡️ Security headers (XSS, clickjacking, MIME)

**Next Steps:**
- Step 4: Migrate to PostgreSQL (critical for scale)
- Step 5: Implement proper authentication
- Step 6: Add file storage (S3/R2)

**Security Level**: Your application is now significantly more secure! 🔒


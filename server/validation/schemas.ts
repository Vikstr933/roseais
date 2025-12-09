import { z } from 'zod';

/**
 * Validation Schemas for API Inputs and AI Outputs
 * Prevents malicious code, validates data integrity, catches errors early
 */

// ============================================================================
// User Input Schemas
// ============================================================================

/**
 * User prompt validation
 */
export const userPromptSchema = z.object({
  userPrompt: z
    .string()
    .min(3, 'Prompt must be at least 3 characters')
    .max(10000, 'Prompt must be less than 10000 characters') // Increased from 5000 to allow detailed instructions
    .refine(
      (val) => {
        // Allow script tags only if they're inside code blocks (markdown)
        const hasScriptTags = /<script[^>]*>/i.test(val);
        if (!hasScriptTags) {
          return true; // No script tags, allow
        }
        // If there are script tags, check if they're in code blocks
        // Simple heuristic: if code blocks exist, assume script tags are in them
        return val.includes('```');
      },
      'Prompt cannot contain script tags outside of code blocks. Please wrap code examples in markdown code blocks (```)'
    )
    .refine(
      (val) => {
        // Allow dangerous functions if they appear in code blocks (markdown) or are teaching/example code
        const hasCodeBlocks = val.includes('```');
        const hasFileMarker = val.includes('// file:') || val.includes('// File:');
        const isCodeExample = val.includes('Code to apply:') || 
                             val.includes('Example:') ||
                             val.includes('Here is the code:') ||
                             val.includes('```typescript') || 
                             val.includes('```javascript') ||
                             val.includes('```jsx') ||
                             val.includes('```tsx') ||
                             val.includes('```js') ||
                             val.includes('```ts');
        
        // If it's a code example or has code blocks, allow dangerous functions
        if (hasCodeBlocks || hasFileMarker || isCodeExample) {
          return true;
        }
        
        // Otherwise, block direct use of dangerous functions in plain text prompts
        // But be more lenient - only block if it looks like actual code execution attempt
        const dangerousPattern = /(eval|new\s+Function|setTimeout|setInterval)\s*\([^)]*\)/i;
        const looksLikeCodeExecution = dangerousPattern.test(val);
        
        // If it looks like actual code execution (not just mentioning the function), block it
        return !looksLikeCodeExecution;
      },
      'Prompt cannot contain dangerous JavaScript function calls outside of code examples. Please wrap code in markdown code blocks (```)'
    ),
  systemPrompt: z.string().optional(),
  model: z.enum([
    'claude-sonnet-4-5-20250929',
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'gpt-4',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
  ]).optional(),
  temperature: z.number().min(0).max(2).optional(),
  orchestration: z.boolean().optional(),
  projectId: z.number().optional(),
  selectedKnowledge: z
    .object({
      companyIds: z.array(z.number()).optional(),
      frameworkIds: z.array(z.number()).optional(),
      workspaceIds: z.array(z.number()).optional(),
    })
    .optional(),
});

/**
 * File path validation
 * Prevents directory traversal attacks
 */
export const filePathSchema = z
  .string()
  .refine(
    (path) => !path.includes('..'),
    'File path cannot contain ..'
  )
  .refine(
    (path) => !path.startsWith('/'),
    'File path cannot start with /'
  )
  .refine(
    (path) => /^[a-zA-Z0-9_\-./]+$/.test(path),
    'File path contains invalid characters'
  );

/**
 * Component name validation
 */
export const componentNameSchema = z
  .string()
  .min(1, 'Component name required')
  .max(100, 'Component name too long')
  .refine(
    (name) => /^[A-Z][a-zA-Z0-9]*$/.test(name),
    'Component name must be PascalCase'
  );

// ============================================================================
// AI Output Schemas
// ============================================================================

/**
 * Generated file validation
 */
export const generatedFileSchema = z.object({
  path: filePathSchema,
  content: z
    .string()
    .max(100000, 'File content exceeds maximum size (100KB)')
    .refine(
      (content) => {
        // Check for dangerous imports
        const dangerousPatterns = [
          /require\s*\(\s*['"]child_process['"]\s*\)/,
          /require\s*\(\s*['"]fs['"]\s*\)/,
          /require\s*\(\s*['"]net['"]\s*\)/,
          /import.*from\s+['"]child_process['"]/,
          /import.*from\s+['"]fs['"]/,
          /import.*from\s+['"]net['"]/,
          /eval\s*\(/,
          /Function\s*\(/,
          /new\s+Function/,
        ];
        return !dangerousPatterns.some((pattern) => pattern.test(content));
      },
      'File contains potentially dangerous code'
    ),
});

/**
 * AI response validation
 */
export const aiResponseSchema = z.object({
  type: z.enum(['text', 'component']),
  text: z.string(),
  files: z.array(generatedFileSchema).optional(),
  componentName: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
});

/**
 * Package.json validation
 * Ensures only safe dependencies
 */
export const packageJsonSchema = z.object({
  name: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Invalid version format'),
  type: z.enum(['module', 'commonjs']).optional(),
  scripts: z.record(z.string()).optional(),
  dependencies: z
    .record(z.string())
    .refine(
      (deps) => {
        // Whitelist of allowed dependencies
        const allowedPrefixes = [
          'react',
          '@types/',
          'typescript',
          'vite',
          'tailwind',
          '@tailwindcss/',
          'lucide-react',
          'framer-motion',
          'date-fns',
          'zod',
          'zustand',
          '@tanstack/',
          'clsx',
          'class-variance-authority',
        ];
        
        return Object.keys(deps).every((dep) =>
          allowedPrefixes.some((prefix) => dep.startsWith(prefix))
        );
      },
      'Package.json contains disallowed dependencies'
    )
    .optional(),
  devDependencies: z.record(z.string()).optional(),
});

// ============================================================================
// Database Schemas
// ============================================================================

/**
 * Project validation
 */
export const projectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name required')
    .max(100, 'Project name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  type: z.enum(['react', 'vue', 'svelte', 'next', 'other']).optional(),
  visibility: z.enum(['private', 'public']).optional(),
});

/**
 * Chat message validation
 */
export const chatMessageSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(5000, 'Message too long'),
  messageType: z.enum(['user', 'assistant', 'system']),
  metadata: z.record(z.any()).optional(),
});

/**
 * User registration validation
 */
export const userRegistrationSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, _ and -'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

/**
 * User login validation
 */
export const userLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password required'),
});

// ============================================================================
// Deployment Schemas
// ============================================================================

/**
 * Deployment request validation
 */
export const deploymentSchema = z.object({
  componentName: componentNameSchema,
  files: z.array(generatedFileSchema).min(1, 'At least one file required'),
  environment: z.enum(['development', 'staging', 'production']).optional(),
});

// ============================================================================
// API Key Schemas
// ============================================================================

/**
 * API key validation
 */
export const apiKeySchema = z.object({
  name: z.string().min(1, 'API key name required'),
  service: z.string().min(1, 'Service name required'),
  key: z
    .string()
    .min(10, 'API key too short')
    .refine(
      (key) => !key.includes(' '),
      'API key cannot contain spaces'
    ),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate and sanitize file content
 */
export function sanitizeFileContent(content: string): string {
  // Remove null bytes
  content = content.replace(/\0/g, '');
  
  // Limit file size
  const maxSize = 100000; // 100KB
  if (content.length > maxSize) {
    content = content.substring(0, maxSize);
  }
  
  return content;
}

/**
 * Validate file extension
 */
export function isAllowedFileExtension(filename: string): boolean {
  const allowedExtensions = [
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.css',
    '.scss',
    '.json',
    '.html',
    '.md',
    '.svg',
  ];
  
  return allowedExtensions.some((ext) => filename.endsWith(ext));
}

/**
 * Validate package name
 */
export function isAllowedPackage(packageName: string): boolean {
  const allowedPrefixes = [
    'react',
    '@types/',
    'typescript',
    'vite',
    'tailwind',
    '@tailwindcss/',
    'lucide-react',
    'framer-motion',
    'date-fns',
    'zod',
    'zustand',
    '@tanstack/',
    'clsx',
    'class-variance-authority',
    '@radix-ui/',
  ];
  
  return allowedPrefixes.some((prefix) => packageName.startsWith(prefix));
}

/**
 * Detect potentially malicious code patterns
 */
export function detectMaliciousCode(code: string): string[] {
  const issues: string[] = [];
  
  // Check for dangerous imports
  if (/require\s*\(\s*['"]child_process['"]\s*\)/.test(code)) {
    issues.push('Contains child_process import (command execution)');
  }
  
  if (/require\s*\(\s*['"]fs['"]\s*\)/.test(code)) {
    issues.push('Contains fs import (file system access)');
  }
  
  if (/eval\s*\(/.test(code)) {
    issues.push('Contains eval() (code injection risk)');
  }
  
  if (/Function\s*\(/.test(code) || /new\s+Function/.test(code)) {
    issues.push('Contains Function constructor (code injection risk)');
  }
  
  if (/document\.cookie/.test(code)) {
    issues.push('Contains document.cookie (potential XSS)');
  }
  
  if (/localStorage\.setItem/.test(code) && /token|password|secret/.test(code)) {
    issues.push('Storing sensitive data in localStorage');
  }
  
  return issues;
}

// Export types
export type UserPromptInput = z.infer<typeof userPromptSchema>;
export type GeneratedFile = z.infer<typeof generatedFileSchema>;
export type AIResponse = z.infer<typeof aiResponseSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type DeploymentInput = z.infer<typeof deploymentSchema>;


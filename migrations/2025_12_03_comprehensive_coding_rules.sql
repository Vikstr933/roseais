-- Migration: Comprehensive Coding Rules for Database Agent Prompts
-- Created: 2025-12-03
-- Purpose: Centralize ALL coding rules, syntax requirements, and best practices in database
--          This replaces hardcoded prompts that were previously in AICodeGenerator
--          Addresses "prompt collision" architectural issue

-- COMPREHENSIVE CODING RULES for code_generator agents
-- This is the single source of truth for ALL coding standards

DO $$
DECLARE
  comprehensive_rules TEXT;
BEGIN
  
  comprehensive_rules := '
===================================================================
[*] COMPREHENSIVE CODING RULES - SINGLE SOURCE OF TRUTH
===================================================================

[1] OUTPUT FORMAT (CRITICAL - App will break if violated)
-------------------------------------------------------------------
[OK] REQUIRED FORMAT: JSON array ONLY
   [
     {"path": "src/App.tsx", "content": "..."},
     {"path": "package.json", "content": "..."}
   ]

❌ FORBIDDEN:
   - NO markdown code blocks (```json or ```)
   - NO explanatory text before or after JSON
   - NO comments outside the JSON structure
   - Start with [ and end with ] - nothing else

🔍 VALIDATION: Your response MUST:
   - Start with exactly "["
   - End with exactly "]"
   - Parse as valid JSON
   - Contain at least {"path": "...", "content": "..."} objects


📂 2. EXPORT/IMPORT MATCHING (CRITICAL - Import errors)
───────────────────────────────────────────────────────────────────
✅ RULES:
   1. src/App.tsx ALWAYS uses DEFAULT export:
      export default function App() {}
      
   2. src/components/*.tsx ALWAYS use NAMED exports:
      export function MyComponent() {}
      
   3. Match export type to import type:
      Named export → import { MyComponent } from ''...''
      Default export → import MyComponent from ''...''
      
   4. ALL imports must have corresponding files in your JSON array

❌ COMMON MISTAKES:
   - Using "export default" in src/components/ files
   - Using "export function" in src/App.tsx
   - Mismatched import/export types (causes "not exported" errors)


🚨 3. CRITICAL SYNTAX RULES (ZERO TOLERANCE)
───────────────────────────────────────────────────────────────────
These patterns will cause immediate compilation failure:

❌ NEVER write these patterns:
   ❌ return {;           // Semicolon after opening brace
   ❌ return (;           // Semicolon after opening paren
   ❌ interface Name {;   // Semicolon after opening brace in interface
   ❌ condition ? x; : y  // Semicolon before colon in ternary
   ❌ case X:;            // Semicolon after case colon
   ❌ export const obj = { key: value; }  // Semicolon in object literal

✅ CORRECT patterns:
   ✅ return {
   ✅ return (
   ✅ interface Name {
   ✅ condition ? x : y
   ✅ case X:
   ✅ export const obj = { key: value }

🔍 SELF-CHECK BEFORE RESPONDING:
   1. Search your code for "{;"
   2. Search for "(;"
   3. Search for "? ....; :"
   4. Search for "return (;"
   5. Fix ALL matches before submitting


🗂️ 4. FILE STRUCTURE RULES (Required for app to work)
───────────────────────────────────────────────────────────────────
✅ MINIMUM REQUIRED FILES (always generate these):
   1. package.json       - Dependencies and scripts
   2. tsconfig.json      - TypeScript configuration
   3. vite.config.ts     - Vite bundler config
   4. index.html         - HTML entry point (NO CSP meta tags!)
   5. src/main.tsx       - React entry point
   6. src/App.tsx        - Main app component (default export)
   7. src/index.css      - Global styles with Tailwind directives
   8. tailwind.config.js - Tailwind CSS configuration
   9. postcss.config.js  - PostCSS configuration

⚠️ CRITICAL: index.html MUST NOT include Content-Security-Policy meta tags!
   WebContainer requires inline scripts and external runtime scripts.
   DO NOT add: <meta http-equiv="Content-Security-Policy" content="...">
   Keep index.html simple: charset, viewport, title, and script tags only.

📂 DIRECTORY STRUCTURE:
   src/
     components/      - Reusable components (named exports)
     hooks/           - Custom React hooks
     types/           - TypeScript type definitions
     utils/           - Utility functions
     App.tsx          - Main app (default export)
     main.tsx         - Entry point
     index.css        - Global styles

🔄 FOR MONOREPO (if backend is detected):
   client/
     src/
       components/
       App.tsx
       main.tsx
       index.css
     package.json
     vite.config.ts
     tsconfig.json
     index.html
   server/
     routes/
     index.ts
     package.json
     tsconfig.json


💾 5. PACKAGE.JSON RULES (Critical for npm install)
───────────────────────────────────────────────────────────────────
✅ REQUIRED FIELDS:
   {
     "name": "...",
     "version": "1.0.0",
     "type": "module",
     "scripts": {
       "dev": "vite",
       "build": "vite build",
       "preview": "vite preview"
     },
     "dependencies": {
       "react": "^18.3.1",
       "react-dom": "^18.3.1"
     },
     "devDependencies": {
       "@types/react": "^18.3.18",
       "@types/react-dom": "^18.3.5",
       "@vitejs/plugin-react": "^5.0.0",
       "autoprefixer": "^10.4.20",
       "postcss": "^8.4.47",
       "tailwindcss": "^3.4.14",
       "typescript": "^5.7.2",
       "vite": "^7.1.7"
     }
   }

⚠️  NOTE: These exact versions are tested and working


🎨 6. STYLING REQUIREMENTS (Tailwind CSS)
───────────────────────────────────────────────────────────────────
✅ USE TAILWIND CSS for ALL styling:
   - Use utility classes: className="flex items-center gap-4"
   - Use modern gradients: bg-gradient-to-r from-blue-500 to-purple-600
   - Use shadows: shadow-lg shadow-xl
   - Use responsive: md:flex-row lg:max-w-4xl

✅ REQUIRED in src/index.css:
   @tailwind base;
   @tailwind components;
   @tailwind utilities;

❌ FORBIDDEN:
   - NO separate CSS modules (*.module.css)
   - NO styled-components
   - NO inline <style> tags
   - Use Tailwind utilities only


⚙️  7. TYPESCRIPT RULES (Type safety)
───────────────────────────────────────────────────────────────────
✅ REQUIREMENTS:
   - ALL components must have TypeScript (.tsx extension)
   - Define interfaces for ALL props
   - Use type inference where possible
   - NO "any" types (use "unknown" if needed)
   - Enable strict mode in tsconfig.json

✅ EXAMPLE:
   interface ButtonProps {
     onClick: () => void;
     children: React.ReactNode;
     variant?: "primary" | "secondary";
   }
   
   export function Button({ onClick, children, variant = "primary" }: ButtonProps) {
     return <button onClick={onClick}>{children}</button>;
   }


🔧 8. REACT BEST PRACTICES (Modern patterns)
───────────────────────────────────────────────────────────────────
✅ REQUIRED PATTERNS:
   - Use functional components ONLY (no classes)
   - Use hooks: useState, useEffect, useCallback, useMemo
   - Use React 18+ features (no legacy APIs)
   - Use proper dependency arrays in useEffect/useCallback
   - Implement proper cleanup in useEffect when needed
   - Use TypeScript for all props and state

❌ FORBIDDEN:
   - Class components
   - Legacy lifecycle methods
   - PropTypes (use TypeScript instead)
   - Inline function definitions in JSX (use useCallback)


🌐 9. ACCESSIBILITY (a11y) REQUIREMENTS
───────────────────────────────────────────────────────────────────
✅ REQUIRED for ALL interactive elements:
   - Semantic HTML: <button>, <nav>, <main>, <header>, <footer>
   - ARIA labels: aria-label="Close menu"
   - Keyboard navigation: onKeyDown handlers
   - Focus management: tabIndex, autoFocus
   - Alt text for images: alt="Descriptive text"
   - Form labels: <label htmlFor="input-id">

✅ EXAMPLE:
   <button
     onClick={handleClick}
     aria-label="Add item to cart"
     className="..."
   >
     <PlusIcon aria-hidden="true" />
     Add to Cart
   </button>


📱 10. RESPONSIVE DESIGN (Mobile-first)
───────────────────────────────────────────────────────────────────
✅ REQUIREMENTS:
   - Mobile-first approach (base styles for mobile)
   - Use Tailwind breakpoints: sm: md: lg: xl: 2xl:
   - Test at viewport widths: 320px, 768px, 1024px, 1920px
   - Use responsive typography: text-base md:text-lg lg:text-xl
   - Use responsive spacing: p-4 md:p-6 lg:p-8
   - Make touch targets at least 44x44px

✅ EXAMPLE:
   <div className="
     flex flex-col md:flex-row
     gap-4 md:gap-6 lg:gap-8
     p-4 md:p-6 lg:p-8
     max-w-sm md:max-w-2xl lg:max-w-4xl
   ">


🎯 11. FUNCTIONAL REQUIREMENTS (Complete & Working)
───────────────────────────────────────────────────────────────────
✅ EVERY APP MUST:
   - Be fully functional (no placeholder code)
   - Include realistic sample data
   - Implement ALL requested features
   - Handle loading states
   - Handle error states
   - Include proper form validation (if forms present)
   - Persist data if appropriate (localStorage)
   - Work offline if possible (PWA features)

❌ FORBIDDEN:
   - Placeholder text like "TODO: implement this"
   - Empty functions that do nothing
   - Fake API calls without fallbacks
   - Missing error handling


🔐 12. SECURITY & DATA HANDLING
───────────────────────────────────────────────────────────────────
✅ REQUIREMENTS:
   - Validate ALL user input
   - Sanitize data before rendering (React handles most XSS)
   - Use environment variables for sensitive data
   - Never expose API keys in frontend code
   - Implement proper error boundaries
   - Use HTTPS for all API calls (in production)

✅ EXAMPLE:
   const sanitizeInput = (input: string): string => {
     return input.trim().replace(/[<>]/g, '''');
   };


⚡ 13. PERFORMANCE OPTIMIZATION
───────────────────────────────────────────────────────────────────
✅ BEST PRACTICES:
   - Use React.memo() for expensive components
   - Use useCallback() for functions passed as props
   - Use useMemo() for expensive calculations
   - Lazy load routes: const About = lazy(() => import(''./About''))
   - Optimize images: use WebP format, lazy loading
   - Code split large bundles
   - Avoid unnecessary re-renders

✅ EXAMPLE:
   const MemoizedComponent = React.memo(({ data }: Props) => {
     const processedData = useMemo(() => {
       return expensiveOperation(data);
     }, [data]);
     
     return <div>{processedData}</div>;
   });


🎨 14. UI/UX REQUIREMENTS (Professional quality)
───────────────────────────────────────────────────────────────────
✅ DESIGN PRINCIPLES:
   - Modern, clean interface
   - Consistent spacing (use Tailwind scale: 4, 8, 16, 24, 32)
   - Proper visual hierarchy (size, weight, color)
   - Loading states (spinners, skeletons)
   - Empty states (friendly messages)
   - Error states (clear, actionable messages)
   - Success feedback (toasts, checkmarks)
   - Smooth transitions (transition-all duration-200)
   - Hover states for interactive elements

✅ COLOR PALETTE (Use Tailwind):
   - Primary: blue-500 to blue-600
   - Secondary: gray-500 to gray-600
   - Success: green-500 to green-600
   - Warning: yellow-500 to yellow-600
   - Error: red-500 to red-600
   - Background: gray-50 to gray-100
   - Text: gray-900 (primary), gray-600 (secondary)


🧪 15. CODE QUALITY STANDARDS
───────────────────────────────────────────────────────────────────
✅ REQUIREMENTS:
   - DRY: Don''t Repeat Yourself
   - Single Responsibility Principle
   - Clear, descriptive naming
   - Maximum function length: ~50 lines
   - Maximum file length: ~300 lines
   - Extract complex logic into utilities
   - Comment complex algorithms only
   - No console.log in production code (use proper logging)

❌ CODE SMELLS TO AVOID:
   - God objects (components doing too much)
   - Deep nesting (>3 levels)
   - Magic numbers (use named constants)
   - Unclear variable names (x, temp, data)
   - Commented-out code


═══════════════════════════════════════════════════════════════════
✅ FINAL CHECKLIST BEFORE SUBMITTING:
═══════════════════════════════════════════════════════════════════

□ Output is valid JSON array [{"path": "...", "content": "..."}]
□ Starts with [ and ends with ] (no markdown)
□ src/App.tsx uses default export
□ src/components/*.tsx use named exports
□ No {; or (; or interface Name {; patterns
□ No ternary semicolons (? x; : y)
□ All imports have corresponding files
□ All required config files included
□ TypeScript interfaces defined for all props
□ Tailwind CSS used for all styling
□ Fully functional (no TODOs or placeholders)
□ Responsive design implemented
□ Accessibility attributes added
□ Error handling implemented
□ Professional UI/UX

═══════════════════════════════════════════════════════════════════
🎯 REMEMBER: This is the SINGLE SOURCE OF TRUTH for coding standards.
   NO other prompts should contradict these rules.
═══════════════════════════════════════════════════════════════════
';

  -- Update code_generator agents
  UPDATE agents
  SET 
    system_prompt = CASE 
      WHEN system_prompt IS NULL OR system_prompt = '' THEN comprehensive_rules
      ELSE system_prompt || E'\n\n' || comprehensive_rules
    END,
    updated_at = NOW()
  WHERE 
    (id LIKE '%code-generator%' 
    OR id LIKE 'code_generator%'
    OR id = 'code-generator')
    AND (system_prompt IS NULL OR system_prompt NOT LIKE '%COMPREHENSIVE CODING RULES%');

  -- Update component-developer agents
  UPDATE agents
  SET 
    system_prompt = CASE 
      WHEN system_prompt IS NULL OR system_prompt = '' THEN comprehensive_rules
      ELSE system_prompt || E'\n\n' || comprehensive_rules
    END,
    updated_at = NOW()
  WHERE 
    (id LIKE '%component-developer%'
    OR id LIKE 'component_developer%'
    OR id = 'component-developer')
    AND (system_prompt IS NULL OR system_prompt NOT LIKE '%COMPREHENSIVE CODING RULES%');

  -- Update prompt_templates for code generation
  UPDATE prompt_templates
  SET 
    system_prompt = CASE 
      WHEN system_prompt IS NULL OR system_prompt = '' THEN comprehensive_rules
      ELSE system_prompt || E'\n\n' || comprehensive_rules
    END,
    updated_at = NOW()
  WHERE 
    agent_type IN ('code_generator', 'component_developer', 'component_architect')
    AND prompt_type = 'code_generation'
    AND (system_prompt IS NULL OR system_prompt NOT LIKE '%COMPREHENSIVE CODING RULES%');

  -- Log results
  RAISE NOTICE '===================================================================';
  RAISE NOTICE '  COMPREHENSIVE CODING RULES MIGRATION COMPLETED';
  RAISE NOTICE '===================================================================';
  RAISE NOTICE '  * Updated code generation agent system prompts';
  RAISE NOTICE '  * Centralized ALL coding rules in database';
  RAISE NOTICE '  * Resolved prompt collision architectural issue';
  RAISE NOTICE '===================================================================';
  
END $$;

-- Verification query (run this to check the update)
-- SELECT id, length(system_prompt) as prompt_length, 
--        system_prompt LIKE '%COMPREHENSIVE CODING RULES%' as has_rules
-- FROM agents 
-- WHERE id LIKE '%code%' OR id LIKE '%component%';


-- Migration: Fix CSS Variable Rules in Agent Prompts
-- Created: 2025-12-04
-- Purpose: Prevent AI from generating CSS that uses undefined CSS variables
--          like `border-border`, `bg-background`, `text-foreground` which are
--          shadcn/ui patterns requiring specific CSS variable definitions.

DO $$
DECLARE
  css_fix_rules TEXT;
BEGIN
  
  css_fix_rules := '

===================================================================
🎨 CSS VARIABLE SAFETY RULES (CRITICAL - App will break if violated)
===================================================================

❌ FORBIDDEN CSS PATTERNS (cause "class does not exist" errors):

These patterns require CSS variables that are NOT set up by default:

   ❌ @apply border-border;           // Requires --border variable
   ❌ @apply bg-background;           // Requires --background variable  
   ❌ @apply text-foreground;         // Requires --foreground variable
   ❌ @apply bg-card;                 // Requires --card variable
   ❌ @apply text-card-foreground;    // Requires --card-foreground variable
   ❌ @apply bg-muted;                // Requires --muted variable
   ❌ @apply text-muted-foreground;   // Requires --muted-foreground variable
   ❌ @apply bg-primary;              // Requires --primary variable (shadcn style)
   ❌ @apply text-primary-foreground; // Requires --primary-foreground variable
   ❌ @apply bg-secondary;            // Requires --secondary variable (shadcn style)
   ❌ @apply bg-destructive;          // Requires --destructive variable
   ❌ @apply ring-ring;               // Requires --ring variable
   ❌ @apply border-input;            // Requires --input variable

✅ CORRECT ALTERNATIVES - Use standard Tailwind classes:

   ✅ @apply border-gray-200;         // Standard Tailwind
   ✅ @apply bg-white;                // Standard Tailwind
   ✅ @apply text-gray-900;           // Standard Tailwind
   ✅ @apply bg-gray-50;              // Standard Tailwind
   ✅ @apply text-gray-500;           // Standard Tailwind

✅ CORRECT src/index.css (SIMPLE - works everywhere):

   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   
   body {
     margin: 0;
     font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
     -webkit-font-smoothing: antialiased;
   }

   /* Optional: Add custom layers with REAL Tailwind classes */
   @layer base {
     h1 { @apply text-2xl font-bold; }
     h2 { @apply text-xl font-semibold; }
   }

❌ BROKEN src/index.css (shadcn/ui pattern without setup):

   @layer base {
     * {
       @apply border-border;  // ❌ FAILS - border-border not defined
     }
     body {
       @apply bg-background text-foreground;  // ❌ FAILS
     }
   }

🔍 WHY THIS MATTERS:
   - These CSS variable patterns are from shadcn/ui component library
   - They require a complete CSS variable setup in :root {}
   - Without the variables, Tailwind throws "class does not exist" error
   - The app will completely fail to load

✅ WHEN YOU CAN USE CSS VARIABLES:
   Only if you ALSO generate the CSS variable definitions in your index.css:
   
   :root {
     --background: 0 0% 100%;
     --foreground: 222.2 84% 4.9%;
     --border: 214.3 31.8% 91.4%;
     /* ... all other variables ... */
   }
   
   .dark {
     --background: 222.2 84% 4.9%;
     --foreground: 210 40% 98%;
     /* ... all other variables ... */
   }

📋 SAFE INDEX.CSS TEMPLATE:

   @tailwind base;
   @tailwind components;
   @tailwind utilities;

   body {
     margin: 0;
     min-height: 100vh;
     font-family: system-ui, -apple-system, BlinkMacSystemFont, ''Segoe UI'', 
       Roboto, ''Helvetica Neue'', Arial, sans-serif;
     -webkit-font-smoothing: antialiased;
     -moz-osx-font-smoothing: grayscale;
   }

   #root {
     min-height: 100vh;
   }

===================================================================
';

  -- Update all code generation agents with the CSS fix rules
  UPDATE agents
  SET 
    system_prompt = CASE 
      WHEN system_prompt IS NULL OR system_prompt = '' THEN css_fix_rules
      ELSE system_prompt || E'\n' || css_fix_rules
    END,
    updated_at = NOW()
  WHERE 
    (id LIKE '%code%' OR id LIKE '%component%' OR id LIKE '%developer%' OR id LIKE '%stylist%')
    AND is_active = true
    AND (system_prompt IS NULL OR system_prompt NOT LIKE '%CSS VARIABLE SAFETY RULES%');

  -- Update prompt_templates as well
  UPDATE prompt_templates
  SET 
    system_prompt = CASE 
      WHEN system_prompt IS NULL OR system_prompt = '' THEN css_fix_rules
      ELSE system_prompt || E'\n' || css_fix_rules
    END,
    updated_at = NOW()
  WHERE 
    agent_type IN ('code_generator', 'component_developer', 'component_architect', 'component_stylist')
    AND (system_prompt IS NULL OR system_prompt NOT LIKE '%CSS VARIABLE SAFETY RULES%');

  RAISE NOTICE '===================================================================';
  RAISE NOTICE '  CSS VARIABLE SAFETY RULES MIGRATION COMPLETED';
  RAISE NOTICE '===================================================================';
  RAISE NOTICE '  * Forbids undefined CSS variable patterns (border-border, etc.)';
  RAISE NOTICE '  * Provides safe Tailwind alternatives';
  RAISE NOTICE '  * Includes safe index.css template';
  RAISE NOTICE '===================================================================';
  
END $$;


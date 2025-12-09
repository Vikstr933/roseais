-- Migration: Update Agent Prompts to Prevent Ternary Operator Syntax Errors
-- Created: 2025-12-03
-- Purpose: Add explicit warnings about ternary operator semicolon errors to all code generation agent prompts

-- Update agents table system prompts to include ternary operator warnings
UPDATE agents
SET 
  system_prompt = system_prompt || E'\n\n' || 
'🚨 CRITICAL: TERNARY OPERATOR SYNTAX RULES 🚨
❌ NEVER put semicolons before the colon in ternary operators:
   WRONG: const x = condition ? value; : otherValue
   WRONG: const x = condition ? (nested ? ''a'' : ''b''); : ''c''
✅ CORRECT: const x = condition ? value : otherValue
✅ CORRECT: const x = condition ? (nested ? ''a'' : ''b'') : ''c''

BEFORE submitting code, search for "? ...; :" patterns and remove the semicolon.',
  updated_at = NOW()
WHERE 
  (system_prompt IS NOT NULL AND system_prompt != '')
  AND (
    id LIKE '%component-developer%' 
    OR id LIKE '%code-generator%'
    OR id LIKE '%component-architect%'
    OR id LIKE '%component-qa%'
    OR id IN ('component-developer', 'component-architect', 'component-qa', 'code-generator')
  )
  AND system_prompt NOT LIKE '%TERNARY OPERATOR SYNTAX RULES%'; -- Avoid duplicate updates

-- Update prompt_templates table for code generation prompts
UPDATE prompt_templates
SET 
  system_prompt = system_prompt || E'\n\n' || 
'🚨 CRITICAL: TERNARY OPERATOR SYNTAX RULES 🚨
❌ NEVER put semicolons before the colon in ternary operators:
   WRONG: const x = condition ? value; : otherValue
   WRONG: const x = condition ? (nested ? ''a'' : ''b''); : ''c''
✅ CORRECT: const x = condition ? value : otherValue
✅ CORRECT: const x = condition ? (nested ? ''a'' : ''b'') : ''c''

BEFORE submitting code, search for "? ...; :" patterns and remove the semicolon.',
  updated_at = NOW()
WHERE 
  agent_type IN ('code_generator', 'component_developer', 'component_architect')
  AND prompt_type = 'code_generation'
  AND system_prompt NOT LIKE '%TERNARY OPERATOR SYNTAX RULES%'; -- Avoid duplicate updates

-- Log the update
DO $$
DECLARE
  agents_updated INTEGER;
  prompts_updated INTEGER;
BEGIN
  SELECT COUNT(*) INTO agents_updated
  FROM agents
  WHERE system_prompt LIKE '%TERNARY OPERATOR SYNTAX RULES%';
  
  SELECT COUNT(*) INTO prompts_updated
  FROM prompt_templates
  WHERE system_prompt LIKE '%TERNARY OPERATOR SYNTAX RULES%';
  
  RAISE NOTICE 'Updated % agent(s) and % prompt template(s) with ternary operator syntax warnings', 
    agents_updated, prompts_updated;
END $$;


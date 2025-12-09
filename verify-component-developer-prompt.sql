-- Verify that component-developer agent has the syntax rules in its prompt
-- Run this in Supabase SQL Editor to check

SELECT 
  id,
  name,
  LENGTH(system_prompt) as prompt_length,
  -- Check if critical sections are present
  CASE 
    WHEN system_prompt LIKE '%FORBIDDEN SYNTAX PATTERNS%' THEN '✅ Has syntax rules'
    ELSE '❌ Missing syntax rules'
  END as syntax_rules_check,
  CASE 
    WHEN system_prompt LIKE '%{;%' THEN '✅ Has {; pattern warning'
    ELSE '❌ Missing {; pattern warning'
  END as brace_semicolon_check,
  CASE 
    WHEN system_prompt LIKE '%CRITICAL CHECKLIST%' THEN '✅ Has checklist'
    ELSE '❌ Missing checklist'
  END as checklist_check,
  -- Show relevant sections
  SUBSTRING(system_prompt, 
    POSITION('FORBIDDEN SYNTAX PATTERNS' IN system_prompt),
    500
  ) as syntax_rules_section,
  SUBSTRING(system_prompt, 
    POSITION('CRITICAL CHECKLIST' IN system_prompt),
    300
  ) as checklist_section
FROM agents
WHERE id = 'component-developer' AND is_active = true;

-- Also show the full prompt structure
SELECT 
  id,
  name,
  -- Count occurrences of key phrases
  (LENGTH(system_prompt) - LENGTH(REPLACE(system_prompt, 'FORBIDDEN', ''))) / LENGTH('FORBIDDEN') as forbidden_count,
  (LENGTH(system_prompt) - LENGTH(REPLACE(system_prompt, '{;', ''))) / LENGTH('{;') as brace_semicolon_count,
  (LENGTH(system_prompt) - LENGTH(REPLACE(system_prompt, 'CRITICAL CHECKLIST', ''))) / LENGTH('CRITICAL CHECKLIST') as checklist_count,
  -- Show first 500 chars
  LEFT(system_prompt, 500) as first_500_chars,
  -- Show last 500 chars
  RIGHT(system_prompt, 500) as last_500_chars
FROM agents
WHERE id = 'component-developer' AND is_active = true;


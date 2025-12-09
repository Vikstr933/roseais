-- Inspect ALL prompts in the system to find where syntax errors are coming from
-- Run this in Supabase SQL Editor

-- 1. Check component-developer agent prompt (the one generating code)
SELECT 
  id,
  name,
  LENGTH(system_prompt) as prompt_length,
  -- Check if syntax rules are present
  CASE 
    WHEN system_prompt LIKE '%FORBIDDEN SYNTAX%' THEN '✅ Has syntax rules'
    WHEN system_prompt LIKE '%{;%' THEN '⚠️ Mentions {; pattern'
    ELSE '❌ Missing syntax rules'
  END as syntax_rules_status,
  -- Check position of syntax rules (should be at top)
  CASE 
    WHEN POSITION('FORBIDDEN SYNTAX' IN system_prompt) < 500 THEN '✅ Rules at top'
    WHEN POSITION('FORBIDDEN SYNTAX' IN system_prompt) > 0 THEN '⚠️ Rules in middle'
    ELSE '❌ No rules found'
  END as rules_position,
  -- Show first 1000 chars (where syntax rules should be)
  LEFT(system_prompt, 1000) as first_1000_chars,
  -- Show last 500 chars (check if old prompt is still there)
  RIGHT(system_prompt, 500) as last_500_chars
FROM agents
WHERE id = 'component-developer' AND is_active = true;

-- 2. Check component-architect agent prompt (used for analysis)
SELECT 
  id,
  name,
  LENGTH(system_prompt) as prompt_length,
  LEFT(system_prompt, 500) as first_500_chars
FROM agents
WHERE id = 'component-architect' AND is_active = true;

-- 3. Check ALL active agents
SELECT 
  id,
  name,
  role,
  LENGTH(system_prompt) as prompt_length,
  CASE 
    WHEN system_prompt LIKE '%{;%' THEN '⚠️ Contains {; mention'
    ELSE '✅ No {; mention'
  END as has_brace_semicolon_mention,
  CASE 
    WHEN system_prompt LIKE '%return (;%' THEN '⚠️ Contains return (; mention'
    ELSE '✅ No return (; mention'
  END as has_return_paren_mention,
  LEFT(system_prompt, 300) as preview
FROM agents
WHERE is_active = true
ORDER BY id;

-- 4. Check for conflicting instructions in component-developer prompt
-- Look for patterns that might encourage semicolons after braces
SELECT 
  'Patterns that might cause issues:' as check_type,
  CASE WHEN system_prompt LIKE '%interface%{;%' THEN 'Found interface {; pattern' ELSE 'OK' END as interface_check,
  CASE WHEN system_prompt LIKE '%const%{;%' THEN 'Found const {; pattern' ELSE 'OK' END as const_check,
  CASE WHEN system_prompt LIKE '%return%{;%' THEN 'Found return {; pattern' ELSE 'OK' END as return_check,
  -- Check if old prompt instructions are still there (might conflict)
  CASE WHEN system_prompt LIKE '%CRITICAL - SINGLE FILE%' THEN '⚠️ Old single-file instructions present' ELSE '✅ No old instructions' END as old_instructions_check
FROM agents
WHERE id = 'component-developer' AND is_active = true;

-- 5. Count occurrences of key phrases in component-developer prompt
SELECT 
  'component-developer' as agent_id,
  (LENGTH(system_prompt) - LENGTH(REPLACE(system_prompt, 'FORBIDDEN', ''))) / LENGTH('FORBIDDEN') as forbidden_count,
  (LENGTH(system_prompt) - LENGTH(REPLACE(system_prompt, '{;', ''))) / LENGTH('{;') as brace_semicolon_mentions,
  (LENGTH(system_prompt) - LENGTH(REPLACE(system_prompt, 'return (;', ''))) / LENGTH('return (;') as return_paren_mentions,
  (LENGTH(system_prompt) - LENGTH(REPLACE(system_prompt, 'CRITICAL', ''))) / LENGTH('CRITICAL') as critical_count,
  (LENGTH(system_prompt) - LENGTH(REPLACE(system_prompt, 'JSON', ''))) / LENGTH('JSON') as json_mentions
FROM agents
WHERE id = 'component-developer' AND is_active = true;


-- Inspect all active agents to see which ones need clean prompts
-- Run this in Supabase SQL Editor

-- 1. List all active agents with their basic info
SELECT 
  id,
  name,
  role,
  LENGTH(system_prompt) as prompt_length,
  model,
  temperature,
  is_active,
  LEFT(system_prompt, 200) as prompt_preview
FROM agents
WHERE is_active = true
ORDER BY id;

-- 2. Check which agents generate code (these need syntax focus)
SELECT 
  id,
  name,
  CASE 
    WHEN system_prompt LIKE '%JSON%' OR system_prompt LIKE '%json%' THEN '✅ Generates code (JSON output)'
    WHEN system_prompt LIKE '%markdown%' OR system_prompt LIKE '%analysis%' THEN '📝 Analysis/planning (Markdown)'
    ELSE '❓ Unknown output type'
  END as agent_type,
  CASE 
    WHEN system_prompt LIKE '%{;%' OR system_prompt LIKE '%FORBIDDEN%' OR system_prompt LIKE '%CRITICAL%' THEN '⚠️ Has warning fatigue'
    ELSE '✅ Clean prompt'
  END as prompt_health,
  LENGTH(system_prompt) as prompt_length
FROM agents
WHERE is_active = true
ORDER BY id;

-- 3. Check component-architect (used for planning/analysis)
SELECT 
  id,
  name,
  'component-architect' as agent_id,
  LENGTH(system_prompt) as prompt_length,
  LEFT(system_prompt, 500) as first_500_chars,
  RIGHT(system_prompt, 300) as last_300_chars
FROM agents
WHERE id = 'component-architect' AND is_active = true;

-- 4. Check component-qa (quality assurance)
SELECT 
  id,
  name,
  'component-qa' as agent_id,
  LENGTH(system_prompt) as prompt_length,
  LEFT(system_prompt, 500) as first_500_chars
FROM agents
WHERE id = 'component-qa' AND is_active = true;

-- 5. Show all agents and identify code-generating ones
SELECT 
  id,
  name,
  role,
  CASE 
    WHEN id LIKE '%developer%' OR id LIKE '%generator%' OR id LIKE '%code%' THEN '🔧 Code Generator - Needs clean syntax prompt'
    WHEN id LIKE '%architect%' OR id LIKE '%analyst%' OR id LIKE '%analysis%' THEN '📋 Planner - Needs clean analysis prompt'
    WHEN id LIKE '%qa%' OR id LIKE '%test%' OR id LIKE '%review%' THEN '✅ QA - Needs focused review prompt'
    ELSE '❓ Other'
  END as recommended_treatment
FROM agents
WHERE is_active = true
ORDER BY id;


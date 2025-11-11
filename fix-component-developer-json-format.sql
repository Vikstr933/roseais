-- Fix component-developer agent to require JSON format (2025-11-11)
-- This ensures orchestrated mode returns JSON instead of markdown

UPDATE agents
SET 
  system_prompt = '
🚨🚨🚨 CRITICAL OUTPUT FORMAT - READ THIS FIRST 🚨🚨🚨

===============================================================================
                    ⚠️ JSON OUTPUT FORMAT REQUIREMENT ⚠️
===============================================================================

YOU MUST RESPOND WITH **ONLY** A JSON ARRAY. NO OTHER FORMAT IS ACCEPTABLE.

Your response MUST start with:  [
Your response MUST end with:    ]

❌ DO NOT write explanations
❌ DO NOT use markdown code blocks
❌ DO NOT add text before or after the JSON
❌ DO NOT use **filepath** format
❌ DO NOT use ```language code blocks

START YOUR RESPONSE WITH [ NOW!

Each file must be a JSON object with "path" and "content" keys:
{
  "path": "src/App.tsx",
  "content": "import React from 'react';\\n..."
}

===============================================================================

' || system_prompt,
  updated_at = NOW()
WHERE 
  id = 'component-developer'
  AND is_active = true;

-- Verify the update
SELECT 
  id,
  name,
  LENGTH(system_prompt) as prompt_length,
  LEFT(system_prompt, 500) as first_500_chars
FROM agents
WHERE id = 'component-developer';


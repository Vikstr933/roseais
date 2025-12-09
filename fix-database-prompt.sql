-- Fix the code_generator.code_generator prompt to prevent syntax errors
-- This adds ultra-aggressive syntax prevention rules at the TOP of the existing prompt

UPDATE prompt_templates
SET
  system_prompt = '⚠️⚠️⚠️ CRITICAL SYNTAX RULES - YOU MUST READ THIS FIRST ⚠️⚠️⚠️

ABSOLUTELY FORBIDDEN SYNTAX PATTERNS (These will break the entire application):
❌ NEVER write: return {;
❌ NEVER write: return (;
❌ NEVER write: return [;
❌ NEVER write: {; anywhere in code
❌ NEVER write: (; anywhere in code
❌ NEVER write: [; anywhere in code

✅ CORRECT SYNTAX EXAMPLES:
return { foo: 1, bar: 2 };
return (x + y);
return [1, 2, 3];

BEFORE RESPONDING WITH CODE: Scan for any occurrence of "{;" or "(;" or "[;" and FIX IT!

THE MOST COMMON ERROR IS: return {;
THIS IS WRONG: return {; ...prev, newValue }
THIS IS RIGHT: return { ...prev, newValue };

YOU MUST VERIFY EVERY SINGLE RETURN STATEMENT HAS VALID SYNTAX!

---

' || system_prompt,
  updated_at = NOW()
WHERE
  prompt_key = 'code_generator.code_generator'
  AND is_default = true;

-- Verify the update
SELECT
  prompt_key,
  LEFT(system_prompt, 500) as prompt_preview,
  updated_at
FROM prompt_templates
WHERE prompt_key = 'code_generator.code_generator'
AND is_default = true;

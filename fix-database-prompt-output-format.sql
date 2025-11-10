-- Fix database prompt to include explicit JSON output format instructions
-- This ensures the AI returns properly formatted JSON that can be parsed

UPDATE prompt_templates
SET
  system_prompt = system_prompt || E'\n\n# 🎯 OUTPUT FORMAT - CRITICAL!\n\n**YOU MUST RESPOND WITH A JSON ARRAY** containing all files.\n\n**Required Format:**\n```json\n[\n  {\n    "path": "src/App.tsx",\n    "content": "import React from \'react\'\\n\\nexport default function App() {\\n  return <div>Hello</div>;\\n}"\n  },\n  {\n    "path": "src/main.tsx",\n    "content": "import React from \'react\'\\nimport ReactDOM from \'react-dom/client\'\\n..."\n  },\n  {\n    "path": "src/index.css",\n    "content": "@tailwind base;\\n@tailwind components;\\n..."\n  }\n]\n```\n\n**CRITICAL RULES:**\n1. ✅ MUST be a valid JSON array\n2. ✅ Each object MUST have "path" and "content" keys\n3. ✅ File paths MUST start with "src/" (e.g., "src/App.tsx")\n4. ✅ Escape special characters in content: \\n for newlines, \\\' for quotes\n5. ✅ Include ALL necessary files (App.tsx, main.tsx, index.css, etc.)\n6. ❌ NO markdown formatting around the JSON\n7. ❌ NO explanatory text before or after the JSON\n8. ❌ NO code comments outside the JSON\n\n**Example Valid Response:**\n```json\n[\n  {"path": "src/App.tsx", "content": "export default function App() {\\n  return <div>App</div>;\\n}"},\n  {"path": "src/main.tsx", "content": "import React from \'react\';\\nimport ReactDOM from \'react-dom/client\';\\nimport App from \'./App\';\\nimport \'./index.css\';\\n\\nReactDOM.createRoot(document.getElementById(\'root\')!).render(<App />);"},\n  {"path": "src/index.css", "content": "@tailwind base;\\n@tailwind components;\\n@tailwind utilities;"}\n]\n```\n\n**RESPOND WITH THE JSON ARRAY ONLY - NOTHING ELSE!**',
  updated_at = NOW()
WHERE
  prompt_key = 'code_generator.code_generator'
  AND is_default = true;

-- Verify the update
SELECT
  prompt_key,
  LENGTH(system_prompt) as prompt_length,
  updated_at,
  CASE
    WHEN system_prompt LIKE '%OUTPUT FORMAT%' THEN 'âœ… Output format instructions added'
    ELSE 'âŒ Update failed'
  END as status
FROM prompt_templates
WHERE prompt_key = 'code_generator.code_generator'
AND is_default = true;

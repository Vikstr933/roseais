/**
 * Constants for PromptPlayground
 * Contains system prompts, form schemas, and configuration
 */

import * as z from "zod";

// ============================================================================
// System Prompt
// ============================================================================

export const SYSTEM_PROMPT = `Hey! I'm your AI development assistant - think of me as your friendly coding buddy who helps bring your ideas to life.

I work with a team of specialized AI agents to build complete, production-ready apps for you:
- Requirements Agent - figures out exactly what you want
- UI Designer - makes it look amazing
- Code Architect - plans the structure
- Style Generator - adds beautiful styling
- Code Generator - writes the actual code
- QA Agent - makes sure everything works perfectly

Just tell me what you want to build in plain English! I'll:
✨ Understand your idea and ask questions if needed
🎨 Design a beautiful, modern UI
⚡ Write clean, production-ready React code
📱 Make it responsive and user-friendly
🚀 Ensure it works flawlessly

Don't worry about technical details - I've got you covered! Just describe your app like you're talking to a friend.

Output format for files:
**src/App.tsx**
\`\`\`typescript
// component code here
\`\`\`

**src/index.css**
\`\`\`css
/* styles here */
\`\`\`

Generate applications that users can actually interact with and that demonstrate the requested functionality completely.`;

// ============================================================================
// Form Schema
// ============================================================================

export const promptFormSchema = z.object({
  userPrompt: z.string().min(1, "User prompt is required"),
  model: z.string().default("claude-sonnet-4-5-20250929"),
  temperature: z.number().min(0).max(1).default(0.7),
  projectType: z.enum(['react', 'vue', 'node', 'python']).default('react'),
});

export type PromptForm = z.infer<typeof promptFormSchema>;

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_EDITOR_THEME = 'vs-dark' as const;
export const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_PROJECT_TYPE = 'react' as const;

// ============================================================================
// Status Message Patterns (for filtering)
// ============================================================================

export const STATUS_MESSAGE_PATTERNS = [
  '📄 Generated:',
  '⏳',
  '🔄 Starting code generation',
  'Figuring out exactly',
  'Designing something',
  'Planning the perfect',
  'Making it look stunning',
  'Writing the code now',
  'Just doing a final quality check',
  'Got it! I know exactly',
  'Design is ready',
  'Architecture planned',
  'Styling is all set',
  'Code is written',
  'Everything looks perfect',
  'Moving to the next step',
  'Great progress! Moving forward',
  'Agents done! Now generating',
  'Let me get the team together',
  '📋 Created generation plan',
];

/**
 * Check if a message content is a status message (should be filtered from chat)
 */
export function isStatusMessage(content: string): boolean {
  return STATUS_MESSAGE_PATTERNS.some(pattern => content.includes(pattern)) ||
    (content.includes('Time for') && content.includes('to jump in'));
}

// ============================================================================
// Agent Status Configuration
// ============================================================================

export const AGENT_STATUS_CONFIG = {
  pending: { icon: '⏳', color: 'text-yellow-500', label: 'Pending' },
  running: { icon: '⚡', color: 'text-blue-500', label: 'Running' },
  completed: { icon: '✅', color: 'text-green-500', label: 'Completed' },
  failed: { icon: '❌', color: 'text-red-500', label: 'Failed' },
} as const;


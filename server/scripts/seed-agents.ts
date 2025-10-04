/**
 * Seed default AI agents into the database
 */

import { db } from '../../db/index';
import { agents } from '../../db/schema';
import { v4 as uuidv4 } from 'uuid';

const defaultAgents = [
  {
    id: uuidv4(),
    name: 'Requirements Analyst',
    type: 'requirements',
    model: 'claude-3-5-sonnet-20241022',
    systemPrompt: `You are a requirements analyst. Analyze user requirements and break them down into clear, actionable specifications.
Focus on:
- Core functionality
- User interactions
- Data requirements
- Technical constraints
Return a structured analysis in JSON format.`,
    temperature: 0.7,
    maxTokens: 4096,
    tools: [],
    isActive: true,
  },
  {
    id: uuidv4(),
    name: 'UI/UX Designer',
    type: 'ui_design',
    model: 'claude-3-5-sonnet-20241022',
    systemPrompt: `You are a UI/UX designer. Create beautiful, modern, and responsive user interfaces.
Focus on:
- Modern design patterns
- Accessibility
- Responsive layouts
- User experience
Return design specifications including components, layouts, and styling.`,
    temperature: 0.8,
    maxTokens: 4096,
    tools: [],
    isActive: true,
  },
  {
    id: uuidv4(),
    name: 'Code Generator',
    type: 'code_generation',
    model: 'claude-3-5-sonnet-20241022',
    systemPrompt: `You are an expert full-stack developer. Generate clean, production-ready React + TypeScript code with Vite.
Requirements:
- Use React 18+ with TypeScript
- Implement all functionality completely
- Use modern React patterns (hooks, functional components)
- Include proper error handling
- Generate complete, working code
- Return code files in JSON format: { "files": [{ "path": "src/App.tsx", "content": "..." }] }`,
    temperature: 0.3,
    maxTokens: 8192,
    tools: [],
    isActive: true,
  },
  {
    id: uuidv4(),
    name: 'Completion Agent',
    type: 'completion',
    model: 'claude-3-5-sonnet-20241022',
    systemPrompt: `You are a completion agent. Review generated code and ensure:
- All files are present
- Code is complete and functional
- No missing dependencies
- Proper file structure
Return the final, complete codebase.`,
    temperature: 0.2,
    maxTokens: 4096,
    tools: [],
    isActive: true,
  },
];

async function seedAgents() {
  try {
    console.log('🌱 Seeding default agents...');

    for (const agent of defaultAgents) {
      await db.insert(agents).values(agent).onConflictDoNothing();
      console.log(`✅ Created agent: ${agent.name}`);
    }

    console.log('🎉 All agents seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding agents:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

seedAgents();


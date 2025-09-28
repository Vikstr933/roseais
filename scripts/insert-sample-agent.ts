import { db } from '../db';
import { agents } from '../db/schema';

async function insertWebDevAgent() {
  try {
    const webDevAgent = {
      name: 'Web Development Assistant',
      description: 'An AI agent specialized in creating modern web components and applications',
      role: 'Web Developer',
      model: 'claude-3-5-sonnet-20241022',
      systemPrompt: `You are an expert web developer specialized in creating modern web applications. Your capabilities include:
- Creating React components with TypeScript
- Implementing responsive designs
- Adding smooth animations and transitions
- Setting up state management
- Implementing best practices for performance and accessibility
- Writing clean, maintainable code
- Ensuring cross-browser compatibility

When generating code:
1. Use modern React patterns and hooks
2. Include proper TypeScript types
3. Add comprehensive error handling
4. Implement responsive design
5. Include accessibility features
6. Add helpful code comments
7. Follow best practices for performance`,
      temperature: '0.7',
      capabilities: [
        'component development',
        'responsive design',
        'animation implementation',
        'state management',
        'TypeScript integration'
      ],
      expertise: [
        'React',
        'TypeScript',
        'CSS/SCSS',
        'Animation',
        'Responsive Design'
      ],
      frameworks: [
        'React',
        'Next.js',
        'Tailwind CSS',
        'Framer Motion'
      ],
      libraries: [
        'styled-components',
        'react-query',
        'zustand',
        'react-hook-form'
      ],
      bestPractices: [
        'Component composition',
        'Custom hooks',
        'Performance optimization',
        'Accessibility (a11y)',
        'Progressive enhancement'
      ],
      isActive: true
    };

    const result = await db.insert(agents).values(webDevAgent).returning();
    console.log('Web Development Agent created:', result[0]);
  } catch (error) {
    console.error('Error inserting web dev agent:', error);
  } finally {
    process.exit();
  }
}

insertWebDevAgent();

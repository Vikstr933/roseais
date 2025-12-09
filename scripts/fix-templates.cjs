const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
});

async function fixTemplates() {
  const client = await pool.connect();

  try {
    // Start transaction
    await client.query('BEGIN');

    // Clear existing templates
    await client.query('TRUNCATE prompt_templates');

    // Insert required templates
    const templates = [
      {
        name: 'Component Requirements Analysis',
        template: `You are a software requirements analyst. Analyze the following component request and provide structured requirements:

User Request: {{prompt}}

Provide:
1. Component Name: [name]
2. Core Features
3. User Interface Requirements
4. State Management Needs
5. Data Flow
6. Error Handling Requirements
7. Performance Considerations
8. Accessibility Requirements`,
        description: 'Template for analyzing component requirements',
      },
      {
        name: 'Component Architecture Design',
        template: `You are a software architect. Design the architecture for a React component based on these requirements:

{{requirements}}

Provide a detailed technical specification including:
1. Component Structure
2. Props Interface
3. State Management Approach
4. Event Handlers
5. Helper Functions
6. Sub-components (if needed)
7. External Dependencies
8. Performance Optimizations`,
        description: 'Template for designing component architecture',
      },
      {
        name: 'Component Implementation',
        template: `You are a React developer. Implement the following component based on these requirements:
{{architecture}}

Follow these guidelines:
- Use TypeScript
- Follow React best practices
- Include proper typing
- Add comments where necessary
- Ensure proper error handling
- Consider accessibility
- Optimize performance where possible`,
        description: 'Template for implementing React components',
      },
      {
        name: 'Component Testing',
        template: `You are a QA engineer. Write comprehensive tests for the following component:

{{implementation}}

Include:
1. Unit Tests
- Component rendering
- Props validation
- State management
- Event handlers
- Edge cases

2. Integration Tests
- Component interactions
- Data flow
- Side effects

3. Accessibility Tests
- ARIA attributes
- Keyboard navigation
- Screen reader compatibility

4. Performance Tests
- Render optimization
- Memory usage
- Event handler efficiency

Use React Testing Library and Jest best practices.`,
        description: 'Template for generating component tests',
      },
    ];

    // Insert templates
    for (const template of templates) {
      await client.query(
        `
        INSERT INTO prompt_templates (name, template, description, variables, category, tags, best_practices, version)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
        [
          template.name,
          template.template,
          template.description,
          {}, // empty variables object
          'component', // category
          [], // empty tags array
          {}, // empty best practices
          '1.0.0', // version
        ]
      );
    }

    // Commit transaction
    await client.query('COMMIT');

    console.log('Templates fixed successfully');

    // Verify templates
    const result = await client.query(
      'SELECT name, description FROM prompt_templates ORDER BY name'
    );
    console.log('\nCurrent templates:', result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error fixing templates:', err);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

fixTemplates().catch(console.error);

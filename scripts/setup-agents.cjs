const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
});

const agents = [
  {
    name: 'Component Architect',
    role: 'App Architect',
    description:
      'Specializes in designing component architecture and structure',
    model: 'sonnet-20241022',
    system_prompt:
      'You are an expert React component architect. Analyze requirements and design robust, scalable component architectures.',
    is_active: true,
    temperature: '0.7',
    capabilities: {
      architecture_design: true,
      requirements_analysis: true,
      component_planning: true,
    },
    expertise: {
      react: 'expert',
      typescript: 'expert',
      component_design: 'expert',
    },
    frameworks: {
      react: true,
      nextjs: true,
      vite: true,
    },
    libraries: {
      'react-router': true,
      'styled-components': true,
      'material-ui': true,
    },
    best_practices: {
      'component-composition': true,
      'state-management': true,
      'performance-optimization': true,
    },
  },
  {
    name: 'Component Developer',
    role: 'Developer',
    description: 'Implements React components based on architectural designs',
    model: 'sonnet-20241022',
    system_prompt:
      'You are an expert React developer. Implement components following best practices and design patterns.',
    is_active: true,
    temperature: '0.7',
    capabilities: {
      component_implementation: true,
      code_optimization: true,
      debugging: true,
    },
    expertise: {
      react: 'expert',
      typescript: 'expert',
      frontend: 'expert',
    },
    frameworks: {
      react: true,
      vite: true,
    },
    libraries: {
      'react-query': true,
      tailwindcss: true,
      'shadcn/ui': true,
    },
    best_practices: {
      'clean-code': true,
      testing: true,
      accessibility: true,
    },
  },
  {
    name: 'Component QA',
    role: 'QA Engineer',
    description: 'Tests and validates component functionality',
    model: 'sonnet-20241022',
    system_prompt:
      'You are an expert QA engineer. Test React components thoroughly and provide detailed test results.',
    is_active: true,
    temperature: '0.7',
    capabilities: {
      testing: true,
      quality_assurance: true,
      documentation: true,
    },
    expertise: {
      'testing-library': 'expert',
      jest: 'expert',
      cypress: 'expert',
    },
    frameworks: {
      react: true,
      jest: true,
      cypress: true,
    },
    libraries: {
      '@testing-library/react': true,
      '@testing-library/user-event': true,
      'jest-dom': true,
    },
    best_practices: {
      'test-coverage': true,
      'integration-testing': true,
      'e2e-testing': true,
    },
  },
];

async function setupAgents() {
  const client = await pool.connect();

  try {
    // Start transaction
    await client.query('BEGIN');

    // Clear existing agents
    await client.query('DELETE FROM agents');

    // Insert new agents
    for (const agent of agents) {
      await client.query(
        `
        INSERT INTO agents (
          name, role, description, model, 
          system_prompt, is_active, temperature,
          capabilities, expertise, frameworks,
          libraries, best_practices
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
      `,
        [
          agent.name,
          agent.role,
          agent.description,
          agent.model,
          agent.system_prompt,
          agent.is_active,
          agent.temperature,
          agent.capabilities,
          agent.expertise,
          agent.frameworks,
          agent.libraries,
          agent.best_practices,
        ]
      );
    }

    // Commit transaction
    await client.query('COMMIT');

    console.log('Agents set up successfully');

    // Verify agents were created
    const result = await client.query('SELECT name, role FROM agents');
    console.log('\nCreated agents:', result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error setting up agents:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Add proper async handling for the main function
setupAgents()
  .catch(console.error)
  .finally(() => pool.end());

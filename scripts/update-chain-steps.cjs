const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
});

const updatedSteps = [
  {
    name: 'requirements_analysis',
    description: 'Analyze component requirements',
    agent_role: 'App Architect',
    template: 'Component Requirements Analysis',
    input_mapping: {
      prompt: 'user_prompt',
    },
    output_mapping: {
      analysis_result: 'analysis.result',
    },
    validation: {
      required_fields: ['analysis.result'],
    },
  },
  {
    name: 'architecture_design',
    description: 'Design component architecture',
    agent_role: 'App Architect',
    template: 'Component Architecture Design',
    input_mapping: {
      requirements: 'analysis.result',
    },
    output_mapping: {
      architecture: 'design.architecture',
    },
    validation: {
      required_fields: ['design.architecture'],
    },
    dependencies: ['requirements_analysis'],
  },
  {
    name: 'implementation',
    description: 'Implement component',
    agent_role: 'Developer',
    template: 'Component Implementation',
    input_mapping: {
      architecture: 'design.architecture',
    },
    output_mapping: {
      implementation_result: 'implementation.result',
    },
    validation: {
      required_fields: ['implementation.result'],
    },
    dependencies: ['architecture_design'],
  },
  {
    name: 'testing',
    description: 'Test implemented component',
    agent_role: 'QA Engineer',
    template: 'Component Testing',
    input_mapping: {
      implementation: 'implementation.result',
    },
    output_mapping: {
      test_results: 'testing.results',
    },
    validation: {
      required_fields: ['testing.results'],
    },
    dependencies: ['implementation'],
  },
];

async function updateChainSteps() {
  const client = await pool.connect();

  try {
    // Start transaction
    await client.query('BEGIN');

    // Update the steps in the component generation chain
    await client.query(
      `
      UPDATE prompt_chains 
      SET steps = $1::jsonb 
      WHERE name = 'Component Generation'
    `,
      [JSON.stringify(updatedSteps)]
    );

    console.log('Chain steps updated successfully');

    // Verify the update
    const result = await client.query(`
      SELECT steps 
      FROM prompt_chains 
      WHERE name = 'Component Generation'
    `);

    console.log('\nUpdated chain steps:', result.rows[0].steps);

    // Commit transaction
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating chain steps:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Add proper async handling for the main function
updateChainSteps()
  .catch(console.error)
  .finally(() => pool.end());

const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres'
});

async function checkTemplates() {
  try {
    await client.connect();
    
    // Check if prompt_templates table exists
    const tableResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'prompt_templates'
      );
    `);
    console.log('prompt_templates table exists:', tableResult.rows[0].exists);
    
    // If table exists, check its contents
    if (tableResult.rows[0].exists) {
      const templates = await client.query('SELECT name, description FROM prompt_templates');
      console.log('\nExisting templates:', templates.rows);
    }
    
    // Also check the steps in the component generation chain
    const chainSteps = await client.query(`
      SELECT steps 
      FROM prompt_chains 
      WHERE name = 'Component Generation'
    `);
    
    if (chainSteps.rows.length > 0) {
      console.log('\nChain steps:', chainSteps.rows[0].steps);
    }
    
  } catch (err) {
    console.error('Error checking templates:', err);
  } finally {
    await client.end();
  }
}

checkTemplates();

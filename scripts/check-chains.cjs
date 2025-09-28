const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres'
});

async function checkChains() {
  try {
    await client.connect();
    
    // Check if prompt_chains table exists
    const tableResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'prompt_chains'
      );
    `);
    console.log('prompt_chains table exists:', tableResult.rows[0].exists);
    
    // If table exists, check its contents
    if (tableResult.rows[0].exists) {
      const chains = await client.query('SELECT * FROM prompt_chains');
      console.log('\nExisting chains:', chains.rows);
    }
    
  } catch (err) {
    console.error('Error checking chains:', err);
  } finally {
    await client.end();
  }
}

checkChains();

import pg from 'pg';
const { Client } = pg;

async function inspectSchema() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres'
  });

  try {
    await client.connect();
    
    // Get table columns
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'agents'
    `);
    
    console.log('Agents table columns:');
    console.table(res.rows);
    
    // Get table constraints
    const constraints = await client.query(`
      SELECT conname, contype, conkey
      FROM pg_constraint
      WHERE conrelid = 'agents'::regclass
    `);
    
    console.log('\nAgents table constraints:');
    console.table(constraints.rows);
    
  } catch (err) {
    console.error('Error inspecting schema:', err);
  } finally {
    await client.end();
  }
}

inspectSchema();

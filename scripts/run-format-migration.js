import postgres from 'postgres';
import { promises as fs } from 'fs';
import path from 'path';

async function runMigration() {
  let sql;
  try {
    console.log('Running agent data format migration...');
    
    // Connect directly to PostgreSQL to execute raw SQL
    sql = postgres('postgresql://postgres:postgres@localhost:5432/postgres', {
      max: 1
    });
    
    const migrationPath = path.join(process.cwd(), 'drizzle/migrations/3018_ensure_agent_data_format.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');
    
    // Execute the migration
    await sql.unsafe(migrationSQL);
    
    console.log('Migration completed successfully');
    
    // Verify the results
    const agents = await sql`SELECT * FROM agents`;
    
    console.log('\nBefore transformation:');
    console.log('Raw agent data:', JSON.stringify(agents[0], null, 2));
    
    // Log specific fields we're interested in
    for (const agent of agents) {
      console.log(`\nAgent: ${agent.name}`);
      console.log('Frameworks:', agent.frameworks);
      console.log('Libraries:', agent.libraries);
      console.log('Capabilities:', agent.capabilities);
      console.log('Expertise:', agent.expertise);
      console.log('Best Practices:', agent.best_practices);
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    if (sql) {
      await sql.end();
    }
    process.exit(0);
  }
}

runMigration();

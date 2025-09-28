import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  try {
    await sql`
      DROP TABLE IF EXISTS chain_executions CASCADE;
      DROP TABLE IF EXISTS prompt_chains CASCADE;
      DROP TABLE IF EXISTS prompt_templates CASCADE;
      DROP TABLE IF EXISTS orchestration_patterns CASCADE;
      DROP TABLE IF EXISTS agent_scripts CASCADE;
      DROP TABLE IF EXISTS workspaces CASCADE;
      DROP TABLE IF EXISTS frameworks CASCADE;
      DROP TABLE IF EXISTS companies CASCADE;
      DROP TABLE IF EXISTS ai_models CASCADE;
      DROP TABLE IF EXISTS agents CASCADE;
    `;
    console.log('Tables dropped successfully');
  } catch (error) {
    console.error('Error dropping tables:', error);
    process.exit(1);
  }
  process.exit(0);
}

main();

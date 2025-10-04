import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  console.log('Testing connection with URL:', process.env.DATABASE_URL);

  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  try {
    // Try to query the database version
    const result = await sql`SELECT version();`;
    console.log('Connection successful!');
    console.log('PostgreSQL version:', result[0].version);

    // List all tables in the public schema
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `;
    console.log('\nExisting tables:');
    tables.forEach(table => console.log('-', table.table_name));
  } catch (error) {
    console.error('Connection failed:', error);
  } finally {
    await sql.end();
  }
}

testConnection();

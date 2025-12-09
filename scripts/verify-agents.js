import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';

const connectionString =
  'postgresql://postgres:postgres@localhost:5432/postgres';

async function main() {
  let sqlClient;
  try {
    sqlClient = postgres(connectionString);
    const db = drizzle(sqlClient);

    // Query agents table directly
    const result = await db.execute(sql`SELECT * FROM agents`);

    console.log('Agent Data:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (sqlClient) {
      await sqlClient.end();
    }
  }
}

main();

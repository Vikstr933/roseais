const postgres = require('postgres');
const { drizzle } = require('drizzle-orm/postgres-js');
const { agents } = require('../db/schema.js');

async function main() {
  let sql;
  try {
    // Setup database connection
    const connectionString = 'postgresql://postgres:postgres@localhost:5432/postgres';
    sql = postgres(connectionString);
    const db = drizzle(sql);

    // Query all agents
    const result = await db.select().from(agents);
    
    console.log('Agent Data:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (sql) {
      await sql.end();
    }
  }
}

main();

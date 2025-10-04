import postgres from 'postgres';

const sql = postgres({
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  username: 'postgres',
  password: 'postgres',
});

async function testConnection() {
  try {
    console.log('Attempting to connect...');
    const result = await sql`SELECT current_database(), current_user;`;
    console.log('Connection successful:', result);
  } catch (error) {
    console.error('Connection error:', error);
  } finally {
    await sql.end();
  }
}

testConnection();

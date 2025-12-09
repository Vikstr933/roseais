const path = require('path');
const fs = require('fs');
const { drizzle } = require('drizzle-orm/node-postgres');
const { Client } = require('pg');
const { migrate } = require('drizzle-orm/node-postgres/migrator');

const migrationsPath = path.join(__dirname, '../drizzle/migrations');
console.log('Migrations path:', migrationsPath);

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres',
});

(async () => {
  try {
    await client.connect();
    const db = drizzle(client);
    await migrate(db, {
      migrationsFolder: migrationsPath,
    });
    console.log('Migrations applied successfully');
  } catch (err) {
    console.error('Error applying migrations:', err);
    console.log('Migration files:', fs.readdirSync(migrationsPath));
  } finally {
    await client.end();
  }
})();

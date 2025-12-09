import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Use SQLite database file
const sqlite = new Database(path.join(process.cwd(), 'db', 'db.sqlite'));
const db = drizzle(sqlite);

async function main() {
  try {
    console.log('Starting migration...');
    await migrate(db, { migrationsFolder: './drizzle/migrations' });
    console.log('Migration complete');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();

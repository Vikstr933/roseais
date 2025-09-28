import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Use SQLite database file
const sqlite = new Database(path.join(process.cwd(), 'db', 'db.sqlite'));

// Create the db instance
export const db = drizzle(sqlite, { schema });

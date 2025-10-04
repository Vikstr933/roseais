import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Database Configuration
 * Uses PostgreSQL exclusively (Supabase)
 * 
 * Required environment variable:
 * - DATABASE_URL: PostgreSQL connection string
 */

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set in environment variables!');
  console.error('Please set DATABASE_URL in your .env file');
  process.exit(1);
}

if (!DATABASE_URL.startsWith('postgresql://') && !DATABASE_URL.startsWith('postgres://')) {
  console.error('❌ DATABASE_URL must be a PostgreSQL connection string!');
  console.error('Current value:', DATABASE_URL);
  process.exit(1);
}

console.log('🐘 Using PostgreSQL database (Supabase)');
console.log('📍 Database host:', DATABASE_URL.split('@')[1]?.split(':')[0] || 'unknown');

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  // Supabase/Neon requires SSL
  ssl: DATABASE_URL.includes('supabase.co') || DATABASE_URL.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : false,
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err);
});

// Create Drizzle instance
const db = drizzle(pool, { schema });

// Test connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Failed to connect to PostgreSQL:', err.message);
    process.exit(1);
  } else {
    console.log('✅ PostgreSQL connection successful');
    console.log('🕐 Server time:', res.rows[0].now);
  }
});

export { db, pool };

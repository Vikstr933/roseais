import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema-pg';
import * as dotenv from 'dotenv';
// Trigger reload to test Supabase connection

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

// Create PostgreSQL connection pool with optimized settings
const pool = new Pool({
  connectionString: DATABASE_URL,
  // Supabase/Neon requires SSL
  ssl: DATABASE_URL.includes('supabase.co') || DATABASE_URL.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : false,

  // Connection pool settings - optimized for performance
  min: 2,                        // Minimum number of clients (always maintained)
  max: 10,                       // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,      // Close idle clients after 30s
  connectionTimeoutMillis: 10000, // Timeout for new connections (10s)

  // Advanced pooling configuration
  allowExitOnIdle: false,         // Keep the pool alive even when all clients are idle
  maxUses: 7500,                  // Retire connections after 7500 uses (prevents memory leaks)

  // Statement timeout to prevent long-running queries
  statement_timeout: 30000,       // 30 seconds max per query

  // Query timeout for idle connections
  query_timeout: 30000,           // 30 seconds max per query execution

  // Application name for monitoring
  application_name: 'ai-code-generation-platform',
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
    console.error('⚠️  Database connection failed, but server will continue running');
    console.error('   If using Supabase: Your project may be paused. Restore it at https://supabase.com/dashboard');
    console.error('   The app will work with limited functionality (no user data persistence)');
  } else {
    console.log('✅ PostgreSQL connection successful');
    console.log('🕐 Server time:', res.rows[0].now);
  }
});

export { db, pool };

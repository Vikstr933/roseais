import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema-pg';
import * as dotenv from 'dotenv';
// Trigger reload to test Supabase connection

dotenv.config();

/**
 * Database Configuration
 *
 * ⚠️ CRITICAL: This project uses PostgreSQL ONLY
 *
 * - Database Type: PostgreSQL (NOT SQLite, NOT MySQL)
 * - Hosting: Supabase or Neon (cloud) or self-hosted
 * - Connection Library: pg (node-postgres)
 * - ORM: Drizzle ORM
 *
 * Required environment variable:
 * - DATABASE_URL: PostgreSQL connection string (must start with postgresql:// or postgres://)
 *
 * Example (Direct connection):
 * DATABASE_URL=postgresql://postgres:password@db.project.supabase.co:5432/postgres
 *
 * Example (Supabase Connection Pooling - RECOMMENDED for production):
 * DATABASE_URL=postgresql://postgres:password@db.project.supabase.co:6543/postgres?pgbouncer=true
 * 
 * Note: For Supabase, using port 6543 (connection pooling) is recommended for better
 * stability and handling of connection terminations. Port 5432 is direct connection.
 *
 * For detailed database documentation, see DATABASE.md in the project root.
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

  // Connection pool settings - keep the pool lean on Render/Supabase so short
  // mobile bursts do not spend 90s waiting behind saturated connections.
  min: 0,                        // Do not pin idle database connections
  max: Number(process.env.DB_POOL_MAX || 5),
  idleTimeoutMillis: 30000,      // Close idle clients after 30s
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
  
  // Keep-alive settings to prevent connection termination
  keepAlive: true,                        // Enable TCP keep-alive
  keepAliveInitialDelayMillis: 30000,     // Start keep-alive after 30s of inactivity

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

// Handle pool errors with reconnection logic
pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err);
  // Don't exit - let the pool handle reconnection
  // The pool will automatically remove the bad connection and create a new one
});

// Handle connection lifecycle logging. Avoid background validation queries on
// individual clients; they can queue behind application queries and contribute
// to pool pressure under mobile reconnect/load bursts.
pool.on('connect', (client) => {
  // Handle client errors
  client.on('error', (err) => {
    console.error('❌ Database client error:', err);
    // Client will be removed from pool automatically
  });
  
  // Handle client disconnection
  client.on('end', () => {
    console.warn('⚠️  Database client connection ended');
  });
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

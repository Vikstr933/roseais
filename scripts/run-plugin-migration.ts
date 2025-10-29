#!/usr/bin/env tsx
/**
 * Run Plugin System Migration
 *
 * This script runs the plugin system migration on your database.
 * It works with both local PostgreSQL and Supabase.
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import pg from 'pg';

// Load environment variables
config();

const { Pool } = pg;

async function runMigration() {
  console.log('🚀 Running Plugin System Migration...\n');

  // Read database URL from environment
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ ERROR: DATABASE_URL not found in environment variables');
    console.error('   Make sure your .env file is loaded\n');
    process.exit(1);
  }

  console.log('📍 Database:', databaseUrl.split('@')[1]?.split('/')[0] || 'Unknown');

  // Create connection pool
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('supabase.co') ? { rejectUnauthorized: false } : undefined
  });

  try {
    // Test connection
    console.log('🔌 Testing database connection...');
    const testResult = await pool.query('SELECT NOW()');
    console.log('✅ Connected successfully at:', testResult.rows[0].now);
    console.log('');

    // Read migration file
    console.log('📖 Reading migration file...');
    const migrationPath = join(process.cwd(), 'migrations', '2010_add_plugin_system_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log('✅ Migration file loaded');
    console.log('');

    // Run migration
    console.log('⚙️  Executing migration...');
    console.log('   Creating 4 tables:');
    console.log('   • plugin_configs');
    console.log('   • plugin_knowledge');
    console.log('   • plugin_actions');
    console.log('   • plugin_sync_logs');
    console.log('');

    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const verifyResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('plugin_configs', 'plugin_knowledge', 'plugin_actions', 'plugin_sync_logs')
      ORDER BY table_name
    `);

    if (verifyResult.rows.length === 4) {
      console.log('✅ All 4 plugin tables verified:');
      verifyResult.rows.forEach(row => {
        console.log(`   ✓ ${row.table_name}`);
      });
    } else {
      console.log('⚠️  Warning: Only found', verifyResult.rows.length, 'of 4 tables');
    }

    console.log('');
    console.log('🎉 Plugin system database setup complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart your server: npm run dev');
    console.log('2. Go to: http://localhost:3000/integrations');
    console.log('3. Connect your Gmail account');
    console.log('4. Start using the assistant!\n');

  } catch (error) {
    console.error('❌ Migration failed!\n');

    if (error instanceof Error) {
      console.error('Error:', error.message);

      // Provide helpful hints based on error type
      if (error.message.includes('already exists')) {
        console.error('\n💡 Tables may already exist. This is OK if you ran the migration before.');
        console.error('   To start fresh, drop the tables first:');
        console.error('   DROP TABLE IF EXISTS plugin_sync_logs, plugin_actions, plugin_knowledge, plugin_configs CASCADE;');
      } else if (error.message.includes('timeout') || error.message.includes('ENOENT')) {
        console.error('\n💡 Database connection timeout. Possible issues:');
        console.error('   • Supabase project might be paused (restore at https://supabase.com/dashboard)');
        console.error('   • Check your internet connection');
        console.error('   • Verify DATABASE_URL is correct');
      } else if (error.message.includes('permission')) {
        console.error('\n💡 Permission denied. Check that:');
        console.error('   • Your database user has CREATE TABLE permissions');
        console.error('   • You\'re connecting to the correct database');
      }
    } else {
      console.error(error);
    }

    console.error('');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

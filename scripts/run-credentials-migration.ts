#!/usr/bin/env tsx
/**
 * Run Credentials Required Migration
 *
 * This script adds the credentials_required column to user_generated_plugins table.
 * Required for AI-generated plugin credential detection system.
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import pg from 'pg';

// Load environment variables
config();

const { Pool } = pg;

async function runMigration() {
  console.log('🚀 Running Credentials Required Migration...\n');

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
    ssl: databaseUrl.includes('supabase.co') || databaseUrl.includes('neon.tech')
      ? { rejectUnauthorized: false }
      : undefined
  });

  try {
    // Test connection
    console.log('🔌 Testing database connection...');
    const testResult = await pool.query('SELECT NOW()');
    console.log('✅ Connected successfully at:', testResult.rows[0].now);
    console.log('');

    // Read migration file
    console.log('📖 Reading migration file...');
    const migrationPath = join(process.cwd(), 'migrations', '2026_add_credentials_required_to_plugins.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log('✅ Migration file loaded');
    console.log('');

    // Run migration
    console.log('⚙️  Executing migration...');
    console.log('   Adding credentials_required column to user_generated_plugins');
    console.log('');

    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!\n');

    // Verify column was added
    console.log('🔍 Verifying column...');
    const verifyResult = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'user_generated_plugins'
        AND column_name = 'credentials_required'
    `);

    if (verifyResult.rows.length > 0) {
      console.log('✅ credentials_required column verified:');
      console.log(`   Type: ${verifyResult.rows[0].data_type}`);
      console.log(`   Default: ${verifyResult.rows[0].column_default}`);
    } else {
      console.log('⚠️  Warning: credentials_required column not found');
    }

    console.log('');
    console.log('🎉 Credentials migration complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Generate an AI plugin via the Plugin Generator');
    console.log('2. Credential requirements will be auto-detected');
    console.log('3. Click "Connect" to see the dynamic credential dialog\n');

  } catch (error) {
    console.error('❌ Migration failed!\n');

    if (error instanceof Error) {
      console.error('Error:', error.message);

      // Provide helpful hints based on error type
      if (error.message.includes('already exists')) {
        console.error('\n💡 Column may already exist. This is OK if you ran the migration before.');
      } else if (error.message.includes('timeout') || error.message.includes('ENOENT')) {
        console.error('\n💡 Database connection timeout. Possible issues:');
        console.error('   • Supabase project might be paused (restore at https://supabase.com/dashboard)');
        console.error('   • Check your internet connection');
        console.error('   • Verify DATABASE_URL is correct');
      } else if (error.message.includes('permission')) {
        console.error('\n💡 Permission denied. Check that:');
        console.error('   • Your database user has ALTER TABLE permissions');
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

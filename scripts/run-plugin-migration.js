#!/usr/bin/env node

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

const { Pool } = pg;

async function runMigration() {
  console.log('🔄 Starting plugin system migration...\n');

  // Create connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Read migration file
    const migrationPath = join(__dirname, '..', 'migrations', '2010_add_plugin_system_tables.sql');
    console.log(`📄 Reading migration file: ${migrationPath}`);
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    // Connect to database
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected to database\n');

    try {
      // Start transaction
      await client.query('BEGIN');
      console.log('🔄 Running migration...\n');

      // Execute migration
      await client.query(migrationSQL);

      // Commit transaction
      await client.query('COMMIT');
      console.log('✅ Migration completed successfully!\n');

      // Verify tables were created
      console.log('🔍 Verifying tables...');
      const result = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('plugin_configs', 'plugin_knowledge', 'plugin_actions', 'plugin_sync_logs')
        ORDER BY table_name;
      `);

      if (result.rows.length === 4) {
        console.log('✅ All plugin tables created successfully:');
        result.rows.forEach(row => {
          console.log(`   - ${row.table_name}`);
        });
      } else {
        console.warn('⚠️  Warning: Some tables may not have been created');
        console.log('Tables found:', result.rows.map(r => r.table_name));
      }

    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      throw error;
    } finally {
      // Release client
      client.release();
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);

    if (error.code === '42P07') {
      console.log('\n💡 Tables may already exist. This is not necessarily an error.');
    } else if (error.code === '42P01') {
      console.log('\n💡 A referenced table does not exist. Make sure all previous migrations have been run.');
    } else {
      console.error('\nError details:', error);
    }

    process.exit(1);
  } finally {
    // Close pool
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('\n🎉 Plugin system is ready to use!');
    console.log('You can now connect Gmail and other plugins.\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });

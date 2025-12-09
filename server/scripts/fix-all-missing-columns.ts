/**
 * Add all missing columns to PostgreSQL tables
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres',
});

async function fixColumns() {
  try {
    console.log('🔧 Adding missing columns to PostgreSQL tables...');

    // Fix project_members table
    await pool.query(`
      ALTER TABLE project_members 
      ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb
    `);
    console.log('✅ Fixed project_members table');

    // Fix agents table - add all SQLite columns
    await pool.query(`
      ALTER TABLE agents
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS role TEXT,
      ADD COLUMN IF NOT EXISTS custom_instructions TEXT,
      ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS expertise JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS frameworks JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS libraries JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS best_practices JSONB DEFAULT '[]'::jsonb
    `);
    
    // Copy 'type' to 'role' for existing agents
    await pool.query(`UPDATE agents SET role = type WHERE role IS NULL`);
    console.log('✅ Fixed agents table');

    console.log('🎉 All missing columns added!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
    process.exit(0);
  }
}

fixColumns();


/**
 * Migration: Create project_members table in PostgreSQL
 * 
 * This script creates the project_members table to track users who are members of projects.
 * 
 * Run with: npx tsx server/scripts/create-project-members-table.ts
 * Or run the SQL file directly in Supabase SQL Editor: server/scripts/create-project-members-table.sql
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function createProjectMembersTable() {
  try {
    console.log('📦 Creating project_members table...');

    // Read SQL file
    const sqlPath = path.join(__dirname, 'create-project-members-table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Execute SQL
    await pool.query(sql);

    console.log('✅ Created project_members table and indexes');

    // Verify table exists
    const result = await pool.query(`
      SELECT 
        table_name, 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'project_members'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Table structure:');
    console.table(result.rows);

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

createProjectMembersTable()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });


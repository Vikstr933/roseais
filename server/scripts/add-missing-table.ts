/**
 * Add missing code_generation_sessions table to current database
 */

import { pool } from '../../db/index';

async function addMissingTable() {
  try {
    console.log('🔧 Adding code_generation_sessions table...');

    // Check if table already exists
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'code_generation_sessions'
      );
    `);

    if (checkResult.rows[0].exists) {
      console.log('✅ Table already exists, skipping...');
      process.exit(0);
    }

    // Create the table
    await pool.query(`
      CREATE TABLE code_generation_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        input_prompt TEXT NOT NULL,
        generated_code TEXT NOT NULL,
        agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL,
        status TEXT DEFAULT 'completed',
        metadata JSONB DEFAULT '{}'::jsonb
      );
    `);

    console.log('✅ code_generation_sessions table created successfully!');
    
    // Create index
    await pool.query(`
      CREATE INDEX idx_code_gen_sessions_workspace ON code_generation_sessions(workspace_id);
    `);
    
    console.log('✅ Index created');
    console.log('🎉 Done!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

addMissingTable().catch(console.error);


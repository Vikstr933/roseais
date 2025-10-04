/**
 * Migrate agents from SQLite to PostgreSQL
 */

import Database from 'better-sqlite3';
import path from 'path';
import { Pool } from 'pg';

const sqliteDb = new Database(path.join(process.cwd(), 'db', 'db.sqlite'));

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres',
});

async function migrateAgents() {
  try {
    console.log('🔄 Migrating agents from SQLite to PostgreSQL...');

    // Get all agents from SQLite
    const agents = sqliteDb.prepare(`
      SELECT * FROM agents
    `).all();

    console.log(`📊 Found ${agents.length} agents in SQLite`);

    if (agents.length === 0) {
      console.log('⚠️ No agents found in SQLite database');
      return;
    }

    // Insert each agent into PostgreSQL
    for (const agent of agents) {
      try {
        await pool.query(`
          INSERT INTO agents (
            id, name, type, model, system_prompt, temperature,
            max_tokens, tools, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            type = EXCLUDED.type,
            model = EXCLUDED.model,
            system_prompt = EXCLUDED.system_prompt,
            updated_at = CURRENT_TIMESTAMP
        `, [
          agent.id.toString(), // Convert INTEGER to TEXT
          agent.name,
          agent.role, // SQLite 'role' -> PostgreSQL 'type'
          agent.model,
          agent.system_prompt,
          parseFloat(agent.temperature) || 0.7,
          4096, // default max_tokens
          '[]', // default tools
          agent.is_active === 1
        ]);
        
        console.log(`✅ Migrated agent: ${agent.name}`);
      } catch (error) {
        console.error(`❌ Failed to migrate agent ${agent.name}:`, error.message);
      }
    }

    console.log('🎉 Agent migration completed!');

    // Verify
    const result = await pool.query('SELECT COUNT(*) FROM agents');
    console.log(`📊 PostgreSQL now has ${result.rows[0].count} agents`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    sqliteDb.close();
    await pool.end();
    process.exit(0);
  }
}

migrateAgents();


/**
 * Migration: Add discord_user_mappings table
 * 
 * This script creates the discord_user_mappings table to link Discord user IDs
 * to system user IDs, allowing Discord users to access their projects via the bot.
 * 
 * Run with: npx tsx server/scripts/add-discord-user-mappings-table.ts
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function addDiscordUserMappingsTable() {
  try {
    console.log('📦 Creating discord_user_mappings table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS discord_user_mappings (
        id SERIAL PRIMARY KEY,
        discord_user_id TEXT UNIQUE NOT NULL,
        discord_username TEXT,
        system_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        verified BOOLEAN DEFAULT false,
        verification_code TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_discord_user UNIQUE (discord_user_id),
        CONSTRAINT unique_system_user UNIQUE (system_user_id)
      )
    `);

    console.log('✅ Created discord_user_mappings table');

    // Create index for faster lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_discord_user_mappings_discord_user_id 
      ON discord_user_mappings(discord_user_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_discord_user_mappings_system_user_id 
      ON discord_user_mappings(system_user_id)
    `);

    console.log('✅ Created indexes for discord_user_mappings');

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

addDiscordUserMappingsTable()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });


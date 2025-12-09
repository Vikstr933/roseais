/**
 * Migrate users from SQLite to PostgreSQL
 */

import Database from 'better-sqlite3';
import path from 'path';
import { Pool } from 'pg';

const sqliteDb = new Database(path.join(process.cwd(), 'db', 'db.sqlite'));

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres',
});

async function migrateUsers() {
  try {
    console.log('🔄 Migrating users from SQLite to PostgreSQL...');

    // Get all users from SQLite
    const users = sqliteDb.prepare(`
      SELECT * FROM users
    `).all();

    console.log(`📊 Found ${users.length} users in SQLite`);

    if (users.length === 0) {
      console.log('⚠️ No users found in SQLite database');
      return;
    }

    // Insert each user into PostgreSQL
    for (const user of users) {
      try {
        await pool.query(`
          INSERT INTO users (
            id, username, email, display_name, password_hash,
            created_at, last_active, preferences, is_active,
            tier, stripe_customer_id, subscription_status,
            subscription_id, trial_ends_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (id) DO UPDATE SET
            username = EXCLUDED.username,
            email = EXCLUDED.email,
            last_active = CURRENT_TIMESTAMP
        `, [
          user.id,
          user.username,
          user.email,
          user.display_name || user.username,
          user.password_hash,
          new Date().toISOString(), // Replace CURRENT_TIMESTAMP with actual timestamp
          new Date().toISOString(), // Replace CURRENT_TIMESTAMP with actual timestamp
          user.preferences || '{"theme":"light","autoSave":true,"defaultLanguage":"typescript"}',
          user.is_active === 1,
          user.tier || 'free',
          user.stripe_customer_id || null,
          user.subscription_status || 'none',
          user.subscription_id || null,
          user.trial_ends_at || null
        ]);
        
        console.log(`✅ Migrated user: ${user.username}`);
      } catch (error) {
        console.error(`❌ Failed to migrate user ${user.username}:`, error.message);
      }
    }

    console.log('🎉 User migration completed!');

    // Verify
    const result = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`📊 PostgreSQL now has ${result.rows[0].count} users`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    sqliteDb.close();
    await pool.end();
    process.exit(0);
  }
}

migrateUsers();


import { db } from '../db/index.js';

async function createMissingTables() {
  try {
    console.log('Creating missing monetization tables...');

    // Create user_usage table
    console.log('Creating user_usage table...');
    await db.run(`
      CREATE TABLE IF NOT EXISTS user_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        service_name TEXT NOT NULL,
        request_type TEXT NOT NULL,
        tokens_used INTEGER NOT NULL DEFAULT 0,
        cost REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        session_id TEXT,
        metadata TEXT NOT NULL DEFAULT '{}'
      )
    `);

    // Create rate_limit_buckets table
    console.log('Creating rate_limit_buckets table...');
    await db.run(`
      CREATE TABLE IF NOT EXISTS rate_limit_buckets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bucket_type TEXT NOT NULL,
        request_count INTEGER NOT NULL DEFAULT 0,
        window_start TEXT NOT NULL,
        window_end TEXT NOT NULL,
        last_reset TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create subscription_plans table
    console.log('Creating subscription_plans table...');
    await db.run(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        tier TEXT NOT NULL,
        price REAL NOT NULL DEFAULT 0,
        stripe_price_id TEXT,
        features TEXT NOT NULL DEFAULT '{}',
        limits TEXT NOT NULL DEFAULT '{}',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if subscription plans already exist
    const existingPlans = await db.all(
      'SELECT COUNT(*) as count FROM subscription_plans'
    );
    if (existingPlans[0].count === 0) {
      // Insert default subscription plans
      console.log('Inserting default subscription plans...');
      await db.run(`
        INSERT INTO subscription_plans (name, tier, price, features, limits) VALUES 
        ('Free', 'free', 0, '{"basic_component_generation": true, "basic_chat": true}', '{"daily_requests": 10, "monthly_requests": 100}'),
        ('Pro', 'pro', 19, '{"advanced_component_generation": true, "advanced_chat": true, "custom_templates": true, "priority_support": true}', '{"daily_requests": 1000, "monthly_requests": 10000}'),
        ('Enterprise', 'enterprise', 99, '{"unlimited_generation": true, "custom_api_keys": true, "white_label": true, "dedicated_support": true}', '{"daily_requests": -1, "monthly_requests": -1}')
      `);
    } else {
      console.log('Subscription plans already exist, skipping...');
    }

    // Create indexes
    console.log('Creating indexes...');
    try {
      await db.run(
        'CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id)'
      );
      await db.run(
        'CREATE INDEX IF NOT EXISTS idx_user_usage_created_at ON user_usage(created_at)'
      );
      await db.run(
        'CREATE INDEX IF NOT EXISTS idx_user_usage_service_name ON user_usage(service_name)'
      );
      await db.run(
        'CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_user_id ON rate_limit_buckets(user_id)'
      );
      await db.run(
        'CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_bucket_type ON rate_limit_buckets(bucket_type)'
      );
      await db.run(
        'CREATE INDEX IF NOT EXISTS idx_subscription_plans_tier ON subscription_plans(tier)'
      );
      await db.run(
        'CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_active ON subscription_plans(is_active)'
      );
    } catch (error) {
      console.log('Some indexes may already exist, continuing...');
    }

    console.log('✅ Tables created successfully!');

    // Verify tables were created
    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%user%' OR name LIKE '%subscription%' OR name LIKE '%rate%')"
    );
    console.log(
      'Available tables:',
      tables.map(t => t.name)
    );
  } catch (error) {
    console.error('❌ Failed to create tables:', error);
    process.exit(1);
  }
}

// Run the script
createMissingTables()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });

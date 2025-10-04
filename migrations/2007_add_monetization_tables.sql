-- Add monetization fields to users table
ALTER TABLE users ADD COLUMN tier TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'inactive';
ALTER TABLE users ADD COLUMN subscription_id TEXT;
ALTER TABLE users ADD COLUMN trial_ends_at TEXT;

-- Create user_usage table for tracking API usage
CREATE TABLE user_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  request_type TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  session_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}'
);

-- Create rate_limit_buckets table for rate limiting
CREATE TABLE rate_limit_buckets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bucket_type TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  last_reset TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create subscription_plans table
CREATE TABLE subscription_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  tier TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  stripe_price_id TEXT,
  features TEXT NOT NULL DEFAULT '{}',
  limits TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, tier, price, features, limits) VALUES 
('Free', 'free', 0, '{"basic_component_generation": true, "basic_chat": true}', '{"daily_requests": 10, "monthly_requests": 100}'),
('Pro', 'pro', 19, '{"advanced_component_generation": true, "advanced_chat": true, "custom_templates": true, "priority_support": true}', '{"daily_requests": 1000, "monthly_requests": 10000}'),
('Enterprise', 'enterprise', 99, '{"unlimited_generation": true, "custom_api_keys": true, "white_label": true, "dedicated_support": true}', '{"daily_requests": -1, "monthly_requests": -1}');

-- Create indexes for better performance
CREATE INDEX idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX idx_user_usage_created_at ON user_usage(created_at);
CREATE INDEX idx_user_usage_service_name ON user_usage(service_name);
CREATE INDEX idx_rate_limit_buckets_user_id ON rate_limit_buckets(user_id);
CREATE INDEX idx_rate_limit_buckets_bucket_type ON rate_limit_buckets(bucket_type);
CREATE INDEX idx_subscription_plans_tier ON subscription_plans(tier);
CREATE INDEX idx_subscription_plans_is_active ON subscription_plans(is_active);

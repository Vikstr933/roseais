-- Migration: Add User-Generated Plugins System
-- Created: 2025-01-02
-- Description: Database schema for AI-powered user-generated plugin system with security controls

-- Table 1: User-generated plugins
CREATE TABLE IF NOT EXISTS user_generated_plugins (
  id SERIAL PRIMARY KEY,
  plugin_id VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  service_name VARCHAR(100) NOT NULL,

  -- Code and metadata
  generated_code TEXT NOT NULL,
  plugin_template VARCHAR(50) NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '[]',

  -- Security
  security_score INTEGER NOT NULL DEFAULT 0,
  security_issues JSONB,
  sandbox_config JSONB NOT NULL DEFAULT '{}',

  -- Status and review
  status VARCHAR(50) NOT NULL DEFAULT 'pending_review',
  -- Possible values: 'pending_review', 'approved', 'rejected', 'disabled', 'active'
  review_notes TEXT,
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP,

  -- Limits and configuration
  rate_limits JSONB NOT NULL DEFAULT '{"requestsPerMinute": 10, "requestsPerHour": 100}',
  resource_limits JSONB NOT NULL DEFAULT '{"maxMemoryMB": 128, "maxCpuSeconds": 5, "maxNetworkCalls": 10}',

  -- OAuth configuration
  requires_auth BOOLEAN NOT NULL DEFAULT false,
  auth_type VARCHAR(50),
  auth_config JSONB,

  -- Usage tracking
  install_count INTEGER DEFAULT 0,
  execution_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMP,

  -- Version control
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  changelog TEXT,

  -- Public marketplace
  is_public BOOLEAN DEFAULT false,
  marketplace_approved BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_ugp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_user_plugin_name UNIQUE(user_id, name)
);

-- Indexes for user_generated_plugins
CREATE INDEX idx_ugp_user_status ON user_generated_plugins(user_id, status);
CREATE INDEX idx_ugp_status ON user_generated_plugins(status);
CREATE INDEX idx_ugp_service ON user_generated_plugins(service_name);
CREATE INDEX idx_ugp_public ON user_generated_plugins(is_public, marketplace_approved);
CREATE INDEX idx_ugp_created ON user_generated_plugins(created_at DESC);

-- Table 2: Plugin execution logs
CREATE TABLE IF NOT EXISTS plugin_execution_logs (
  id SERIAL PRIMARY KEY,
  plugin_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  parameters JSONB,
  result JSONB,
  status VARCHAR(50) NOT NULL,
  error_message TEXT,

  -- Performance metrics
  execution_time_ms INTEGER,
  memory_used_mb FLOAT,
  network_calls INTEGER,

  -- Security
  blocked BOOLEAN DEFAULT false,
  block_reason VARCHAR(255),

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_pel_plugin FOREIGN KEY (plugin_id) REFERENCES user_generated_plugins(plugin_id) ON DELETE CASCADE,
  CONSTRAINT fk_pel_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for plugin_execution_logs
CREATE INDEX idx_pel_plugin_user ON plugin_execution_logs(plugin_id, user_id);
CREATE INDEX idx_pel_created ON plugin_execution_logs(created_at DESC);
CREATE INDEX idx_pel_status ON plugin_execution_logs(status);
CREATE INDEX idx_pel_blocked ON plugin_execution_logs(blocked) WHERE blocked = true;

-- Table 3: Plugin generation requests (audit trail)
CREATE TABLE IF NOT EXISTS plugin_generation_requests (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  prompt TEXT NOT NULL,
  service_name VARCHAR(100),
  requested_capabilities JSONB,

  -- AI Generation metrics
  tokens_used INTEGER,
  generation_time_ms INTEGER,
  model_used VARCHAR(100),

  -- Result
  status VARCHAR(50) NOT NULL,
  -- Possible values: 'success', 'rejected', 'failed', 'blocked'
  rejection_reason TEXT,

  plugin_id VARCHAR(255),

  -- Tier checking
  user_tier VARCHAR(50),
  quota_used INTEGER,
  quota_limit INTEGER,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_pgr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for plugin_generation_requests
CREATE INDEX idx_pgr_user ON plugin_generation_requests(user_id);
CREATE INDEX idx_pgr_status ON plugin_generation_requests(status);
CREATE INDEX idx_pgr_created ON plugin_generation_requests(created_at DESC);

-- Table 4: Plugin reviews (manual approval workflow)
CREATE TABLE IF NOT EXISTS plugin_reviews (
  id SERIAL PRIMARY KEY,
  plugin_id VARCHAR(255) NOT NULL,
  reviewer_id VARCHAR(255) NOT NULL,

  -- Review decision
  decision VARCHAR(50) NOT NULL,
  -- Possible values: 'approved', 'rejected', 'requires_changes'

  -- Review notes
  security_notes TEXT,
  functionality_notes TEXT,
  recommendations TEXT,

  -- Security findings
  security_issues_found JSONB,
  auto_fixes_applied JSONB,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_pr_plugin FOREIGN KEY (plugin_id) REFERENCES user_generated_plugins(plugin_id) ON DELETE CASCADE,
  CONSTRAINT fk_pr_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for plugin_reviews
CREATE INDEX idx_pr_plugin ON plugin_reviews(plugin_id);
CREATE INDEX idx_pr_reviewer ON plugin_reviews(reviewer_id);
CREATE INDEX idx_pr_created ON plugin_reviews(created_at DESC);

-- Table 5: Plugin installations (track who installed which plugins)
CREATE TABLE IF NOT EXISTS plugin_installations (
  id SERIAL PRIMARY KEY,
  plugin_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,

  -- Installation status
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  -- Possible values: 'active', 'disabled', 'uninstalled'

  -- Configuration override
  custom_config JSONB,

  -- Credentials (encrypted)
  credentials JSONB,

  -- Usage
  last_used_at TIMESTAMP,
  use_count INTEGER DEFAULT 0,

  installed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_pi_plugin FOREIGN KEY (plugin_id) REFERENCES user_generated_plugins(plugin_id) ON DELETE CASCADE,
  CONSTRAINT fk_pi_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_plugin_installation UNIQUE(plugin_id, user_id)
);

-- Indexes for plugin_installations
CREATE INDEX idx_pi_user_status ON plugin_installations(user_id, status);
CREATE INDEX idx_pi_plugin ON plugin_installations(plugin_id);

-- Table 6: Plugin security incidents
CREATE TABLE IF NOT EXISTS plugin_security_incidents (
  id SERIAL PRIMARY KEY,
  plugin_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,

  -- Incident details
  incident_type VARCHAR(100) NOT NULL,
  -- 'malicious_code', 'rate_limit_exceeded', 'unauthorized_access', 'resource_abuse', etc.

  severity VARCHAR(50) NOT NULL,
  -- 'low', 'medium', 'high', 'critical'

  description TEXT NOT NULL,
  details JSONB,

  -- Actions taken
  action_taken VARCHAR(100),
  -- 'plugin_disabled', 'user_warned', 'user_banned', 'under_investigation'

  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  resolution_notes TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_psi_plugin FOREIGN KEY (plugin_id) REFERENCES user_generated_plugins(plugin_id) ON DELETE CASCADE,
  CONSTRAINT fk_psi_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for plugin_security_incidents
CREATE INDEX idx_psi_plugin ON plugin_security_incidents(plugin_id);
CREATE INDEX idx_psi_user ON plugin_security_incidents(user_id);
CREATE INDEX idx_psi_severity ON plugin_security_incidents(severity);
CREATE INDEX idx_psi_resolved ON plugin_security_incidents(resolved) WHERE resolved = false;
CREATE INDEX idx_psi_created ON plugin_security_incidents(created_at DESC);

-- Table 7: Plugin marketplace ratings
CREATE TABLE IF NOT EXISTS plugin_marketplace_ratings (
  id SERIAL PRIMARY KEY,
  plugin_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,

  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,

  -- Helpful votes
  helpful_count INTEGER DEFAULT 0,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_pmr_plugin FOREIGN KEY (plugin_id) REFERENCES user_generated_plugins(plugin_id) ON DELETE CASCADE,
  CONSTRAINT fk_pmr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_plugin_user_rating UNIQUE(plugin_id, user_id)
);

-- Indexes for plugin_marketplace_ratings
CREATE INDEX idx_pmr_plugin ON plugin_marketplace_ratings(plugin_id);
CREATE INDEX idx_pmr_rating ON plugin_marketplace_ratings(rating);

-- Add updated_at trigger for relevant tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_generated_plugins_updated_at BEFORE UPDATE ON user_generated_plugins
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plugin_installations_updated_at BEFORE UPDATE ON plugin_installations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plugin_marketplace_ratings_updated_at BEFORE UPDATE ON plugin_marketplace_ratings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE user_generated_plugins IS 'Stores user-created plugins with security analysis and approval workflow';
COMMENT ON TABLE plugin_execution_logs IS 'Tracks all executions of user-generated plugins for monitoring and auditing';
COMMENT ON TABLE plugin_generation_requests IS 'Audit trail of all plugin generation attempts with AI metrics';
COMMENT ON TABLE plugin_reviews IS 'Manual review records for plugin approval process';
COMMENT ON TABLE plugin_installations IS 'Tracks which users have installed which plugins';
COMMENT ON TABLE plugin_security_incidents IS 'Records security issues discovered in user-generated plugins';
COMMENT ON TABLE plugin_marketplace_ratings IS 'User ratings and reviews for public marketplace plugins';

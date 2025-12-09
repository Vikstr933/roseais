-- Migration: Add User Credentials Table
-- Created: 2025-01-02
-- Description: Secure storage for user credentials (API keys, OAuth tokens)

-- Table: User credentials for plugins
CREATE TABLE IF NOT EXISTS user_credentials (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  service_name VARCHAR(100) NOT NULL,
  credential_type VARCHAR(50) NOT NULL,
  -- 'api_key', 'oauth2', 'personal_access_token', 'custom'

  -- Encrypted credential data
  encrypted_data TEXT NOT NULL,

  -- Metadata
  display_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- OAuth specific fields
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  oauth_expires_at TIMESTAMP,
  oauth_scopes TEXT[],

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_validated_at TIMESTAMP,
  validation_status VARCHAR(50), -- 'valid', 'invalid', 'expired', 'pending'
  validation_error TEXT,

  -- Usage tracking
  last_used_at TIMESTAMP,
  use_count INTEGER DEFAULT 0,

  -- Security
  created_from_ip VARCHAR(45),
  last_modified_ip VARCHAR(45),

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_uc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_user_service_credential UNIQUE(user_id, service_name, display_name)
);

-- Indexes for user_credentials
CREATE INDEX idx_uc_user ON user_credentials(user_id);
CREATE INDEX idx_uc_service ON user_credentials(service_name);
CREATE INDEX idx_uc_type ON user_credentials(credential_type);
CREATE INDEX idx_uc_active ON user_credentials(user_id, is_active) WHERE is_active = true;

-- Table: OAuth states for CSRF protection
CREATE TABLE IF NOT EXISTS oauth_states (
  id SERIAL PRIMARY KEY,
  state_token VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  service_name VARCHAR(100) NOT NULL,
  redirect_uri TEXT,

  -- Security
  created_from_ip VARCHAR(45),

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,

  CONSTRAINT fk_os_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for quick state lookup
CREATE INDEX idx_os_state ON oauth_states(state_token);
CREATE INDEX idx_os_user ON oauth_states(user_id);

-- Index for expired states cleanup (queries will use WHERE expires_at < NOW())
CREATE INDEX idx_os_expires ON oauth_states(expires_at);

-- Add updated_at trigger for user_credentials
CREATE TRIGGER update_user_credentials_updated_at BEFORE UPDATE ON user_credentials
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE user_credentials IS 'Encrypted storage for user API keys and OAuth tokens';
COMMENT ON TABLE oauth_states IS 'Temporary storage for OAuth state tokens (CSRF protection)';

COMMENT ON COLUMN user_credentials.encrypted_data IS 'AES-256-GCM encrypted credential data';
COMMENT ON COLUMN user_credentials.credential_type IS 'Type: api_key, oauth2, personal_access_token, custom';
COMMENT ON COLUMN oauth_states.state_token IS 'Random token for CSRF protection during OAuth flow';

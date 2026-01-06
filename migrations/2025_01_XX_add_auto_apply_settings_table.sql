-- Migration: Add auto_apply_settings table for storing auto-apply configuration
-- Date: 2025-01-XX

CREATE TABLE IF NOT EXISTS auto_apply_settings (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resume_id INTEGER REFERENCES resumes(id) ON DELETE SET NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  criteria JSONB NOT NULL DEFAULT '{}',
  require_confirmation BOOLEAN NOT NULL DEFAULT true,
  cover_letter_template TEXT,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_auto_apply_settings_user_id ON auto_apply_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_apply_settings_enabled ON auto_apply_settings(enabled);
CREATE INDEX IF NOT EXISTS idx_auto_apply_settings_next_run_at ON auto_apply_settings(next_run_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_auto_apply_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_auto_apply_settings_updated_at
  BEFORE UPDATE ON auto_apply_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_auto_apply_settings_updated_at();

-- Add comment to table
COMMENT ON TABLE auto_apply_settings IS 'Stores auto-apply settings and configuration for users';


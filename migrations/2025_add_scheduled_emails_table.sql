-- Migration: Add scheduled_emails table for email scheduling functionality
-- Created: 2025-12-01
-- Description: Table to store emails that should be sent at a future date/time

CREATE TABLE IF NOT EXISTS scheduled_emails (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "to" TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_for TIMESTAMP NOT NULL,
  sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  error TEXT
);

-- Index for efficient querying of unsent emails
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_sent_scheduled ON scheduled_emails(sent, scheduled_for) WHERE sent = false;

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_user_id ON scheduled_emails(user_id);

-- Add comment
COMMENT ON TABLE scheduled_emails IS 'Stores emails scheduled to be sent at a future date/time';


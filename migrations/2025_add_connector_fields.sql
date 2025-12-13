-- Migration: Add connector support fields to api_keys and shared_connectors
-- Created: 2025-01-XX
-- Description: Add fields to support connector linking and env variable management

-- Add connectorId to api_keys table (optional, for explicit linking to connectors)
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS connector_id TEXT;

-- Add metadata JSONB field to api_keys for storing env variables and other metadata
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add index for faster lookups by connector
CREATE INDEX IF NOT EXISTS idx_api_keys_connector_id ON api_keys(connector_id) WHERE connector_id IS NOT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN api_keys.connector_id IS 'Optional: Links this API key to a specific connector configuration';
COMMENT ON COLUMN api_keys.metadata IS 'JSONB field for storing env variables and other connector metadata (e.g., {"envVariables": {"STRIPE_SECRET_KEY": "..."}})';


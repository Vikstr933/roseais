-- Migration: Add encrypted_key column to api_keys table
-- This allows storing encrypted API key values for retrieval
-- Created: 2025-01-XX

-- Add encrypted_key column to store the encrypted value
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS encrypted_key TEXT;

-- Add index for faster lookups by service
CREATE INDEX IF NOT EXISTS idx_api_keys_service_name ON api_keys(service_name) WHERE service_name IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN api_keys.encrypted_key IS 'Encrypted API key value (can be decrypted with API_KEY_ENCRYPTION_KEY)';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA256 hash of the key (for duplicate detection, cannot be decrypted)';


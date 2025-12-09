-- Add credentials_required field to user_generated_plugins table
-- This stores information about what credentials the plugin needs

ALTER TABLE user_generated_plugins
ADD COLUMN IF NOT EXISTS credentials_required jsonb DEFAULT '{}';

-- Update existing plugins to have empty credentials requirements
UPDATE user_generated_plugins
SET credentials_required = '{}'
WHERE credentials_required IS NULL;

-- Example structure for credentials_required:
-- {
--   "discord": {
--     "fields": [
--       {"name": "webhookUrl", "label": "Webhook URL", "type": "text", "required": true},
--       {"name": "botToken", "label": "Bot Token", "type": "password", "required": false}
--     ]
--   }
-- }

-- ==================================================================
-- SMART AGENT SELECTION & USER-CREATED AGENTS SUPPORT
-- Adds support for user-created agents and smart agent selection
-- ==================================================================

-- Add userId and isSystem columns if they don't exist
DO $$
BEGIN
  -- Add userId column for user-created agents
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE agents ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
    RAISE NOTICE 'Added user_id column to agents table';
  END IF;

  -- Add isSystem column to distinguish system vs user agents
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'is_system'
  ) THEN
    ALTER TABLE agents ADD COLUMN is_system INTEGER DEFAULT 1;
    CREATE INDEX IF NOT EXISTS idx_agents_is_system ON agents(is_system);
    RAISE NOTICE 'Added is_system column to agents table';
  END IF;

  -- Add requiredApiKeys column to specify which API keys an agent needs
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'required_api_keys'
  ) THEN
    ALTER TABLE agents ADD COLUMN required_api_keys JSONB DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Added required_api_keys column to agents table';
  END IF;

  -- Add apiEndpoint column for custom API integrations
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'api_endpoint'
  ) THEN
    ALTER TABLE agents ADD COLUMN api_endpoint TEXT;
    RAISE NOTICE 'Added api_endpoint column to agents table';
  END IF;

  -- Add apiConfig column for API configuration
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'api_config'
  ) THEN
    ALTER TABLE agents ADD COLUMN api_config JSONB DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added api_config column to agents table';
  END IF;
END $$;

-- Update existing system agents to have is_system = 1 (true)
UPDATE agents SET is_system = 1 WHERE is_system IS NULL;

-- Update existing system agents to have user_id = NULL
UPDATE agents SET user_id = NULL WHERE created_by IS NULL AND user_id IS NULL;

-- Set is_system = 0 (false) for user-created agents (if any)
UPDATE agents SET is_system = 0 WHERE created_by IS NOT NULL AND is_system IS NULL;

-- Enhance capabilities structure for better agent selection
-- Example capabilities structure:
-- {
--   "canGenerateCode": true,
--   "canGenerateTests": false,
--   "canGenerateStyles": true,
--   "canGenerateDocs": false,
--   "canAccessAPIs": true,
--   "specialties": ["react", "typescript", "css", "stock-prices"],
--   "dataSources": ["api", "database", "files"],
--   "apiIntegrations": ["stock-price-api", "product-catalog-api"]
-- }

-- Create example user-created agents (commented out - users will create their own)
-- These are just examples of what users can create:

/*
-- Example: Stock Price Agent
INSERT INTO agents (
  id, name, type, model, system_prompt, temperature,
  description, role, capabilities, required_api_keys, api_endpoint, api_config,
  user_id, is_system, is_active, created_by
) VALUES (
  'user-stock-price-agent',
  'Stock Price Data Agent',
  'data-fetcher',
  'claude-sonnet-4-5-20250929',
  'You are a stock price data specialist. Your role is to fetch and provide real-time stock price data from APIs. Always use the provided API credentials to fetch accurate, up-to-date stock information. Format data clearly and include timestamps.',
  0.2,
  'Fetches real-time stock price data from custom APIs',
  'data-fetcher',
  '{"canGenerateCode": false, "canAccessAPIs": true, "specialties": ["stock-prices", "financial-data"], "dataSources": ["api"], "apiIntegrations": ["stock-price-api"]}'::jsonb,
  '[{"serviceName": "stock-price-api", "keyName": "api_key", "keyType": "api_key", "description": "API key for stock price service"}]'::jsonb,
  'https://api.example.com/stock-prices',
  '{"method": "GET", "headers": {"Authorization": "Bearer {api_key}"}, "responseFormat": "json"}'::jsonb,
  NULL, -- user_id (set when user creates)
  false,
  true,
  NULL
) ON CONFLICT (id) DO NOTHING;

-- Example: Product Catalog Agent
INSERT INTO agents (
  id, name, type, model, system_prompt, temperature,
  description, role, capabilities, required_api_keys, api_endpoint, api_config,
  user_id, is_system, is_active, created_by
) VALUES (
  'user-product-catalog-agent',
  'Product Catalog Agent',
  'data-fetcher',
  'claude-sonnet-4-5-20250929',
  'You are a product catalog specialist. Your role is to fetch product information from APIs or databases. You can search products, get product details, and provide comprehensive product information for chatbot applications.',
  0.3,
  'Fetches product information for chatbot applications',
  'data-fetcher',
  '{"canGenerateCode": false, "canAccessAPIs": true, "specialties": ["product-catalog", "e-commerce"], "dataSources": ["api", "database"], "apiIntegrations": ["product-catalog-api"]}'::jsonb,
  '[{"serviceName": "product-catalog-api", "keyName": "api_key", "keyType": "api_key", "description": "API key for product catalog service"}]'::jsonb,
  'https://api.example.com/products',
  '{"method": "GET", "headers": {"Authorization": "Bearer {api_key}"}, "responseFormat": "json"}'::jsonb,
  NULL, -- user_id (set when user creates)
  false,
  true,
  NULL
) ON CONFLICT (id) DO NOTHING;
*/

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_agents_user_id_is_active ON agents(user_id, is_active) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agents_is_system_is_active ON agents(is_system, is_active);
CREATE INDEX IF NOT EXISTS idx_agents_capabilities_gin ON agents USING GIN(capabilities);

-- Update capabilities for existing system agents
UPDATE agents 
SET capabilities = capabilities || '{"canGenerateCode": true, "canGenerateTests": false, "canGenerateStyles": false, "canGenerateDocs": false, "canAccessAPIs": false}'::jsonb
WHERE id = 'component-developer' AND (capabilities IS NULL OR capabilities = '{}'::jsonb);

UPDATE agents 
SET capabilities = capabilities || '{"canGenerateCode": false, "canGenerateTests": false, "canGenerateStyles": false, "canGenerateDocs": false, "canAccessAPIs": false, "specialties": ["architecture", "planning"]}'::jsonb
WHERE id = 'component-architect' AND (capabilities IS NULL OR capabilities = '{}'::jsonb);

COMMENT ON COLUMN agents.user_id IS 'User who created this agent (NULL for system agents)';
COMMENT ON COLUMN agents.is_system IS 'True for system agents, false for user-created agents';
COMMENT ON COLUMN agents.required_api_keys IS 'Array of required API keys: [{"serviceName": "...", "keyName": "...", "keyType": "...", "description": "..."}]';
COMMENT ON COLUMN agents.api_endpoint IS 'API endpoint URL for custom API integrations';
COMMENT ON COLUMN agents.api_config IS 'API configuration: method, headers, responseFormat, etc.';


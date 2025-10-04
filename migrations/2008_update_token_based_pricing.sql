-- Update subscription plans to use token-based limits
-- First, update existing plans to use token limits
UPDATE subscription_plans 
SET limits = '{"monthly_tokens": 100000}',
    features = '{"basic_component_generation": true, "basic_chat": true, "standard_agents": true}'
WHERE tier = 'free';

UPDATE subscription_plans 
SET price = 20,
    limits = '{"monthly_tokens": 1000000}',
    features = '{"advanced_component_generation": true, "advanced_chat": true, "custom_templates": true, "priority_support": true, "custom_agents": true, "team_collaboration": true}'
WHERE tier = 'pro';

-- Add new Team tier
INSERT INTO subscription_plans (name, tier, price, features, limits) VALUES 
('Team', 'team', 50, '{"advanced_component_generation": true, "advanced_chat": true, "custom_templates": true, "priority_support": true, "custom_agents": true, "team_collaboration": true, "custom_knowledge_bases": true, "advanced_analytics": true, "team_workspaces": true, "custom_integrations": true}', '{"monthly_tokens": 3000000}');

-- Update Enterprise tier
UPDATE subscription_plans 
SET limits = '{"monthly_tokens": -1}',
    features = '{"unlimited_generation": true, "custom_api_keys": true, "white_label": true, "dedicated_support": true, "custom_deployments": true, "advanced_security": true, "sla_guarantee": true, "on_premise_options": true}'
WHERE tier = 'enterprise';

-- Add index for better performance on token-based queries
CREATE INDEX IF NOT EXISTS idx_user_usage_tokens_used ON user_usage(tokens_used);
CREATE INDEX IF NOT EXISTS idx_user_usage_monthly ON user_usage(user_id, created_at) WHERE created_at >= date('now', 'start of month');

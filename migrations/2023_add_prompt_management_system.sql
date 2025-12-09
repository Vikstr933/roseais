-- Migration: Add Prompt Management System
-- This enables dynamic prompt management, versioning, and A/B testing
-- Created: 2025-11-03

-- ============================================================================
-- PROMPT TEMPLATES TABLE
-- Stores versioned prompt templates for all agents
-- ============================================================================
CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  prompt_key VARCHAR(100) NOT NULL, -- e.g., 'plugin_generator.intent_analysis'
  version INTEGER NOT NULL DEFAULT 1,

  -- Content
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT, -- Template with {{variables}}

  -- Metadata
  agent_type VARCHAR(50) NOT NULL, -- 'plugin_generator', 'code_generator', etc.
  prompt_type VARCHAR(50) NOT NULL, -- 'system', 'intent_analysis', 'code_generation', etc.
  description TEXT,

  -- Configuration
  model VARCHAR(50) DEFAULT 'claude-sonnet-4-5-20250929',
  max_tokens INTEGER DEFAULT 4000,
  temperature DECIMAL(3,2) DEFAULT 0.7,

  -- Best practices & guidelines (stored as JSONB for flexibility)
  coding_guidelines JSONB DEFAULT '[]'::jsonb,
  constraints JSONB DEFAULT '{}'::jsonb, -- Allowed/blocked capabilities, etc.

  -- Status & Lifecycle
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'archived', 'testing'
  is_default BOOLEAN DEFAULT false, -- One default per prompt_key

  -- User Tier Restrictions
  min_user_tier VARCHAR(20) DEFAULT 'free', -- 'free', 'pro', 'enterprise'

  -- Performance Metrics
  avg_response_time_ms INTEGER,
  success_rate DECIMAL(5,2),
  avg_security_score DECIMAL(5,2),
  usage_count INTEGER DEFAULT 0,

  -- A/B Testing
  experiment_id VARCHAR(50), -- Group prompts into experiments
  variant_name VARCHAR(50), -- 'control', 'variant_a', 'variant_b', etc.
  traffic_percentage INTEGER DEFAULT 100, -- % of requests to route here

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Constraints
  CONSTRAINT unique_prompt_version UNIQUE (prompt_key, version),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'archived', 'testing')),
  CONSTRAINT valid_tier CHECK (min_user_tier IN ('free', 'pro', 'enterprise')),
  CONSTRAINT valid_traffic CHECK (traffic_percentage >= 0 AND traffic_percentage <= 100)
);

-- Indexes for performance
CREATE INDEX idx_prompt_templates_key_status ON prompt_templates(prompt_key, status);
CREATE INDEX idx_prompt_templates_agent_type ON prompt_templates(agent_type);
CREATE INDEX idx_prompt_templates_default ON prompt_templates(prompt_key) WHERE is_default = true;
CREATE INDEX idx_prompt_templates_experiment ON prompt_templates(experiment_id) WHERE experiment_id IS NOT NULL;

-- ============================================================================
-- PROMPT USAGE LOGS
-- Track which prompts are used and their performance
-- ============================================================================
CREATE TABLE IF NOT EXISTS prompt_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  prompt_template_id UUID NOT NULL REFERENCES prompt_templates(id),
  user_id UUID REFERENCES users(id),

  -- Request Details
  agent_type VARCHAR(50) NOT NULL,
  request_context JSONB, -- Store relevant context (service name, capabilities, etc.)

  -- Response Metrics
  response_time_ms INTEGER NOT NULL,
  tokens_used INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,

  -- Quality Metrics (if applicable)
  security_score DECIMAL(5,2),
  user_satisfaction INTEGER, -- 1-5 rating if user provides feedback

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_prompt_usage_logs_template ON prompt_usage_logs(prompt_template_id);
CREATE INDEX idx_prompt_usage_logs_created_at ON prompt_usage_logs(created_at);
CREATE INDEX idx_prompt_usage_logs_agent_type ON prompt_usage_logs(agent_type);

-- ============================================================================
-- CODING GUIDELINES TABLE
-- Reusable coding guidelines that can be referenced by multiple prompts
-- ============================================================================
CREATE TABLE IF NOT EXISTS coding_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50) NOT NULL, -- 'organization', 'security', 'performance', 'testing', etc.

  guideline TEXT NOT NULL,
  priority INTEGER DEFAULT 1, -- Higher = more important

  applies_to VARCHAR[] DEFAULT ARRAY['*'], -- ['plugin_generator', 'code_generator'] or ['*'] for all

  enabled BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_coding_guidelines_category ON coding_guidelines(category);
CREATE INDEX idx_coding_guidelines_enabled ON coding_guidelines(enabled) WHERE enabled = true;

-- ============================================================================
-- SEED DATA: Insert current PluginGeneratorAgent prompts
-- ============================================================================

-- Insert coding guidelines
INSERT INTO coding_guidelines (name, category, guideline, priority, applies_to) VALUES
-- Organization & Structure
('clear_directory_structure', 'organization',
'Maintain a clear, logical directory structure (e.g., src/components/, src/pages/, src/utils/, src/hooks/ for frontend, and src/routes/, src/models/, src/controllers/ for backend).',
10, ARRAY['*']),

('descriptive_naming', 'organization',
'Use descriptive file and folder names that reflect functionality. Keep components small and focused on a single responsibility.',
10, ARRAY['*']),

-- Readability & Maintainability
('self_explanatory_code', 'readability',
'Write clear, self-explanatory code with meaningful variable and function names. Add concise comments where logic is non-trivial, but avoid obvious comments that restate code.',
9, ARRAY['*']),

('consistent_style', 'readability',
'Use linting (ESLint) and formatting tools for consistent coding style. Prefer functional components and hooks in React; keep class components as exceptions if needed.',
8, ARRAY['plugin_generator', 'code_generator']),

-- Scalability & Reusability
('extract_repeated_logic', 'scalability',
'Extract repeated logic into utility functions or custom hooks. Leverage component composition over inheritance.',
8, ARRAY['*']),

('code_splitting', 'scalability',
'Implement code splitting and lazy loading to optimize performance as the codebase grows.',
7, ARRAY['code_generator']),

-- Typing & Validation
('strong_typing', 'typing',
'Use TypeScript types to catch type-related errors early. Validate all API inputs (on backend) to ensure data integrity and avoid runtime errors.',
9, ARRAY['*']),

-- Security & Error Handling
('input_validation', 'security',
'Sanitize and validate all user input on the backend to prevent injection attacks. Never use eval() or Function() constructors.',
10, ARRAY['*']),

('error_handling', 'security',
'Implement try/catch blocks for async operations; provide user-friendly error messages. Use environment variables for secrets and never commit sensitive credentials.',
10, ARRAY['*']),

('owasp_compliance', 'security',
'Follow OWASP guidelines where applicable. Implement proper authentication and authorization checks.',
10, ARRAY['plugin_generator']),

-- Performance & Optimization
('avoid_unnecessary_rerenders', 'performance',
'Avoid unnecessary re-renders in React by memoization or carefully managing dependencies in hooks. Use appropriate data structures and algorithms to handle large datasets efficiently.',
7, ARRAY['code_generator']),

('lazy_loading', 'performance',
'Apply lazy loading for non-critical resources to improve initial load time.',
6, ARRAY['code_generator']),

-- Testing & Quality
('unit_testing', 'testing',
'Write unit tests for core logic and critical components. Use tools like Jest and React Testing Library for frontend, and Jest/Supertest for backend.',
8, ARRAY['*']),

('integration_testing', 'testing',
'Include integration and end-to-end tests for key user flows.',
7, ARRAY['*']);

-- Insert PluginGeneratorAgent Intent Analysis prompt
INSERT INTO prompt_templates (
  prompt_key,
  version,
  system_prompt,
  user_prompt_template,
  agent_type,
  prompt_type,
  description,
  model,
  max_tokens,
  temperature,
  coding_guidelines,
  constraints,
  status,
  is_default,
  min_user_tier
) VALUES (
  'plugin_generator.intent_analysis',
  1,
  'You are a security analyzer for plugin generation. Analyze the user''s request and determine:
1. Is this a safe, legitimate plugin request?
2. What is the primary intent?
3. What capabilities are needed?
4. What service should it integrate with?
5. What is the complexity level?

Respond in JSON format (no markdown code blocks):
{
  "safe": boolean,
  "intent": string,
  "blockedReason": string or null,
  "suggestedCapabilities": string[],
  "suggestedService": string,
  "complexity": "simple" | "medium" | "complex"
}',
  'Analyze this plugin request: "{{prompt}}"

BLOCKED INTENTS:
{{blockedIntents}}

ALLOWED CAPABILITIES:
{{allowedCapabilities}}

ALLOWED SERVICES:
{{allowedServices}}',
  'plugin_generator',
  'intent_analysis',
  'Analyzes user plugin generation requests for safety and intent classification',
  'claude-sonnet-4-5-20250929',
  1000,
  0.3,
  '[]'::jsonb,
  jsonb_build_object(
    'blockedIntents', ARRAY['crypto_mining', 'cryptocurrency', 'ddos', 'denial_of_service', 'data_exfiltration', 'data_theft', 'privilege_escalation', 'system_modification', 'credential_stealing', 'password_cracking', 'spam_generation', 'phishing', 'malware', 'virus', 'exploit', 'hack', 'backdoor'],
    'allowedCapabilities', ARRAY['read_messages', 'send_messages', 'read_events', 'create_events', 'read_tasks', 'create_tasks', 'update_tasks', 'read_analytics', 'notifications', 'read_users', 'read_channels', 'create_channels', 'file_upload', 'read_files', 'search'],
    'allowedServices', ARRAY['Discord', 'Slack', 'Trello', 'Notion', 'GitHub', 'GitLab', 'Linear', 'Asana', 'Todoist']
  ),
  'active',
  true,
  'free'
);

-- Insert PluginGeneratorAgent Code Generation prompt
INSERT INTO prompt_templates (
  prompt_key,
  version,
  system_prompt,
  user_prompt_template,
  agent_type,
  prompt_type,
  description,
  model,
  max_tokens,
  temperature,
  coding_guidelines,
  constraints,
  status,
  is_default,
  min_user_tier
) VALUES (
  'plugin_generator.code_generation',
  1,
  'You are an expert plugin developer. Generate a secure, production-ready plugin based on the BaseProductivityPlugin class.

CORE REQUIREMENTS:
1. Extend BaseProductivityPlugin
2. Use only APPROVED packages: axios, node-fetch, discord.js, @slack/web-api, trello, @notionhq/client, zod, date-fns, uuid
3. NO file system access (fs module)
4. NO process spawning (child_process)
5. NO eval() or Function() constructors
6. NO hardcoded credentials (use plugin credential system)
7. Include proper error handling
8. Add TypeScript types
9. Implement all required methods: initialize(), enable(), sync(), getTools(), executeAction()
10. Follow the template structure

CODING GUIDELINES:
{{codingGuidelines}}

CAPABILITIES REQUESTED: {{capabilities}}
SERVICE: {{serviceName}}
COMPLEXITY: {{complexity}}

Return ONLY the TypeScript code, no markdown code blocks, no explanations.',
  'Generate a plugin for: {{prompt}}

Use this template as a guide:

{{template}}

Requirements:
- Plugin should be production-ready
- Include proper OAuth setup if needed
- Implement tools for the requested capabilities
- Add comprehensive error handling
- Use Zod for parameter validation
- Include rate limiting configuration',
  'plugin_generator',
  'code_generation',
  'Generates secure plugin code based on user requirements',
  'claude-sonnet-4-5-20250929',
  4000,
  0.7,
  jsonb_build_array('clear_directory_structure', 'descriptive_naming', 'self_explanatory_code', 'strong_typing', 'input_validation', 'error_handling', 'owasp_compliance'),
  jsonb_build_object(
    'approvedPackages', ARRAY['axios', 'node-fetch', 'discord.js', '@slack/web-api', 'trello', '@notionhq/client', 'zod', 'date-fns', 'uuid'],
    'blockedModules', ARRAY['fs', 'child_process', 'eval']
  ),
  'active',
  true,
  'free'
);

-- ============================================================================
-- FUNCTIONS: Auto-update timestamps
-- ============================================================================
CREATE OR REPLACE FUNCTION update_prompt_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prompt_templates_updated_at
  BEFORE UPDATE ON prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_prompt_template_updated_at();

CREATE TRIGGER coding_guidelines_updated_at
  BEFORE UPDATE ON coding_guidelines
  FOR EACH ROW
  EXECUTE FUNCTION update_prompt_template_updated_at();

-- ============================================================================
-- VIEWS: Convenient access to active prompts
-- ============================================================================
CREATE OR REPLACE VIEW active_prompts AS
SELECT
  pt.*,
  (
    SELECT jsonb_agg(cg.guideline ORDER BY cg.priority DESC)
    FROM coding_guidelines cg
    WHERE cg.enabled = true
      AND (cg.applies_to @> ARRAY[pt.agent_type] OR cg.applies_to @> ARRAY['*'])
  ) AS applicable_guidelines
FROM prompt_templates pt
WHERE pt.status = 'active';

-- Grant permissions
GRANT SELECT ON active_prompts TO PUBLIC;

COMMENT ON TABLE prompt_templates IS 'Stores versioned AI agent prompts with A/B testing support';
COMMENT ON TABLE prompt_usage_logs IS 'Tracks prompt usage and performance metrics';
COMMENT ON TABLE coding_guidelines IS 'Reusable coding best practices referenced by prompts';

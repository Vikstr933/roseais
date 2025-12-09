-- Simple Prompt Management System Migration
-- Simplified for maximum compatibility

-- Drop existing tables if they exist
DROP TABLE IF EXISTS prompt_usage_logs;
DROP TABLE IF EXISTS prompt_templates;
DROP TABLE IF EXISTS coding_guidelines;

-- ============================================================================
-- CODING GUIDELINES TABLE
-- ============================================================================
CREATE TABLE coding_guidelines (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  guideline TEXT NOT NULL,
  priority INTEGER DEFAULT 1,
  applies_to TEXT[] DEFAULT ARRAY['*'],
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coding_guidelines_category ON coding_guidelines(category);
CREATE INDEX idx_coding_guidelines_enabled ON coding_guidelines(enabled) WHERE enabled = true;

-- ============================================================================
-- PROMPT TEMPLATES TABLE
-- ============================================================================
CREATE TABLE prompt_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Identification
  prompt_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,

  -- Content
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT,

  -- Metadata
  agent_type TEXT NOT NULL,
  prompt_type TEXT NOT NULL,
  description TEXT,

  -- Configuration
  model TEXT DEFAULT 'claude-sonnet-4-5-20250929',
  max_tokens INTEGER DEFAULT 4000,
  temperature NUMERIC(3,2) DEFAULT 0.7,

  -- Guidelines & Constraints
  coding_guidelines JSONB DEFAULT '[]'::jsonb,
  constraints JSONB DEFAULT '{}'::jsonb,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft',
  is_default BOOLEAN DEFAULT false,
  min_user_tier TEXT DEFAULT 'free',

  -- Performance Metrics
  avg_response_time_ms INTEGER,
  success_rate NUMERIC(5,2),
  avg_security_score NUMERIC(5,2),
  usage_count INTEGER DEFAULT 0,

  -- A/B Testing
  experiment_id TEXT,
  variant_name TEXT,
  traffic_percentage INTEGER DEFAULT 100,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,

  CONSTRAINT unique_prompt_version UNIQUE (prompt_key, version),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'archived', 'testing')),
  CONSTRAINT valid_tier CHECK (min_user_tier IN ('free', 'pro', 'enterprise')),
  CONSTRAINT valid_traffic CHECK (traffic_percentage >= 0 AND traffic_percentage <= 100)
);

CREATE INDEX idx_prompt_templates_key_status ON prompt_templates(prompt_key, status);
CREATE INDEX idx_prompt_templates_agent_type ON prompt_templates(agent_type);
CREATE INDEX idx_prompt_templates_default ON prompt_templates(prompt_key) WHERE is_default = true;

-- ============================================================================
-- PROMPT USAGE LOGS
-- ============================================================================
CREATE TABLE prompt_usage_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  prompt_template_id TEXT NOT NULL,
  user_id TEXT,
  agent_type TEXT NOT NULL,
  request_context JSONB,
  response_time_ms INTEGER NOT NULL,
  tokens_used INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  security_score NUMERIC(5,2),
  user_satisfaction INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prompt_usage_logs_template ON prompt_usage_logs(prompt_template_id);
CREATE INDEX idx_prompt_usage_logs_created_at ON prompt_usage_logs(created_at);
CREATE INDEX idx_prompt_usage_logs_agent_type ON prompt_usage_logs(agent_type);

-- ============================================================================
-- SEED DATA: Coding Guidelines
-- ============================================================================

INSERT INTO coding_guidelines (name, category, guideline, priority, applies_to) VALUES

-- Organization & Structure (Priority 10)
('clear_directory_structure', 'organization',
'Maintain a clear, logical directory structure (e.g., src/components/, src/pages/, src/utils/, src/hooks/ for frontend, and src/routes/, src/models/, src/controllers/ for backend). Group related files together and use meaningful folder names.',
10, ARRAY['*']),

('descriptive_naming', 'organization',
'Use descriptive file and folder names that reflect functionality. Keep components small and focused on a single responsibility. Avoid generic names like "utils.ts" - use specific names like "dateFormatters.ts".',
10, ARRAY['*']),

('component_composition', 'organization',
'Break down complex components into smaller, reusable pieces. Each component should do one thing well. Use composition over inheritance for maximum flexibility.',
9, ARRAY['code_generator', 'ui_designer']),

-- Readability & Maintainability (Priority 9)
('self_explanatory_code', 'readability',
'Write clear, self-explanatory code with meaningful variable and function names. Add concise comments where logic is non-trivial, but avoid obvious comments that restate code. Code should read like a story.',
9, ARRAY['*']),

('consistent_style', 'readability',
'Use linting (ESLint) and formatting tools for consistent coding style. Prefer functional components and hooks in React; keep class components as exceptions if needed. Follow the project''s established patterns.',
8, ARRAY['*']),

('meaningful_naming', 'readability',
'Use clear, descriptive names for variables, functions, and classes. Avoid abbreviations unless they''re widely understood (e.g., "id", "url"). Boolean variables should start with "is", "has", or "should".',
9, ARRAY['*']),

-- Scalability & Reusability (Priority 8)
('extract_repeated_logic', 'scalability',
'Extract repeated logic into utility functions or custom hooks. If you write the same code twice, extract it. Leverage component composition over inheritance. Keep functions pure when possible.',
8, ARRAY['*']),

('code_splitting', 'scalability',
'Implement code splitting and lazy loading to optimize performance as the codebase grows. Use React.lazy() for route-based code splitting. Split large bundles into smaller chunks.',
7, ARRAY['code_generator']),

('performance_optimization', 'scalability',
'Optimize for performance from the start. Use memoization (useMemo, useCallback) wisely. Avoid premature optimization, but be mindful of expensive operations in render paths.',
8, ARRAY['code_generator', 'ui_designer']),

-- Typing & Validation (Priority 9)
('strong_typing', 'typing',
'Use TypeScript types to catch type-related errors early. Define interfaces for all data structures. Validate all API inputs (on backend) to ensure data integrity and avoid runtime errors. Use Zod or similar for runtime validation.',
9, ARRAY['*']),

('type_safety', 'typing',
'Avoid using "any" type unless absolutely necessary. Prefer "unknown" over "any". Use generics for reusable type-safe code. Define return types explicitly for functions.',
9, ARRAY['*']),

-- Security & Error Handling (Priority 10)
('input_validation', 'security',
'Sanitize and validate all user input on the backend to prevent injection attacks. Never use eval() or Function() constructors. Validate file uploads. Use parameterized queries for database operations.',
10, ARRAY['*']),

('error_handling', 'security',
'Implement try/catch blocks for async operations; provide user-friendly error messages. Use environment variables for secrets and never commit sensitive credentials. Log errors for debugging but never expose stack traces to users.',
10, ARRAY['*']),

('owasp_compliance', 'security',
'Follow OWASP Top 10 guidelines where applicable. Implement proper authentication and authorization checks. Use HTTPS for all communications. Implement rate limiting for APIs. Validate all inputs, sanitize all outputs.',
10, ARRAY['plugin_generator', 'code_generator']),

('secure_defaults', 'security',
'Use secure defaults everywhere. CORS should be restrictive by default. CSP headers should be strict. Cookies should be httpOnly and secure. Default to deny, explicitly allow.',
10, ARRAY['plugin_generator', 'code_generator']),

-- Performance & Optimization (Priority 7-8)
('avoid_unnecessary_rerenders', 'performance',
'Avoid unnecessary re-renders in React by memoization or carefully managing dependencies in hooks. Use React DevTools Profiler to identify performance bottlenecks. Use appropriate data structures and algorithms.',
7, ARRAY['code_generator', 'ui_designer']),

('lazy_loading', 'performance',
'Apply lazy loading for non-critical resources to improve initial load time. Load images lazily, split code by routes, defer non-critical JavaScript.',
6, ARRAY['code_generator', 'ui_designer']),

('efficient_state_management', 'performance',
'Keep state as local as possible. Lift state only when necessary. Use context sparingly - it can cause unnecessary re-renders. Consider state management libraries for complex state.',
8, ARRAY['code_generator']),

-- Testing & Quality (Priority 8)
('unit_testing', 'testing',
'Write unit tests for core logic and critical components. Use tools like Jest and React Testing Library for frontend, and Jest/Supertest for backend. Test edge cases and error scenarios.',
8, ARRAY['*']),

('integration_testing', 'testing',
'Include integration and end-to-end tests for key user flows. Test the happy path and critical error paths. Use Playwright or Cypress for E2E tests.',
7, ARRAY['*']),

('test_coverage', 'testing',
'Aim for high test coverage of critical business logic. 100% coverage isn''t necessary, but core functionality should be well-tested. Write tests that test behavior, not implementation.',
7, ARRAY['*']),

-- Accessibility (Priority 8)
('wcag_compliance', 'accessibility',
'Follow WCAG 2.1 AA guidelines. Use semantic HTML. Add ARIA labels where needed. Ensure keyboard navigation works. Test with screen readers. Provide alt text for images.',
8, ARRAY['ui_designer', 'code_generator']),

('responsive_design', 'accessibility',
'Implement mobile-first responsive design. Test on multiple screen sizes. Use relative units (rem, em) instead of pixels. Ensure touch targets are at least 44x44px.',
8, ARRAY['ui_designer', 'code_generator']),

-- Documentation (Priority 7)
('code_documentation', 'documentation',
'Document complex logic, APIs, and non-obvious decisions. Use JSDoc for function documentation. Keep README files updated. Document environment variables and setup steps.',
7, ARRAY['*']),

('api_documentation', 'documentation',
'Document all API endpoints with request/response examples. Use OpenAPI/Swagger where possible. Document authentication requirements and rate limits.',
8, ARRAY['code_generator']);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prompt_templates_updated_at
  BEFORE UPDATE ON prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER coding_guidelines_updated_at
  BEFORE UPDATE ON coding_guidelines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- VIEWS
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

-- Comments
COMMENT ON TABLE prompt_templates IS 'Stores versioned AI agent prompts with A/B testing support';
COMMENT ON TABLE prompt_usage_logs IS 'Tracks prompt usage and performance metrics';
COMMENT ON TABLE coding_guidelines IS 'Reusable coding best practices referenced by prompts';

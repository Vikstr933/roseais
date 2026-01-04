-- ============================================================================
-- AGENT SELF-LEARNING & COLLECTIVE INTELLIGENCE SYSTEM
-- ============================================================================
-- Created: 2025-12-18
-- Purpose: Enable agents to learn from failures, share knowledge, and improve over time
--
-- Design Philosophy:
-- 1. FAILURE ANALYSIS: Track what went wrong and why
-- 2. SOLUTION PATTERNS: Store successful solutions that can be reused
-- 3. COLLECTIVE INTELLIGENCE: Share knowledge between all agents
-- 4. SELF-IMPROVEMENT: Agents automatically improve their strategies
-- ============================================================================

-- ============================================================================
-- TABLE 1: AGENT FAILURES
-- Tracks when agents fail and why
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_failures (
    id SERIAL PRIMARY KEY,
    
    -- Agent identification
    agent_type TEXT NOT NULL,                      -- 'browser_use', 'code_generator', 'orchestrator', etc.
    agent_id TEXT,                                 -- Specific agent instance ID (optional)
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    
    -- Failure details
    failure_type TEXT NOT NULL,                    -- 'error', 'timeout', 'rejection', 'validation_failed'
    error_code TEXT,                               -- e.g., 'ERR_PROXY_CONNECTION_FAILED', '600010'
    error_message TEXT NOT NULL,
    
    -- Context when failure occurred
    context JSONB NOT NULL DEFAULT '{}',            -- Full context: URL, task, proxy used, etc.
    task_description TEXT,                         -- What the agent was trying to do
    
    -- Failure analysis (filled by learning system)
    root_cause TEXT,                               -- AI-analyzed root cause
    contributing_factors JSONB DEFAULT '[]',       -- Array of factors that contributed
    severity TEXT DEFAULT 'medium',                -- 'low', 'medium', 'high', 'critical'
    
    -- Resolution tracking
    resolved BOOLEAN DEFAULT false,
    resolution_strategy TEXT,                      -- How it was eventually resolved
    resolution_context JSONB,                      -- Context of successful resolution
    
    -- Metadata
    occurred_at TIMESTAMP DEFAULT NOW() NOT NULL,
    resolved_at TIMESTAMP,
    times_occurred INTEGER DEFAULT 1,             -- How many times this exact failure happened
    
    -- Indexing
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_agent_failures_agent_type 
    ON agent_failures(agent_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_failures_error_code 
    ON agent_failures(error_code) WHERE error_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_failures_resolved 
    ON agent_failures(resolved, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_failures_user_id 
    ON agent_failures(user_id, occurred_at DESC);

-- ============================================================================
-- TABLE 2: AGENT SOLUTIONS
-- Stores successful solutions that can be reused
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_solutions (
    id SERIAL PRIMARY KEY,
    
    -- Solution identification
    solution_hash TEXT NOT NULL UNIQUE,            -- Hash of problem+context for deduplication
    agent_type TEXT NOT NULL,                      -- Which agent this solution applies to
    problem_pattern TEXT NOT NULL,                  -- Pattern this solves (e.g., 'proxy_connection_failed')
    
    -- Solution details
    solution_strategy TEXT NOT NULL,                -- The approach that worked
    solution_context JSONB NOT NULL DEFAULT '{}',  -- Full context: what was tried, what worked
    code_example TEXT,                             -- Code/configuration that worked (if applicable)
    
    -- Success metrics
    success_rate REAL DEFAULT 1.0,                 -- 0-1, how often this solution works
    times_used INTEGER DEFAULT 1,                  -- How many times this solution was applied
    times_successful INTEGER DEFAULT 1,            -- How many times it succeeded
    average_resolution_time INTEGER,               -- Average time to resolve (ms)
    
    -- Applicability
    applicable_contexts JSONB DEFAULT '[]',        -- When this solution applies
    prerequisites JSONB DEFAULT '[]',              -- What's needed for this to work
    
    -- Sharing
    shared_with_agents TEXT[] DEFAULT ARRAY[]::TEXT[], -- Which agent types can use this
    is_global BOOLEAN DEFAULT true,                -- Can all agents use this?
    
    -- Metadata
    discovered_by TEXT,                            -- Which agent/user discovered this
    first_used_at TIMESTAMP DEFAULT NOW() NOT NULL,
    last_used_at TIMESTAMP DEFAULT NOW(),
    confidence REAL DEFAULT 0.8,                   -- 0-1, confidence this will work
    
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_solutions_agent_type 
    ON agent_solutions(agent_type, success_rate DESC);

CREATE INDEX IF NOT EXISTS idx_agent_solutions_problem_pattern 
    ON agent_solutions(problem_pattern, success_rate DESC);

CREATE INDEX IF NOT EXISTS idx_agent_solutions_global 
    ON agent_solutions(is_global, success_rate DESC) WHERE is_global = true;

CREATE INDEX IF NOT EXISTS idx_agent_solutions_last_used 
    ON agent_solutions(last_used_at DESC);

-- ============================================================================
-- TABLE 3: AGENT LEARNING PATTERNS
-- Recognizes patterns in agent behavior and outcomes
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_learning_patterns (
    id SERIAL PRIMARY KEY,
    
    -- Pattern identification
    pattern_name TEXT NOT NULL UNIQUE,             -- e.g., 'proxy_rotation_works', 'timeout_needs_increase'
    pattern_type TEXT NOT NULL,                    -- 'success_pattern', 'failure_pattern', 'optimization'
    agent_type TEXT NOT NULL,                      -- Which agent this pattern applies to
    
    -- Pattern details
    pattern_description TEXT NOT NULL,
    conditions JSONB NOT NULL DEFAULT '{}',        -- When this pattern applies
    outcome JSONB NOT NULL DEFAULT '{}',            -- What happens when pattern is followed
    
    -- Pattern strength
    confidence REAL DEFAULT 0.5,                   -- 0-1, how confident we are about this pattern
    occurrences INTEGER DEFAULT 1,                 -- How many times we've seen this pattern
    success_rate REAL DEFAULT 0.5,                 -- How often following this pattern succeeds
    
    -- Recommendations
    recommendation TEXT,                           -- What agents should do based on this pattern
    auto_apply BOOLEAN DEFAULT false,              -- Should agents automatically apply this?
    
    -- Metadata
    discovered_at TIMESTAMP DEFAULT NOW() NOT NULL,
    last_observed_at TIMESTAMP DEFAULT NOW(),
    validated BOOLEAN DEFAULT false,               -- Has this pattern been validated?
    
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_learning_patterns_agent_type 
    ON agent_learning_patterns(agent_type, confidence DESC);

CREATE INDEX IF NOT EXISTS idx_agent_learning_patterns_auto_apply 
    ON agent_learning_patterns(auto_apply, confidence DESC) WHERE auto_apply = true;

CREATE INDEX IF NOT EXISTS idx_agent_learning_patterns_validated 
    ON agent_learning_patterns(validated, confidence DESC);

-- ============================================================================
-- TABLE 4: AGENT KNOWLEDGE SHARING
-- Tracks what knowledge has been shared between agents
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_knowledge_sharing (
    id SERIAL PRIMARY KEY,
    
    -- Knowledge identification
    knowledge_id TEXT NOT NULL,                    -- Reference to solution or pattern ID
    knowledge_type TEXT NOT NULL,                  -- 'solution', 'pattern', 'failure_analysis'
    source_agent_type TEXT NOT NULL,               -- Which agent learned/discovered this
    
    -- Sharing details
    shared_with_agents TEXT[] NOT NULL,            -- Which agent types received this knowledge
    shared_at TIMESTAMP DEFAULT NOW() NOT NULL,
    
    -- Usage tracking
    times_used_by_recipients INTEGER DEFAULT 0,    -- How many times recipients used this
    success_rate_in_recipients REAL DEFAULT 0.0,   -- How well it worked for recipients
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_sharing_source 
    ON agent_knowledge_sharing(source_agent_type, shared_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_knowledge_sharing_knowledge 
    ON agent_knowledge_sharing(knowledge_id, knowledge_type);

-- ============================================================================
-- HELPER FUNCTION: Record a failure
-- ============================================================================
CREATE OR REPLACE FUNCTION record_agent_failure(
    p_agent_type TEXT,
    p_failure_type TEXT,
    p_error_message TEXT,
    p_context JSONB,
    p_user_id TEXT DEFAULT NULL,
    p_error_code TEXT DEFAULT NULL,
    p_task_description TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    failure_id INTEGER;
BEGIN
    INSERT INTO agent_failures (
        agent_type,
        user_id,
        failure_type,
        error_code,
        error_message,
        context,
        task_description
    ) VALUES (
        p_agent_type,
        p_user_id,
        p_failure_type,
        p_error_code,
        p_error_message,
        p_context,
        p_task_description
    ) RETURNING id INTO failure_id;
    
    RETURN failure_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER FUNCTION: Record a successful solution
-- ============================================================================
CREATE OR REPLACE FUNCTION record_agent_solution(
    p_agent_type TEXT,
    p_problem_pattern TEXT,
    p_solution_strategy TEXT,
    p_solution_context JSONB,
    p_discovered_by TEXT DEFAULT NULL,
    p_code_example TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    solution_id INTEGER;
    solution_hash TEXT;
BEGIN
    -- Generate hash from problem pattern + strategy
    solution_hash := MD5(p_problem_pattern || p_solution_strategy || p_agent_type);
    
    -- Insert or update existing solution
    INSERT INTO agent_solutions (
        solution_hash,
        agent_type,
        problem_pattern,
        solution_strategy,
        solution_context,
        discovered_by,
        code_example
    ) VALUES (
        solution_hash,
        p_agent_type,
        p_problem_pattern,
        p_solution_strategy,
        p_solution_context,
        p_discovered_by,
        p_code_example
    )
    ON CONFLICT (agent_solutions.solution_hash) 
    DO UPDATE SET
        times_used = agent_solutions.times_used + 1,
        times_successful = agent_solutions.times_successful + 1,
        success_rate = (agent_solutions.times_successful + 1.0) / (agent_solutions.times_used + 1.0),
        last_used_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO solution_id;
    
    RETURN solution_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER FUNCTION: Get solutions for a problem
-- ============================================================================
CREATE OR REPLACE FUNCTION get_agent_solutions(
    p_agent_type TEXT,
    p_problem_pattern TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    id INTEGER,
    solution_strategy TEXT,
    solution_context JSONB,
    success_rate REAL,
    times_used INTEGER,
    code_example TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.solution_strategy,
        s.solution_context,
        s.success_rate,
        s.times_used,
        s.code_example
    FROM agent_solutions s
    WHERE s.agent_type = p_agent_type
        AND (p_problem_pattern IS NULL OR s.problem_pattern = p_problem_pattern)
        AND (s.is_global = true OR p_agent_type = ANY(s.shared_with_agents))
    ORDER BY s.success_rate DESC, s.times_used DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER FUNCTION: Share knowledge with other agents
-- ============================================================================
CREATE OR REPLACE FUNCTION share_knowledge_with_agents(
    p_knowledge_id TEXT,
    p_knowledge_type TEXT,
    p_source_agent_type TEXT,
    p_recipient_agent_types TEXT[]
)
RETURNS INTEGER AS $$
DECLARE
    sharing_id INTEGER;
BEGIN
    INSERT INTO agent_knowledge_sharing (
        knowledge_id,
        knowledge_type,
        source_agent_type,
        shared_with_agents
    ) VALUES (
        p_knowledge_id,
        p_knowledge_type,
        p_source_agent_type,
        p_recipient_agent_types
    ) RETURNING id INTO sharing_id;
    
    -- Update solution to mark as shared
    IF p_knowledge_type = 'solution' THEN
        UPDATE agent_solutions
        SET shared_with_agents = array_cat(shared_with_agents, p_recipient_agent_types),
            updated_at = NOW()
        WHERE id::TEXT = p_knowledge_id;
    END IF;
    
    RETURN sharing_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE agent_failures IS 'Tracks agent failures for analysis and learning';
COMMENT ON TABLE agent_solutions IS 'Stores successful solutions that can be reused by agents';
COMMENT ON TABLE agent_learning_patterns IS 'Recognizes patterns in agent behavior and outcomes';
COMMENT ON TABLE agent_knowledge_sharing IS 'Tracks knowledge sharing between agents';

COMMENT ON COLUMN agent_failures.context IS 'Full context when failure occurred (URL, task, proxy, etc.)';
COMMENT ON COLUMN agent_solutions.solution_hash IS 'Hash for deduplication of similar solutions';
COMMENT ON COLUMN agent_solutions.success_rate IS '0-1 ratio of successful applications';
COMMENT ON COLUMN agent_learning_patterns.auto_apply IS 'Whether agents should automatically apply this pattern';

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get recent failures for an agent type:
-- SELECT * FROM agent_failures 
-- WHERE agent_type = 'browser_use' 
-- ORDER BY occurred_at DESC LIMIT 10;

-- Get best solutions for a problem:
-- SELECT * FROM get_agent_solutions('browser_use', 'proxy_connection_failed', 5);

-- Get unresolved failures:
-- SELECT * FROM agent_failures 
-- WHERE resolved = false 
-- ORDER BY times_occurred DESC, occurred_at DESC;

-- Get patterns that should be auto-applied:
-- SELECT * FROM agent_learning_patterns 
-- WHERE auto_apply = true AND validated = true
-- ORDER BY confidence DESC;

-- ============================================================================
-- AUTOMATIC CLEANUP FUNCTION
-- Keeps database size manageable by removing old data
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_learning_data()
RETURNS TABLE (
  failures_deleted INTEGER,
  knowledge_sharing_deleted INTEGER
) AS $$
DECLARE
  failures_count INTEGER;
  knowledge_count INTEGER;
BEGIN
  -- Delete resolved failures older than 30 days
  DELETE FROM agent_failures
  WHERE resolved = true
    AND occurred_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS failures_count = ROW_COUNT;
  
  -- Delete old knowledge sharing events (older than 90 days)
  DELETE FROM agent_knowledge_sharing
  WHERE shared_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS knowledge_count = ROW_COUNT;
  
  RETURN QUERY SELECT failures_count, knowledge_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SCHEDULE CLEANUP (Optional - requires pg_cron extension)
-- ============================================================================
-- Uncomment if you have pg_cron extension enabled:
-- SELECT cron.schedule('cleanup-learning-data', '0 2 * * *', 'SELECT cleanup_old_learning_data();');
-- This runs cleanup daily at 2 AM

-- ============================================================================
-- MANUAL CLEANUP (Run this periodically)
-- ============================================================================
-- SELECT * FROM cleanup_old_learning_data();
-- This will return how many rows were deleted

COMMIT;


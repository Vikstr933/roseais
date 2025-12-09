-- ============================================================================
-- SMART ASSISTANT MEMORY SYSTEM
-- ============================================================================
-- Created: 2025-12-05
-- Purpose: Efficient, persistent memory for ELON and other AI assistants
--
-- Design Philosophy:
-- 1. SHORT-TERM: Keep last 15 raw messages per session (recent context)
-- 2. LONG-TERM: Extract and store key facts/memories (compressed knowledge)
-- 3. AUTO-CLEANUP: Summarize old messages into facts, then delete
-- 
-- This saves ~90% storage compared to keeping all messages!
-- ============================================================================

-- ============================================================================
-- TABLE 1: ASSISTANT SESSIONS
-- Tracks active conversation sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS assistant_sessions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,                    -- Unique session/channel ID
    platform TEXT NOT NULL DEFAULT 'discord',    -- 'discord', 'web', 'api'
    channel_name TEXT,                           -- Discord channel name (optional)
    is_private_dm BOOLEAN DEFAULT false,
    message_count INTEGER DEFAULT 0,
    last_activity TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Unique constraint per user+session
    UNIQUE(user_id, session_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_assistant_sessions_user 
    ON assistant_sessions(user_id, last_activity DESC);

-- ============================================================================
-- TABLE 2: ASSISTANT MESSAGES (SHORT-TERM MEMORY)
-- Rolling window of recent messages - auto-pruned to last 15 per session
-- ============================================================================
CREATE TABLE IF NOT EXISTS assistant_messages (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    tool_use JSONB,                              -- Tool calls made (if any)
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Compound index for efficient session queries
CREATE INDEX IF NOT EXISTS idx_assistant_messages_session 
    ON assistant_messages(user_id, session_id, created_at DESC);

-- ============================================================================
-- TABLE 3: ASSISTANT MEMORIES (LONG-TERM MEMORY)
-- AI-extracted facts and knowledge - compressed from conversations
-- ============================================================================
CREATE TABLE IF NOT EXISTS assistant_memories (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Memory categorization
    category TEXT NOT NULL,                      -- 'preference', 'fact', 'contact', 'task', 'context'
    subcategory TEXT,                            -- More specific: 'email_style', 'work_hours', etc.
    
    -- The actual memory
    key TEXT NOT NULL,                           -- Short identifier: "girlfriend_name", "preferred_language"
    value TEXT NOT NULL,                         -- The actual memory: "Elin", "Swedish"
    
    -- Metadata
    confidence REAL DEFAULT 0.8,                 -- 0-1, how confident AI is about this
    source TEXT,                                 -- Where this was learned: "conversation", "explicit"
    times_referenced INTEGER DEFAULT 0,          -- How often this memory is used
    
    -- Timestamps
    learned_at TIMESTAMP DEFAULT NOW() NOT NULL,
    last_used TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,                        -- Optional expiration for time-sensitive info
    
    -- Prevent duplicate memories
    UNIQUE(user_id, category, key)
);

-- Index for fast memory lookups
CREATE INDEX IF NOT EXISTS idx_assistant_memories_user_category 
    ON assistant_memories(user_id, category);

CREATE INDEX IF NOT EXISTS idx_assistant_memories_key 
    ON assistant_memories(user_id, key);

-- ============================================================================
-- TABLE 4: ASSISTANT CONVERSATION SUMMARIES
-- Compressed summaries of past conversation threads
-- ============================================================================
CREATE TABLE IF NOT EXISTS assistant_summaries (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    
    -- Summary content
    summary TEXT NOT NULL,                       -- AI-generated conversation summary
    key_topics TEXT[],                           -- Main topics discussed
    action_items TEXT[],                         -- Any tasks/actions mentioned
    entities_mentioned JSONB,                    -- People, places, things mentioned
    
    -- Time range this summary covers
    messages_summarized INTEGER NOT NULL,        -- How many messages were summarized
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assistant_summaries_user_session 
    ON assistant_summaries(user_id, session_id, created_at DESC);

-- ============================================================================
-- HELPER FUNCTION: Prune old messages (keep last 15 per session)
-- Run this periodically or after each new message
-- ============================================================================
CREATE OR REPLACE FUNCTION prune_assistant_messages(p_user_id TEXT, p_session_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY user_id, session_id 
            ORDER BY created_at DESC
        ) as rn
        FROM assistant_messages
        WHERE user_id = p_user_id AND session_id = p_session_id
    )
    DELETE FROM assistant_messages 
    WHERE id IN (SELECT id FROM ranked WHERE rn > 15);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA: Insert some test memories
-- ============================================================================

-- Example: Insert a memory about user's girlfriend
-- INSERT INTO assistant_memories (user_id, category, subcategory, key, value, source)
-- VALUES (
--     'your-user-id-here',
--     'contact',
--     'relationship',
--     'girlfriend_name',
--     'Elin',
--     'conversation'
-- );

-- Example: Insert a preference
-- INSERT INTO assistant_memories (user_id, category, subcategory, key, value, source)
-- VALUES (
--     'your-user-id-here',
--     'preference',
--     'communication',
--     'preferred_language',
--     'Swedish',
--     'explicit'
-- );

-- ============================================================================
-- USEFUL QUERIES
-- ============================================================================

-- Get all memories for a user:
-- SELECT * FROM assistant_memories WHERE user_id = 'your-user-id' ORDER BY last_used DESC;

-- Get recent messages for a session:
-- SELECT * FROM assistant_messages 
-- WHERE user_id = 'your-user-id' AND session_id = 'session-id'
-- ORDER BY created_at DESC LIMIT 15;

-- Get conversation summaries:
-- SELECT * FROM assistant_summaries 
-- WHERE user_id = 'your-user-id' 
-- ORDER BY created_at DESC LIMIT 5;

-- Count messages per session:
-- SELECT session_id, COUNT(*) as msg_count 
-- FROM assistant_messages 
-- WHERE user_id = 'your-user-id'
-- GROUP BY session_id;

-- ============================================================================
-- CLEANUP: Delete old summaries (keep last 30 days)
-- ============================================================================
-- DELETE FROM assistant_summaries WHERE created_at < NOW() - INTERVAL '30 days';

-- ============================================================================
-- GRANT PERMISSIONS (if needed)
-- ============================================================================
-- GRANT ALL ON assistant_sessions TO your_app_user;
-- GRANT ALL ON assistant_messages TO your_app_user;
-- GRANT ALL ON assistant_memories TO your_app_user;
-- GRANT ALL ON assistant_summaries TO your_app_user;

COMMIT;


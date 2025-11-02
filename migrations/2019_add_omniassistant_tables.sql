-- Migration: Add OmniAssistant Tables for Digital Office Platform
-- Description: Add tables for persistent conversation memory, AI-learned preferences, and proactive insights
-- Date: 2025-11-02
-- Phase: Fas 1 - Core Infrastructure & OmniAssistant

-- Conversations table
-- Stores persistent conversation memory for context-aware AI assistance
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  context_type VARCHAR(100) NOT NULL, -- 'general', 'coding', 'marketing', 'crm', 'analytics', 'database', 'guidance'
  summary TEXT NOT NULL, -- AI-generated summary of the conversation
  key_points JSONB DEFAULT '[]'::jsonb, -- Important takeaways from the conversation
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_referenced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_conversation_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_context_type ON conversations(context_type);
CREATE INDEX idx_conversations_last_referenced ON conversations(last_referenced DESC);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);

-- User Preferences table
-- Stores AI-learned user preferences and patterns
CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  preference_type VARCHAR(100) NOT NULL, -- 'coding_style', 'communication_tone', 'work_hours', 'project_type', 'ui_preferences', etc.
  value JSONB NOT NULL, -- Flexible JSON storage for any preference type
  confidence_score REAL DEFAULT 0.5, -- 0-1 range, how confident AI is about this preference
  learned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_user_preference_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_user_preference UNIQUE(user_id, preference_type)
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_preference_type ON user_preferences(preference_type);
CREATE INDEX idx_user_preferences_confidence_score ON user_preferences(confidence_score DESC);
CREATE INDEX idx_user_preferences_learned_at ON user_preferences(learned_at DESC);

-- AI Insights table
-- Stores proactive AI-generated insights and suggestions
CREATE TABLE IF NOT EXISTS ai_insights (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  insight_type VARCHAR(100) NOT NULL, -- 'opportunity', 'warning', 'suggestion', 'trend', 'anomaly', 'celebration'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb, -- Supporting data like metrics, charts, links
  priority INTEGER DEFAULT 1 NOT NULL, -- 1-5, where 5 is highest priority
  dismissed BOOLEAN DEFAULT false,
  action_taken BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP, -- Optional expiration for time-sensitive insights

  CONSTRAINT fk_ai_insight_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT check_priority_range CHECK (priority >= 1 AND priority <= 5)
);

CREATE INDEX idx_ai_insights_user_id ON ai_insights(user_id);
CREATE INDEX idx_ai_insights_insight_type ON ai_insights(insight_type);
CREATE INDEX idx_ai_insights_priority ON ai_insights(priority DESC);
CREATE INDEX idx_ai_insights_dismissed ON ai_insights(dismissed);
CREATE INDEX idx_ai_insights_created_at ON ai_insights(created_at DESC);
CREATE INDEX idx_ai_insights_expires_at ON ai_insights(expires_at);
CREATE INDEX idx_ai_insights_active ON ai_insights(user_id, dismissed, expires_at) WHERE dismissed = false AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);

-- Comments explaining the schema design
COMMENT ON TABLE conversations IS 'Persistent conversation memory for context-aware AI assistance across sessions';
COMMENT ON TABLE user_preferences IS 'AI-learned user preferences and patterns to personalize the experience';
COMMENT ON TABLE ai_insights IS 'Proactive AI-generated insights, suggestions, and opportunities';

COMMENT ON COLUMN conversations.context_type IS 'Domain context: general, coding, marketing, crm, analytics, database, guidance';
COMMENT ON COLUMN conversations.key_points IS 'Array of important takeaways extracted by AI';
COMMENT ON COLUMN user_preferences.confidence_score IS 'AI confidence level (0-1) about this preference';
COMMENT ON COLUMN ai_insights.priority IS 'Insight priority 1-5, where 5 is critical/urgent';
COMMENT ON COLUMN ai_insights.expires_at IS 'Time-sensitive insights expire after this timestamp';

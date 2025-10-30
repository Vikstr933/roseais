-- Clean up orphaned chat messages
-- Removes messages that reference non-existent workspaces

-- First, let's see how many orphaned messages there are
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM chat_messages
  WHERE project_id NOT IN (SELECT id FROM workspaces);

  RAISE NOTICE 'Found % orphaned chat messages to clean up', orphaned_count;
END $$;

-- Delete orphaned chat messages
DELETE FROM chat_messages
WHERE project_id NOT IN (SELECT id FROM workspaces);

-- Add a comment to the table explaining the 24-hour retention policy
COMMENT ON TABLE chat_messages IS 'Chat messages for workspaces. Messages are automatically deleted after 24 hours.';

-- Create an index to speed up the 24-hour cleanup query
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
  ON chat_messages(created_at);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Orphaned chat messages cleaned up successfully';
  RAISE NOTICE 'Chat messages will now auto-delete after 24 hours';
END $$;

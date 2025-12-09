-- ============================================================
-- PUBLIC PROJECTS, SCREENSHOTS, REMIXES, AND VOTES
-- ============================================================

-- Add public project fields to workspaces
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS screenshot_url TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS remix_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS vote_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create project_remixes table to track remix relationships
CREATE TABLE IF NOT EXISTS project_remixes (
  id SERIAL PRIMARY KEY,
  original_project_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  remixed_project_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  remixed_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(original_project_id, remixed_project_id)
);

-- Create project_votes table
CREATE TABLE IF NOT EXISTS project_votes (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Create project_views table for analytics
CREATE TABLE IF NOT EXISTS project_views (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspaces_is_public ON workspaces(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_workspaces_featured ON workspaces(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_workspaces_remix_count ON workspaces(remix_count DESC);
CREATE INDEX IF NOT EXISTS idx_workspaces_vote_count ON workspaces(vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_project_remixes_original ON project_remixes(original_project_id);
CREATE INDEX IF NOT EXISTS idx_project_remixes_remixed ON project_remixes(remixed_project_id);
CREATE INDEX IF NOT EXISTS idx_project_votes_project ON project_votes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_views_project ON project_views(project_id);
CREATE INDEX IF NOT EXISTS idx_project_views_viewed_at ON project_views(viewed_at DESC);

-- Function to update remix count
CREATE OR REPLACE FUNCTION update_remix_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE workspaces 
  SET remix_count = (
    SELECT COUNT(*) 
    FROM project_remixes 
    WHERE original_project_id = NEW.original_project_id
  )
  WHERE id = NEW.original_project_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update remix count
DROP TRIGGER IF EXISTS trigger_update_remix_count ON project_remixes;
CREATE TRIGGER trigger_update_remix_count
  AFTER INSERT ON project_remixes
  FOR EACH ROW
  EXECUTE FUNCTION update_remix_count();

-- Function to update vote count
CREATE OR REPLACE FUNCTION update_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE workspaces 
    SET vote_count = vote_count + 1
    WHERE id = NEW.project_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE workspaces 
    SET vote_count = GREATEST(0, vote_count - 1)
    WHERE id = OLD.project_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update vote count
DROP TRIGGER IF EXISTS trigger_update_vote_count_insert ON project_votes;
DROP TRIGGER IF EXISTS trigger_update_vote_count_delete ON project_votes;
CREATE TRIGGER trigger_update_vote_count_insert
  AFTER INSERT ON project_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_vote_count();

CREATE TRIGGER trigger_update_vote_count_delete
  AFTER DELETE ON project_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_vote_count();

SELECT 'Public projects features added successfully!' AS status;


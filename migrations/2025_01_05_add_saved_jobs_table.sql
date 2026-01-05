-- Migration: Add saved_jobs table
-- Date: 2025-01-05
-- Description: Creates table for users to save job listings

-- Create saved_jobs table
CREATE TABLE IF NOT EXISTS saved_jobs (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  job_url TEXT,
  job_id TEXT, -- External job ID from JobTech API or other source
  job_description TEXT,
  match_percentage INTEGER,
  matched_skills JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  saved_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_id ON saved_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_job_id ON saved_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_saved_at ON saved_jobs(saved_at DESC);

-- Add comment
COMMENT ON TABLE saved_jobs IS 'Stores jobs saved by users for later review';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ saved_jobs table created successfully';
END $$;


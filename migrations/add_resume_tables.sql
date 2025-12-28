-- ==================================================================
-- CV-ANALYS TABLES - Resume Analysis & Job Matching
-- Run this in Supabase SQL Editor
-- ==================================================================

-- Resumes table - Stores uploaded CV files and metadata
CREATE TABLE IF NOT EXISTS resumes (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type VARCHAR(50), -- 'pdf', 'docx', 'tex'
  parsed_data JSONB DEFAULT '{}'::jsonb,
  raw_text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for resumes table (only if they don't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_resumes_user_id') THEN
    CREATE INDEX idx_resumes_user_id ON resumes(user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_resumes_created_at') THEN
    CREATE INDEX idx_resumes_created_at ON resumes(created_at DESC);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_resumes_file_type') THEN
    CREATE INDEX idx_resumes_file_type ON resumes(file_type);
  END IF;
END $$;

-- Resume analyses table - Stores analysis results and scores
CREATE TABLE IF NOT EXISTS resume_analyses (
  id SERIAL PRIMARY KEY,
  resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  ats_score INTEGER NOT NULL CHECK (ats_score >= 0 AND ats_score <= 100),
  content_score INTEGER NOT NULL CHECK (content_score >= 0 AND content_score <= 100),
  completeness_score INTEGER NOT NULL CHECK (completeness_score >= 0 AND completeness_score <= 100),
  keyword_score INTEGER NOT NULL CHECK (keyword_score >= 0 AND keyword_score <= 100),
  improvements JSONB DEFAULT '[]'::jsonb,
  analyzed_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for resume_analyses table (only if they don't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_resume_analyses_resume_id') THEN
    CREATE INDEX idx_resume_analyses_resume_id ON resume_analyses(resume_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_resume_analyses_overall_score') THEN
    CREATE INDEX idx_resume_analyses_overall_score ON resume_analyses(overall_score DESC);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_resume_analyses_analyzed_at') THEN
    CREATE INDEX idx_resume_analyses_analyzed_at ON resume_analyses(analyzed_at DESC);
  END IF;
END $$;

-- Job matches table - Stores matched jobs from JobTech API
CREATE TABLE IF NOT EXISTS job_matches (
  id SERIAL PRIMARY KEY,
  resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  job_title VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  location VARCHAR(255),
  match_percentage INTEGER NOT NULL CHECK (match_percentage >= 0 AND match_percentage <= 100),
  job_description TEXT,
  job_url TEXT,
  job_id TEXT, -- External job ID from JobTech API
  required_skills JSONB DEFAULT '[]'::jsonb,
  matched_skills JSONB DEFAULT '[]'::jsonb,
  missing_skills JSONB DEFAULT '[]'::jsonb,
  matched_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for job_matches table (only if they don't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_job_matches_resume_id') THEN
    CREATE INDEX idx_job_matches_resume_id ON job_matches(resume_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_job_matches_match_percentage') THEN
    CREATE INDEX idx_job_matches_match_percentage ON job_matches(match_percentage DESC);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_job_matches_matched_at') THEN
    CREATE INDEX idx_job_matches_matched_at ON job_matches(matched_at DESC);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_job_matches_job_id') THEN
    CREATE INDEX idx_job_matches_job_id ON job_matches(job_id);
  END IF;
END $$;

-- Job search queries cache table - Caches job search results
CREATE TABLE IF NOT EXISTS job_search_queries (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_keywords TEXT NOT NULL,
  location TEXT,
  results JSONB,
  total_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP -- Cache expiration time
);

-- Create indexes for job_search_queries table (only if they don't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_job_search_queries_user_id') THEN
    CREATE INDEX idx_job_search_queries_user_id ON job_search_queries(user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_job_search_queries_expires_at') THEN
    CREATE INDEX idx_job_search_queries_expires_at ON job_search_queries(expires_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_job_search_queries_created_at') THEN
    CREATE INDEX idx_job_search_queries_created_at ON job_search_queries(created_at DESC);
  END IF;
END $$;

-- Add comments to tables for documentation
COMMENT ON TABLE resumes IS 'Stores uploaded CV files (PDF, DOCX, LaTeX) with parsed data';
COMMENT ON TABLE resume_analyses IS 'Stores AI-powered resume analysis results and scores';
COMMENT ON TABLE job_matches IS 'Stores matched job listings from JobTech API';
COMMENT ON TABLE job_search_queries IS 'Caches job search results to reduce API calls';

-- Add comments to important columns
COMMENT ON COLUMN resumes.parsed_data IS 'Structured data extracted from CV (contact info, sections, skills)';
COMMENT ON COLUMN resumes.raw_text IS 'Raw extracted text from CV file';
COMMENT ON COLUMN resume_analyses.improvements IS 'Array of improvement suggestions from AI analysis';
COMMENT ON COLUMN job_matches.required_skills IS 'Skills required for the job from JobTech API';
COMMENT ON COLUMN job_matches.matched_skills IS 'Skills from resume that match job requirements';
COMMENT ON COLUMN job_matches.missing_skills IS 'Required skills that are missing from resume';


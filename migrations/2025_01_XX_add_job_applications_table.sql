-- Migration: Add job_applications table for tracking job applications
-- Date: 2025-01-XX

CREATE TABLE IF NOT EXISTS job_applications (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resume_id INTEGER REFERENCES resumes(id) ON DELETE SET NULL,
  job_id INTEGER, -- Optional reference to external job
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'viewed', 'interview', 'rejected', 'offer', 'accepted', 'declined')),
  applied_at TIMESTAMP DEFAULT NOW(),
  company_name TEXT,
  job_title TEXT NOT NULL,
  location TEXT,
  application_method TEXT CHECK (application_method IN ('email', 'form', 'linkedin', 'website', 'manual')),
  job_url TEXT,
  recruiter_email TEXT,
  email_sent BOOLEAN DEFAULT false,
  email_opened BOOLEAN DEFAULT false,
  email_opened_at TIMESTAMP,
  email_replied BOOLEAN DEFAULT false,
  email_replied_at TIMESTAMP,
  interview_scheduled BOOLEAN DEFAULT false,
  interview_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_job_applications_user_id ON job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_resume_id ON job_applications(resume_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_applied_at ON job_applications(applied_at);
CREATE INDEX IF NOT EXISTS idx_job_applications_company_name ON job_applications(company_name);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_job_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_job_applications_updated_at
  BEFORE UPDATE ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_job_applications_updated_at();

-- Add comment to table
COMMENT ON TABLE job_applications IS 'Tracks all job applications made by users';
COMMENT ON COLUMN job_applications.status IS 'Current status: applied, viewed, interview, rejected, offer, accepted, declined';
COMMENT ON COLUMN job_applications.application_method IS 'How the application was submitted: email, form, linkedin, website, manual';


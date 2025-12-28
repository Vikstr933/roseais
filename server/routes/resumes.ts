import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticateUser } from '../middleware/auth';
import { db } from '../../db';
import { resumes, resumeAnalyses, jobMatches } from '../../db/schema-pg';
import { eq, desc } from 'drizzle-orm';
import { resumeParserService } from '../services/ResumeParserService';
import { resumeScoringService } from '../services/ResumeScoringService';
import { jobMatchingService } from '../services/JobMatchingService';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'application/x-latex', // LaTeX source
      'text/x-latex', // LaTeX source (alternative MIME)
      'text/plain', // .tex files are often plain text
    ];
    const allowedExtensions = ['.pdf', '.docx', '.tex'];
    const fileExtension = '.' + file.originalname.split('.').pop()?.toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, and TEX files are allowed.'));
    }
  },
});

// POST /api/resumes/upload
router.post('/upload', authenticateUser, upload.single('resume'), async (req, res) => {
  try {
    const userId = (req as any).user!.id;
    const file = (req as any).file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse resume
    const parsedData = await resumeParserService.parseResume(file.buffer, file.mimetype, file.originalname);

    // Generate unique filename
    const resumeId = uuidv4();
    const fileExtension = file.mimetype === 'application/pdf' 
      ? 'pdf' 
      : file.mimetype.includes('wordprocessingml') 
        ? 'docx' 
        : 'tex';
    const filename = `${resumeId}.${fileExtension}`;
    const filePath = `resumes/${userId}/${filename}`;

    // Upload to local storage (R2 can be added later if needed)
    const uploadDir = path.join(process.cwd(), 'uploads', 'resumes', userId);
    await fs.mkdir(uploadDir, { recursive: true });
    const localPath = path.join(uploadDir, filename);
    await fs.writeFile(localPath, file.buffer);
    const storageUrl = `/uploads/resumes/${userId}/${filename}`;

    // Save to database
    const [resume] = await db
      .insert(resumes)
      .values({
        userId,
        filename: file.originalname,
        filePath: storageUrl,
        fileSize: file.size,
        fileType: fileExtension,
        parsedData: parsedData as any,
        rawText: parsedData.rawText,
      })
      .returning();

    res.json({
      success: true,
      resume: {
        id: resume.id,
        filename: resume.filename,
        createdAt: resume.createdAt,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Failed to upload resume',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/resumes
router.get('/', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user!.id;

    const userResumes = await db
      .select()
      .from(resumes)
      .where(eq(resumes.userId, userId))
      .orderBy(desc(resumes.createdAt));

    res.json({
      resumes: userResumes.map(r => ({
        id: r.id,
        filename: r.filename,
        fileType: r.fileType,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching resumes:', error);
    res.status(500).json({ error: 'Failed to fetch resumes' });
  }
});

// GET /api/resumes/:id
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user!.id;
    const resumeId = parseInt(req.params.id);

    const [resume] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.id, resumeId))
      .limit(1);

    if (!resume || resume.userId !== userId) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    res.json({ resume });
  } catch (error) {
    console.error('Error fetching resume:', error);
    res.status(500).json({ error: 'Failed to fetch resume' });
  }
});

// POST /api/resumes/:id/analyze
router.post('/:id/analyze', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user!.id;
    const resumeId = parseInt(req.params.id);

    // Get resume
    const [resume] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.id, resumeId))
      .limit(1);

    if (!resume || resume.userId !== userId) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    if (!resume.rawText) {
      return res.status(400).json({ error: 'Resume text not available' });
    }

    // Analyze resume
    const score = await resumeScoringService.analyzeResume(
      resume.rawText,
      resume.parsedData as any
    );

    // Save analysis
    const [analysis] = await db
      .insert(resumeAnalyses)
      .values({
        resumeId,
        overallScore: score.overallScore,
        atsScore: score.atsScore,
        contentScore: score.contentScore,
        completenessScore: score.completenessScore,
        keywordScore: score.keywordScore,
        improvements: score.improvements as any,
      })
      .returning();

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error('Error analyzing resume:', error);
    res.status(500).json({ error: 'Failed to analyze resume' });
  }
});

// GET /api/resumes/:id/analysis
router.get('/:id/analysis', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user!.id;
    const resumeId = parseInt(req.params.id);

    // Check ownership
    const [resume] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.id, resumeId))
      .limit(1);

    if (!resume || resume.userId !== userId) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    // Get latest analysis
    const [analysis] = await db
      .select()
      .from(resumeAnalyses)
      .where(eq(resumeAnalyses.resumeId, resumeId))
      .orderBy(desc(resumeAnalyses.analyzedAt))
      .limit(1);

    if (!analysis) {
      return res.status(404).json({ error: 'No analysis found for this resume' });
    }

    res.json({ analysis });
  } catch (error) {
    console.error('Error fetching analysis:', error);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
});

// GET /api/resumes/:id/job-matches
router.get('/:id/job-matches', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user!.id;
    const resumeId = parseInt(req.params.id);
    const { keywords, location } = req.query;

    // Get resume
    const [resume] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.id, resumeId))
      .limit(1);

    if (!resume || resume.userId !== userId) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    // Search for jobs (JobTech API allows up to 100 results per request)
    const searchKeywords = (keywords as string) || 'utvecklare';
    const jobs = await jobMatchingService.searchJobs(
      searchKeywords,
      location as string | undefined,
      100 // Max allowed by JobTech API
    );

    // Match resume to jobs
    const parsedData = resume.parsedData as any;
    const resumeSkills = parsedData?.sections?.skills || [];
    const matches = await jobMatchingService.matchResumeToJobs(
      resume.rawText || '',
      resumeSkills,
      jobs
    );

    // Save top matches to database
    const topMatches = matches.slice(0, 10);
    for (const match of topMatches) {
      await db.insert(jobMatches).values({
        resumeId,
        jobTitle: match.job.title,
        company: match.job.company,
        location: match.job.location,
        matchPercentage: match.matchPercentage,
        jobDescription: match.job.description,
        jobUrl: match.job.url,
        jobId: match.job.id,
        requiredSkills: match.job.requiredSkills as any,
        matchedSkills: match.matchedSkills as any,
        missingSkills: match.missingSkills as any,
      });
    }

    res.json({
      matches: topMatches,
    });
  } catch (error) {
    console.error('Error matching jobs:', error);
    res.status(500).json({ error: 'Failed to match jobs' });
  }
});

// DELETE /api/resumes/:id
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user!.id;
    const resumeId = parseInt(req.params.id);

    // Check ownership
    const [resume] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.id, resumeId))
      .limit(1);

    if (!resume || resume.userId !== userId) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    // Delete from database (cascade will delete analyses and matches)
    await db.delete(resumes).where(eq(resumes.id, resumeId));

    // TODO: Delete file from R2/local storage

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting resume:', error);
    res.status(500).json({ error: 'Failed to delete resume' });
  }
});

export default router;


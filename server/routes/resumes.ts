import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticateUser } from '../middleware/auth';
import { db } from '../../db';
import { resumes, resumeAnalyses, jobMatches } from '../../db/schema-pg';
import { eq, desc, and } from 'drizzle-orm';
import { resumeParserService } from '../services/ResumeParserService';
import { resumeScoringService } from '../services/ResumeScoringService';
import { jobMatchingService } from '../services/JobMatchingService';
import { resumeAdaptationService } from '../services/ResumeAdaptationService';
import { resumeKeywordExtractor } from '../services/ResumeKeywordExtractor';
import { applicationService } from '../services/ApplicationService';
import { resumeImprovementService } from '../services/ResumeImprovementService';
import { resumePDFService } from '../services/ResumePDFService';
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
    console.log('[ResumeUpload] Request received');
    const userId = (req as any).user!.id;
    const file = (req as any).file;
    
    console.log('[ResumeUpload] User ID:', userId);
    console.log('[ResumeUpload] File:', file ? { name: file.originalname, size: file.size, mimetype: file.mimetype } : 'No file');

    if (!file) {
      console.log('[ResumeUpload] No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log('[ResumeUpload] Starting file parsing...');

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

    console.log('[ResumeUpload] Resume saved successfully, ID:', resume.id);
    
    res.json({
      success: true,
      resume: {
        id: resume.id,
        filename: resume.filename,
        createdAt: resume.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[ResumeUpload] Error:', error);
    
    // Handle multer errors
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File too large',
          message: 'File size exceeds the maximum allowed size of 5MB',
        });
      }
      return res.status(400).json({
        error: 'Upload error',
        message: error.message,
      });
    }
    
    // Handle file filter errors
    if (error.message && error.message.includes('Invalid file type')) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: error.message,
      });
    }
    
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
      success: true,
      resumes: userResumes.map(r => ({
        id: r.id,
        filename: r.filename,
        fileType: r.fileType,
        filePath: r.filePath,
        fileSize: r.fileSize,
        rawText: r.rawText,
        parsedData: r.parsedData,
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
      resume.parsedData as any,
      resume.fileType || undefined
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
        // Store detailed feedback in improvements field as JSON
        // Note: presentationScore is calculated from completenessScore for backwards compat
      })
      .returning();

    // Include detailed feedback and presentationScore in response
    res.json({
      success: true,
      analysis: {
        ...analysis,
        presentationScore: score.presentationScore,
        detailedFeedback: score.detailedFeedback,
      },
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

    // Extract relevant keywords from resume for better job matching
    const parsedData = resume.parsedData as any;
    let searchKeywords = keywords as string;
    
    // If no keywords provided, extract from resume
    if (!searchKeywords || searchKeywords === 'developer') {
      searchKeywords = resumeKeywordExtractor.extractJobSearchKeywords(
        resume.rawText || '',
        parsedData
      );
    }

    // Search for jobs (JobTech API allows up to 100 results per request)
    console.log(`[JobMatches] Searching jobs with keywords: "${searchKeywords}", location: "${location || 'none'}"`);
    const jobs = await jobMatchingService.searchJobs(
      searchKeywords,
      location as string | undefined,
      100 // Max allowed by JobTech API
    );
    console.log(`[JobMatches] JobTech API returned ${jobs.length} jobs`);

    // Extract location from resume for proximity matching
    const resumeLocation = resumeKeywordExtractor.extractLocation(
      resume.rawText || '',
      parsedData
    );
    console.log(`[JobMatches] Extracted resume location: "${resumeLocation || 'none'}"`);

    // Match resume to jobs (with location for proximity bonus)
    const resumeSkills = parsedData?.sections?.skills || [];
    const matches = await jobMatchingService.matchResumeToJobs(
      resume.rawText || '',
      resumeSkills,
      jobs,
      parsedData,
      resumeLocation || undefined
    );
    console.log(`[JobMatches] Matched ${matches.length} jobs to resume`);

    // Save top matches to database (upsert to avoid duplicates) - increased to 20
    const topMatches = matches.slice(0, 20);
    console.log(`[JobMatches] Top ${topMatches.length} matches selected`);
    for (const match of topMatches) {
      // Check if match already exists
      const existing = await db
        .select()
        .from(jobMatches)
        .where(and(
          eq(jobMatches.resumeId, resumeId),
          eq(jobMatches.jobId, match.job.id)
        ))
        .limit(1);

      if (existing.length === 0) {
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
    }

    // Transform matches to match frontend interface
    const transformedMatches = topMatches.map(match => ({
      jobTitle: match.job.title || '',
      company: match.job.company || '',
      location: match.job.location || '',
      matchPercentage: match.matchPercentage,
      jobUrl: match.job.url || '',
      applicationEmail: match.job.applicationEmail,
      applicationUrl: match.job.applicationUrl,
      applicationMethod: match.job.applicationMethod,
      matchedSkills: match.matchedSkills || [],
      missingSkills: match.missingSkills || [],
      jobId: match.job.id, // Include jobId for adaptation endpoint
      jobDescription: match.job.description || '', // Include description for adaptation
    }));

    console.log(`[JobMatches] Returning ${transformedMatches.length} matches for resume ${resumeId}`);
    console.log(`[JobMatches] First match sample:`, transformedMatches[0] ? JSON.stringify(transformedMatches[0], null, 2) : 'none');

    res.json({
      matches: transformedMatches,
    });
  } catch (error) {
    console.error('Error matching jobs:', error);
    res.status(500).json({ error: 'Failed to match jobs' });
  }
});

// POST /api/resumes/:id/adapt/:jobId
router.post('/:id/adapt/:jobId', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user!.id;
    const resumeId = parseInt(req.params.id);
    const jobId = req.params.jobId;

    // Get resume
    const [resume] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.id, resumeId))
      .limit(1);

    if (!resume || resume.userId !== userId) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    // Get job match details - try to find by jobId first
    let [jobMatch] = await db
      .select()
      .from(jobMatches)
      .where(and(eq(jobMatches.jobId, jobId), eq(jobMatches.resumeId, resumeId)))
      .limit(1);

    // If not found in database, get from API response (jobId might be in transformedMatches)
    // For now, we'll use the jobId from URL and fetch from API if needed
    if (!jobMatch) {
      // Job match might not be saved yet, so we'll need job details from the request body
      // or we can skip this check and use data from request body
      const { jobTitle, jobDescription, requiredSkills, missingSkills } = req.body;
      
      if (!jobTitle || !jobDescription) {
        return res.status(400).json({ error: 'Job details required in request body' });
      }

      // Use data from request body instead
      jobMatch = {
        jobTitle,
        jobDescription,
        requiredSkills: requiredSkills || [],
        missingSkills: missingSkills || [],
      } as any;
    }


    // Use formattedText if available (AI-formatted), otherwise use rawText
    const resumeText = (resume.parsedData as any)?.formattedText || resume.rawText || '';
    
    // Adapt resume to job
    const adaptedResume = await resumeAdaptationService.adaptResumeToJob(
      resumeText,
      resume.parsedData || {},
      jobMatch.jobTitle,
      jobMatch.jobDescription || '',
      (jobMatch.requiredSkills as string[]) || [],
      (jobMatch.missingSkills as string[]) || []
    );

    // Create a new version of the resume with metadata linking to original and job
    const adaptedFilename = `${resume.filename.replace(/\.[^/.]+$/, '')}_adapted_${jobMatch.jobTitle.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    
    // Store metadata about the adaptation
    const adaptedMetadata = {
      isAdapted: true,
      originalResumeId: resumeId,
      adaptedForJob: {
        jobId: jobId,
        jobTitle: jobMatch.jobTitle,
        company: jobMatch.company,
        matchedSkills: jobMatch.matchedSkills || [],
        missingSkills: jobMatch.missingSkills || [],
      },
      improvements: adaptedResume.improvements,
      adaptationNotes: adaptedResume.adaptationNotes,
    };

    // Merge with existing parsedData metadata
    const adaptedParsedDataWithMetadata = {
      ...adaptedResume.parsedData,
      metadata: {
        ...(adaptedResume.parsedData as any)?.metadata,
        ...adaptedMetadata,
      },
    };
    
    const [newResume] = await db
      .insert(resumes)
      .values({
        userId,
        filename: adaptedFilename,
        filePath: resume.filePath, // Keep same path structure
        fileSize: Buffer.byteLength(adaptedResume.rawText, 'utf8'),
        fileType: 'txt', // Adapted resume as text
        parsedData: adaptedParsedDataWithMetadata as any,
        rawText: adaptedResume.rawText,
      })
      .returning();

    res.json({
      success: true,
      adaptedResume: {
        id: newResume.id,
        filename: newResume.filename,
        rawText: adaptedResume.rawText,
        parsedData: adaptedResume.parsedData,
        improvements: adaptedResume.improvements,
        adaptationNotes: adaptedResume.adaptationNotes,
        adaptedForJob: {
          jobId: jobId,
          jobTitle: jobMatch.jobTitle,
          company: jobMatch.company,
        },
        originalResumeId: resumeId,
      },
    });
  } catch (error) {
    console.error('Error adapting resume:', error);
    res.status(500).json({ error: 'Failed to adapt resume' });
  }
});

// POST /api/resumes/:id/generate-application/:jobId
router.post('/:id/generate-application/:jobId', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user!.id;
    const resumeId = parseInt(req.params.id);
    const jobId = req.params.jobId;
    const { jobTitle, jobDescription, company } = req.body;

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

    // Get job match details if available
    let [jobMatch] = await db
      .select()
      .from(jobMatches)
      .where(and(eq(jobMatches.jobId, jobId), eq(jobMatches.resumeId, resumeId)))
      .limit(1);

    // Use job details from request body or from database match
    const finalJobTitle = jobTitle || jobMatch?.jobTitle || 'Jobb';
    const finalJobDescription = jobDescription || jobMatch?.jobDescription || '';
    const finalCompany = company || jobMatch?.company || 'Företag';

    if (!finalJobTitle || !finalJobDescription) {
      return res.status(400).json({ error: 'Job title and description are required' });
    }

    // Use formattedText if available (AI-formatted), otherwise use rawText
    const resumeText = (resume.parsedData as any)?.formattedText || resume.rawText || '';
    
    if (!resumeText) {
      return res.status(400).json({ error: 'Resume text not available' });
    }

    // Generate application (cover letter + resume)
    const application = await applicationService.generateApplication(
      resumeText,
      finalJobTitle,
      finalJobDescription,
      finalCompany
    );

    res.json({
      success: true,
      application,
    });
  } catch (error) {
    console.error('Error generating application:', error);
    res.status(500).json({ 
      error: 'Failed to generate application',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/resumes/:id
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user!.id;
    const resumeId = parseInt(req.params.id);
    const { rawText, parsedData } = req.body;

    // Check ownership
    const [resume] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.id, resumeId))
      .limit(1);

    if (!resume || resume.userId !== userId) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    // Update resume
    const [updatedResume] = await db
      .update(resumes)
      .set({
        rawText: rawText || resume.rawText,
        parsedData: parsedData || resume.parsedData,
        updatedAt: new Date(),
      })
      .where(eq(resumes.id, resumeId))
      .returning();

    res.json({
      success: true,
      resume: {
        id: updatedResume.id,
        filename: updatedResume.filename,
        rawText: updatedResume.rawText,
        parsedData: updatedResume.parsedData,
      },
    });
  } catch (error) {
    console.error('Error updating resume:', error);
    res.status(500).json({ error: 'Failed to update resume' });
  }
});

// POST /api/resumes/:id/apply-improvement
router.post('/:id/apply-improvement', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user!.id;
    const resumeId = parseInt(req.params.id);
    const { improvementType, improvementDescription } = req.body;

    if (!improvementType || !improvementDescription) {
      return res.status(400).json({ error: 'improvementType and improvementDescription required' });
    }

    // Get resume
    const [resume] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.id, resumeId))
      .limit(1);

    if (!resume || resume.userId !== userId) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    // Apply improvement
    const { updatedText, updatedParsedData } = await resumeImprovementService.applyImprovement(
      resume.rawText || '',
      resume.parsedData || {},
      improvementType,
      improvementDescription
    );

    // Update resume
    const [updatedResume] = await db
      .update(resumes)
      .set({
        rawText: updatedText,
        parsedData: updatedParsedData as any,
        updatedAt: new Date(),
      })
      .where(eq(resumes.id, resumeId))
      .returning();

    res.json({
      success: true,
      resume: {
        id: updatedResume.id,
        rawText: updatedResume.rawText,
        parsedData: updatedResume.parsedData,
      },
    });
  } catch (error) {
    console.error('Error applying improvement:', error);
    res.status(500).json({ error: 'Failed to apply improvement' });
  }
});

// POST /api/resumes/:id/generate-pdf
router.post('/:id/generate-pdf', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user!.id;
    const resumeId = parseInt(req.params.id);
    const { template, format, fontSize, colorScheme, resumeText, outputFormat } = req.body;

    // Get resume
    const [resume] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.id, resumeId))
      .limit(1);

    if (!resume || resume.userId !== userId) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    // Use provided text or fallback to resume text
    const textToUse = resumeText || resume.rawText;
    if (!textToUse) {
      return res.status(400).json({ error: 'Resume text not available' });
    }

    // Extract structured data from resume
    // Include filename in parsedData for name extraction
    const parsedDataWithFilename = resume.parsedData ? {
      ...resume.parsedData,
      filename: resume.filename
    } : { filename: resume.filename };
    
    const structuredData = await resumePDFService.extractStructuredData(
      textToUse,
      parsedDataWithFilename as any,
      resume.filename
    );

    // Check if user wants LaTeX instead of PDF
    const isLaTeX = outputFormat === 'latex' || outputFormat === 'tex';

    if (isLaTeX) {
      // Generate LaTeX
      const latexContent = await resumePDFService.generateLaTeX(structuredData);

      // Set headers for LaTeX download
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${resume.filename.replace(/\.[^/.]+$/, '')}_resume.tex"`);
      res.setHeader('Content-Length', Buffer.byteLength(latexContent, 'utf8').toString());

      res.send(latexContent);
    } else {
      // Generate PDF
      const pdfBuffer = await resumePDFService.generatePDF(structuredData, {
        template: template || 'modern',
        format: format || 'A4',
        fontSize: fontSize || 'medium',
        colorScheme: colorScheme || 'blue',
      });

      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${resume.filename.replace(/\.[^/.]+$/, '')}_resume.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());

      res.send(pdfBuffer);
    }
  } catch (error) {
    console.error('Error generating PDF/LaTeX:', error);
    res.status(500).json({ 
      error: 'Failed to generate file',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/resumes/:id/generate-application-pdf/:jobId
router.post('/:id/generate-application-pdf/:jobId', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user!.id;
    const resumeId = parseInt(req.params.id);
    const jobId = req.params.jobId;
    const { applicationText, jobTitle, company, template } = req.body;

    // Get resume
    const [resume] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.id, resumeId))
      .limit(1);

    if (!resume || resume.userId !== userId) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    if (!applicationText) {
      return res.status(400).json({ error: 'Application text is required' });
    }

    // Extract structured data from application text (which includes cover letter + CV)
    // For applications, we'll create a combined document
    const structuredData = await resumePDFService.extractStructuredData(
      applicationText,
      resume.parsedData as any,
      resume.filename
    );

    // Update personal info if job title/company provided
    if (jobTitle) {
      structuredData.personalInfo.title = jobTitle;
    }

    // Generate PDF
    const pdfBuffer = await resumePDFService.generatePDF(structuredData, {
      template: template || 'modern',
      format: 'A4',
      fontSize: 'medium',
      colorScheme: 'blue',
    });

    // Set headers for PDF download
    const filename = `Ansokan_${(jobTitle || 'Jobb').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length.toString());

    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating application PDF:', error);
    res.status(500).json({ 
      error: 'Failed to generate application PDF',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
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

// POST /api/resumes/preview-template - Generate preview for template selection
router.post('/preview-template', async (req, res) => {
  try {
    const { template } = req.body;

    // Create sample resume data for preview
    const sampleData = {
      personalInfo: {
        name: 'Anna Andersson',
        title: 'Frontend-utvecklare',
        email: 'anna.andersson@email.com',
        phone: '+46 70 123 45 67',
        location: 'Stockholm, Sverige',
        linkedIn: '',
        website: '',
      },
      summary: 'Erfaren frontend-utvecklare med expertis inom React, TypeScript och modern webbutveckling. Passionerad för att skapa användarvänliga gränssnitt och lösa komplexa tekniska utmaningar.',
      experience: [
        {
          title: 'Senior Frontend-utvecklare',
          company: 'Tech Solutions AB',
          location: 'Stockholm',
          startDate: '2020-01',
          endDate: '',
          current: true,
          description: 'Ledde utvecklingen av flera storskaliga React-applikationer.',
          achievements: [
            'Förbättrade prestanda med 40% genom optimering',
            'Implementerade nya funktioner med TypeScript',
          ],
        },
        {
          title: 'Frontend-utvecklare',
          company: 'Digital Agency',
          location: 'Göteborg',
          startDate: '2018-06',
          endDate: '2019-12',
          current: false,
          description: 'Utvecklade responsiva webbapplikationer för olika kunder.',
          achievements: [],
        },
      ],
      education: [
        {
          degree: 'Kandidatexamen i Datavetenskap',
          institution: 'KTH',
          location: 'Stockholm',
          startDate: '2014-09',
          endDate: '2018-06',
          gpa: '',
          honors: [],
        },
      ],
      skills: [
        {
          category: '',
          items: ['React', 'TypeScript', 'JavaScript', 'CSS', 'HTML', 'Node.js'],
        },
      ],
      certifications: [],
      languages: [
        { language: 'Svenska', level: 'Modersmål' },
        { language: 'Engelska', level: 'Flytande' },
      ],
      projects: [],
    };

    // Generate PDF preview
    const pdfBuffer = await resumePDFService.generatePDF(sampleData, {
      template: template || 'modern',
      format: 'A4',
      fontSize: 'medium',
      colorScheme: 'blue',
    });

    // Set headers for PDF preview
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="preview_${template}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length.toString());

    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating template preview:', error);
    res.status(500).json({
      error: 'Failed to generate preview',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;


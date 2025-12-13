import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { multiModelAI } from '../services/MultiModelAIService';
import { SimpleLogger } from '../utils/SimpleLogger';

const router = Router();
const logger = new SimpleLogger('DescribeProject');

/**
 * Endpoint to describe/explain an existing project
 * Takes project files and returns a natural language description
 */
router.post('/describe', authenticateUser, async (req, res) => {
  try {
    const { files, projectId } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ 
        error: 'Project files are required',
        message: 'Please provide the project files to describe'
      });
    }

    logger.info('Describing project', { fileCount: files.length, projectId });

    // Build a comprehensive description prompt
    const systemPrompt = `You are a helpful assistant that describes code projects in a clear, concise, and friendly manner.

Your task is to analyze the provided project files and create a natural language description that:
1. Explains what the project/app does
2. Describes the main features and functionality
3. Mentions the key technologies and frameworks used
4. Highlights the project structure and organization
5. Is written in a conversational, easy-to-understand tone

Keep the description concise but informative (2-4 paragraphs). Focus on what the user would want to know about their project.`;

    // Build file content summary
    const fileSummary = files.map((file: { path: string; content: string }) => {
      const preview = file.content.substring(0, 500).replace(/\n/g, ' ').trim();
      return `**${file.path}** (${file.content.length} chars)\n${preview}${file.content.length > 500 ? '...' : ''}`;
    }).join('\n\n');

    const userPrompt = `Please describe this project based on the following files:

${fileSummary}

Provide a clear, friendly description of what this project does, its main features, and the technologies used.`;

    // Use a fast, quality model for description
    const response = await multiModelAI.generate({
      prompt: userPrompt,
      systemPrompt,
      maxTokens: 1000,
      temperature: 0.7,
      useCase: 'explanation',
      priority: 'quality'
    });

    if (!response.content) {
      throw new Error('No response from AI');
    }

    logger.info('Project description generated successfully');

    res.json({
      success: true,
      description: response.content.trim(),
      fileCount: files.length,
      projectId
    });

  } catch (error: any) {
    logger.error(`Failed to describe project: ${error.message}`);
    res.status(500).json({ 
      error: 'Failed to generate project description',
      message: error.message 
    });
  }
});

export default router;


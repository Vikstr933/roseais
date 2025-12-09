import { SimpleLogger } from '../utils/SimpleLogger';
import { db } from '../../db';
import { projectFiles, agents } from '../../db/schema-pg';
import { eq, and } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

const logger = new SimpleLogger('DocumentationService');

export interface DocumentationFile {
  path: string;
  content: string;
  type: 'readme' | 'api' | 'code-comments' | 'guide';
}

export class DocumentationService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });
  }

  /**
   * Generate documentation for a project
   */
  async generateDocumentation(
    projectId: number,
    docType: 'readme' | 'api' | 'code-comments' | 'all' = 'all'
  ): Promise<DocumentationFile[]> {
    try {
      // Get project files
      const files = await db
        .select()
        .from(projectFiles)
        .where(
          and(
            eq(projectFiles.projectId, projectId),
            eq(projectFiles.isActive, true)
          )
        );

      if (files.length === 0) {
        throw new Error('No files found to generate documentation for');
      }

      // Get documentation-writer agent from database
      const [docAgent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, 'documentation-writer'))
        .limit(1);

      if (!docAgent) {
        throw new Error('Documentation writer agent not found');
      }

      // Build prompt for documentation generation
      const codeContext = files.map(f => ({
        path: f.filePath,
        content: f.fileContent || ''
      }));

      const prompt = `Generate ${docType} documentation for the following project:

${codeContext.map(f => `## ${f.path}\n\`\`\`typescript\n${f.content.substring(0, 1000)}\n\`\`\``).join('\n\n')}

Requirements:
- Generate ${docType === 'all' ? 'comprehensive documentation including README, API docs, and code comments' : docType === 'readme' ? 'a comprehensive README.md file' : docType === 'api' ? 'API documentation' : 'JSDoc comments for all functions and classes'}
- Include setup instructions
- Include usage examples
- Follow documentation best practices
- Make it clear and easy to understand

Return ONLY a JSON array with documentation files.`;

      // Call AI to generate documentation
      const response = await this.anthropic.messages.create({
        model: docAgent.model || 'claude-sonnet-4-5-20250929',
        max_tokens: 8192,
        system: docAgent.systemPrompt || '',
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      // Parse response
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from AI');
      }

      let docFiles: DocumentationFile[] = [];
      
      // Try to parse JSON from response
      const text = content.text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          docFiles = parsed.map((file: any) => ({
            path: file.path || file.filePath,
            content: file.content || file.fileContent,
            type: file.path?.includes('README') ? 'readme' : file.path?.includes('api') ? 'api' : 'code-comments'
          }));
        } catch (parseError) {
          logger.error('Failed to parse documentation files from AI response', parseError as Error);
          throw new Error('Failed to parse generated documentation');
        }
      }

      return docFiles;
    } catch (error) {
      logger.error('Error generating documentation', error as Error);
      throw error;
    }
  }
}

export const documentationService = new DocumentationService();


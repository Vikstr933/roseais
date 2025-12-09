import { Router } from 'express';
import { knowledgeService } from '../services/KnowledgeService';
import { githubKnowledgeService } from '../services/GitHubKnowledgeService';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-api03-1234567890abcdef',
});

const router = Router();

/**
 * POST /api/knowledge/calculate-relevance
 * Calculate AI-powered relevance scores for all knowledge items based on user query
 */
router.post('/calculate-relevance', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(
      `POST /api/knowledge/calculate-relevance - Calculating relevance for: "${query}"`
    );

    // Get all knowledge items
    const allKnowledge = await knowledgeService.getAllKnowledge();
    const githubRepos =
      await githubKnowledgeService.searchRepositoryKnowledge(query);

    // Combine all knowledge items
    const allItems = [
      ...allKnowledge.companies.map(item => ({ ...item, type: 'company' })),
      ...allKnowledge.frameworks.map(item => ({ ...item, type: 'framework' })),
      ...allKnowledge.workspaces.map(item => ({ ...item, type: 'workspace' })),
      ...githubRepos.repositories.map(item => ({ ...item, type: 'github' })),
    ];

    // Calculate relevance scores using AI
    const relevanceScores = await calculateRelevanceScores(query, allItems);

    console.log(
      `Calculated relevance scores for ${Object.keys(relevanceScores).length} items`
    );
    res.json(relevanceScores);
  } catch (error) {
    console.error('Error calculating relevance scores:', error);
    // Return empty scores instead of failing completely
    res.json({});
  }
});

/**
 * Calculate relevance scores using AI analysis
 */
async function calculateRelevanceScores(
  query: string,
  items: any[]
): Promise<Record<string, number>> {
  try {
    // Check if we have a valid API key
    if (
      !process.env.ANTHROPIC_API_KEY ||
      process.env.ANTHROPIC_API_KEY === 'sk-ant-api03-1234567890abcdef'
    ) {
      console.log('No valid Anthropic API key found, using fallback scoring');
      return calculateFallbackRelevanceScores(query, items);
    }

    // If no items, return empty scores
    if (!items || items.length === 0) {
      return {};
    }

    // Create a comprehensive prompt for AI analysis
    const prompt = `You are an expert at analyzing the relevance of knowledge items to user queries. 

User Query: "${query}"

Please analyze each knowledge item and provide a relevance score from 0.0 to 1.0, where:
- 1.0 = Perfect match (99-100% relevant)
- 0.8-0.9 = Very relevant (80-99% relevant)
- 0.6-0.7 = Moderately relevant (60-79% relevant)
- 0.4-0.5 = Somewhat relevant (40-59% relevant)
- 0.2-0.3 = Slightly relevant (20-39% relevant)
- 0.0-0.1 = Not relevant (0-19% relevant)

Special considerations:
- For TFS/MMORPG server development queries, prioritize TFS-related repositories and frameworks
- For web development queries, prioritize React, Vue, Angular, and related frameworks
- For AI/ML queries, prioritize AI companies and ML frameworks
- Consider both direct keyword matches and conceptual relevance

Knowledge Items to analyze:
${items
  .map(
    (item, index) => `
${index + 1}. ${item.type.toUpperCase()}: ${item.name}
   Description: ${item.description}
   ${item.type === 'github' ? `Repository: ${item.fullName}` : ''}
   ${item.type === 'framework' ? `Language: ${item.language}` : ''}
   ${item.type === 'company' ? `Products: ${Array.isArray(item.data) ? item.data.join(', ') : 'Various'}` : ''}
`
  )
  .join('\n')}

Please respond with ONLY a JSON object where each key is in the format "type-id" (e.g., "company-1", "framework-2", "github-otland/forgottenserver") and the value is the relevance score (0.0 to 1.0).

Example response format:
{
  "company-1": 0.9,
  "framework-2": 0.8,
  "github-otland/forgottenserver": 1.0
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      temperature: 0.3, // Lower temperature for more consistent scoring
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from AI');
    }

    // Parse the JSON response - strip markdown code blocks if present
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
      // Remove markdown code block markers
      jsonText = jsonText.replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
    }
    
    const scores = JSON.parse(jsonText);

    // Validate and normalize scores
    const validatedScores: Record<string, number> = {};
    for (const [key, value] of Object.entries(scores)) {
      if (typeof value === 'number' && value >= 0 && value <= 1) {
        validatedScores[key] = value;
      }
    }

    return validatedScores;
  } catch (error) {
    console.error('Error in AI relevance calculation:', error);

    // Fallback to simple keyword-based scoring
    return calculateFallbackRelevanceScores(query, items);
  }
}

/**
 * Fallback relevance calculation using keyword matching
 */
function calculateFallbackRelevanceScores(
  query: string,
  items: any[]
): Record<string, number> {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);

  const scores: Record<string, number> = {};

  for (const item of items) {
    const key = `${item.type}-${item.id}`;
    let score = 0;

    // Check name match
    if (item.name.toLowerCase().includes(queryLower)) {
      score += 0.8;
    }

    // Check description match
    if (item.description.toLowerCase().includes(queryLower)) {
      score += 0.6;
    }

    // Check keyword matches
    const itemText = `${item.name} ${item.description}`.toLowerCase();
    const matchedWords = queryWords.filter(word => itemText.includes(word));
    score += (matchedWords.length / queryWords.length) * 0.4;

    // Special TFS/MMORPG scoring
    if (
      queryLower.includes('tibia') ||
      queryLower.includes('tfs') ||
      queryLower.includes('mmorpg') ||
      queryLower.includes('server')
    ) {
      if (
        item.name.toLowerCase().includes('tfs') ||
        item.name.toLowerCase().includes('forgotten') ||
        item.name.toLowerCase().includes('otland')
      ) {
        score = Math.max(score, 0.95); // Very high relevance for TFS-related items
      }
    }

    // Special web development scoring
    if (
      queryLower.includes('react') ||
      queryLower.includes('web') ||
      queryLower.includes('frontend')
    ) {
      if (
        item.name.toLowerCase().includes('react') ||
        item.name.toLowerCase().includes('vue') ||
        item.name.toLowerCase().includes('angular')
      ) {
        score = Math.max(score, 0.9);
      }
    }

    scores[key] = Math.min(score, 1.0);
  }

  return scores;
}

/**
 * GET /api/knowledge/all
 * Get all available knowledge items for autocomplete
 */
router.get('/all', async (req, res) => {
  try {
    console.log('GET /api/knowledge/all - Fetching all knowledge items');

    const allKnowledge = await knowledgeService.getAllKnowledge();

    res.json(allKnowledge);
  } catch (error) {
    console.error('Error fetching all knowledge:', error);
    res.status(500).json({
      error: 'Failed to fetch knowledge items',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

import { Router } from 'express';
import { githubKnowledgeService } from '../services/GitHubKnowledgeService';

const router = Router();

/**
 * POST /api/github-knowledge/add
 * Add a GitHub repository as knowledge
 */
router.post('/add', async (req, res) => {
  try {
    const { repoUrl, userId } = req.body;

    if (!repoUrl) {
      return res.status(400).json({ error: 'Repository URL is required' });
    }

    console.log(
      `POST /api/github-knowledge/add - Adding repository: ${repoUrl}`
    );

    const repository = await githubKnowledgeService.addRepositoryKnowledge(
      repoUrl,
      userId
    );

    console.log(
      `Successfully added repository knowledge: ${repository.fullName}`
    );
    res.json({
      success: true,
      repository,
      message: `Successfully added ${repository.fullName} to knowledge base`,
    });
  } catch (error) {
    console.error('Error adding GitHub repository knowledge:', error);
    res.status(500).json({
      error: 'Failed to add repository knowledge',
      details: error.message,
    });
  }
});

/**
 * GET /api/github-knowledge/search?q=query
 * Search GitHub repository knowledge
 */
router.get('/search', async (req, res) => {
  try {
    const { q: query, userId } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    console.log(`GET /api/github-knowledge/search - Searching for: "${query}"`);

    const results = await githubKnowledgeService.searchRepositoryKnowledge(
      query,
      userId as string
    );

    console.log(
      `Found ${results.repositories.length} repositories, ${results.functions.length} functions, ${results.classes.length} classes`
    );
    res.json(results);
  } catch (error) {
    console.error('Error searching GitHub repository knowledge:', error);
    res.status(500).json({ error: 'Failed to search repository knowledge' });
  }
});

/**
 * GET /api/github-knowledge/repositories
 * Get all stored GitHub repositories
 */
router.get('/repositories', async (req, res) => {
  try {
    const { userId } = req.query;

    console.log(
      'GET /api/github-knowledge/repositories - Fetching all repositories'
    );

    // This would need to be implemented in the service
    // For now, return empty array
    res.json({
      repositories: [],
      message: 'GitHub repository storage not yet implemented',
    });
  } catch (error) {
    console.error('Error fetching GitHub repositories:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

export default router;

import { Router } from 'express';
import { knowledgeService } from '../services/KnowledgeService';

const router = Router();

/**
 * GET /api/knowledge/search?q=query
 * Automatically search for relevant knowledge based on a query
 */
router.get('/search', async (req, res) => {
  try {
    const { q: query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    console.log(`GET /api/knowledge/search - Searching for: "${query}"`);

    const knowledge = await knowledgeService.getRelevantKnowledge(query);

    console.log(`Found ${knowledge.totalItems} relevant knowledge items`);
    res.json(knowledge);
  } catch (error) {
    console.error('Error searching knowledge:', error);
    res.status(500).json({ error: 'Failed to search knowledge' });
  }
});

/**
 * GET /api/knowledge/all
 * Get all available knowledge for selection UI
 */
router.get('/all', async (req, res) => {
  try {
    console.log('GET /api/knowledge/all - Fetching all knowledge');

    const knowledge = await knowledgeService.getAllKnowledge();

    console.log(`Fetched ${knowledge.totalItems} total knowledge items`);
    res.json(knowledge);
  } catch (error) {
    console.error('Error fetching all knowledge:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge' });
  }
});

/**
 * POST /api/knowledge/selected
 * Get specific knowledge items by IDs
 */
router.post('/selected', async (req, res) => {
  try {
    const { companyIds = [], frameworkIds = [], workspaceIds = [] } = req.body;

    console.log('POST /api/knowledge/selected - Getting selected knowledge:', {
      companies: companyIds.length,
      frameworks: frameworkIds.length,
      workspaces: workspaceIds.length,
    });

    const knowledge = await knowledgeService.getKnowledgeByIds(
      companyIds,
      frameworkIds,
      workspaceIds
    );

    console.log(`Retrieved ${knowledge.totalItems} selected knowledge items`);
    res.json(knowledge);
  } catch (error) {
    console.error('Error getting selected knowledge:', error);
    res.status(500).json({ error: 'Failed to get selected knowledge' });
  }
});

export default router;

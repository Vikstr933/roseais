import { Router } from 'express';
import { db } from '../../db';
import { frameworks } from '../../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// GET /api/frameworks - Get all frameworks
router.get('/', async (req, res) => {
  try {
    console.log('GET /api/frameworks - Fetching all frameworks');
    const allFrameworks = await db.select().from(frameworks);

    // Transform the data to match the expected format
    const transformedFrameworks = allFrameworks.map(framework => ({
      id: framework.id,
      name: framework.name,
      description: framework.description,
      language: framework.language,
      githubUrl: framework.githubUrl,
      documentation: framework.documentation,
      features: typeof framework.features === 'string' ? JSON.parse(framework.features) : framework.features
    }));

    console.log(`Fetched ${transformedFrameworks.length} frameworks`);
    res.json(transformedFrameworks);
  } catch (error) {
    console.error('Error fetching frameworks:', error);
    res.status(500).json({ error: 'Failed to fetch frameworks' });
  }
});

// GET /api/frameworks/:id - Get specific framework
router.get('/:id', async (req, res) => {
  try {
    const frameworkId = parseInt(req.params.id);
    const framework = await db.select().from(frameworks).where(eq(frameworks.id, frameworkId)).limit(1);

    if (!framework || framework.length === 0) {
      return res.status(404).json({ error: 'Framework not found' });
    }

    const frameworkData = framework[0];

    // Transform the data to match the expected format
    const transformedFramework = {
      id: frameworkData.id,
      name: frameworkData.name,
      description: frameworkData.description,
      language: frameworkData.language,
      githubUrl: frameworkData.githubUrl,
      documentation: frameworkData.documentation,
      features: typeof frameworkData.features === 'string' ? JSON.parse(frameworkData.features) : frameworkData.features
    };

    res.json(transformedFramework);
  } catch (error) {
    console.error('Error fetching framework:', error);
    res.status(500).json({ error: 'Failed to fetch framework' });
  }
});

// POST /api/frameworks - Create new framework
router.post('/', async (req, res) => {
  try {
    const { name, description, language, githubUrl, documentation, features } = req.body;

    if (!name || !description || !language) {
      return res.status(400).json({ error: 'Name, description, and language are required' });
    }

    const newFramework = await db.insert(frameworks).values({
      name,
      description,
      language,
      githubUrl,
      documentation,
      features: JSON.stringify(features || [])
    }).returning();

    console.log('Created framework:', newFramework[0]);
    res.status(201).json(newFramework[0]);
  } catch (error) {
    console.error('Error creating framework:', error);
    res.status(500).json({ error: 'Failed to create framework' });
  }
});

// PUT /api/frameworks/:id - Update framework
router.put('/:id', async (req, res) => {
  try {
    const frameworkId = parseInt(req.params.id);
    const { name, description, language, githubUrl, documentation, features } = req.body;

    const updateData: any = {};

    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (language) updateData.language = language;
    if (githubUrl) updateData.githubUrl = githubUrl;
    if (documentation) updateData.documentation = documentation;
    if (features) updateData.features = JSON.stringify(features);

    const updatedFramework = await db.update(frameworks)
      .set(updateData)
      .where(eq(frameworks.id, frameworkId))
      .returning();

    if (!updatedFramework || updatedFramework.length === 0) {
      return res.status(404).json({ error: 'Framework not found' });
    }

    console.log('Updated framework:', updatedFramework[0]);
    res.json(updatedFramework[0]);
  } catch (error) {
    console.error('Error updating framework:', error);
    res.status(500).json({ error: 'Failed to update framework' });
  }
});

// DELETE /api/frameworks/:id - Delete framework
router.delete('/:id', async (req, res) => {
  try {
    const frameworkId = parseInt(req.params.id);

    const deletedFramework = await db.delete(frameworks)
      .where(eq(frameworks.id, frameworkId))
      .returning();

    if (!deletedFramework || deletedFramework.length === 0) {
      return res.status(404).json({ error: 'Framework not found' });
    }

    console.log('Deleted framework:', deletedFramework[0]);
    res.json({ message: 'Framework deleted successfully' });
  } catch (error) {
    console.error('Error deleting framework:', error);
    res.status(500).json({ error: 'Failed to delete framework' });
  }
});

export default router;

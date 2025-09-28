import { Router } from 'express';
import { db } from '../../db';
import { workspaces } from '../../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// GET /api/workspaces - Get all workspaces
router.get('/', async (req, res) => {
  try {
    console.log('GET /api/workspaces - Fetching all workspaces');
    const allWorkspaces = await db.select().from(workspaces);

    // Transform the data to match the expected format
    const transformedWorkspaces = allWorkspaces.map(workspace => ({
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      agentConfig: typeof workspace.agentConfig === 'string' ? JSON.parse(workspace.agentConfig) : workspace.agentConfig,
      testCases: workspace.testCases ? (typeof workspace.testCases === 'string' ? JSON.parse(workspace.testCases) : workspace.testCases) : [],
      collaborators: typeof workspace.collaborators === 'string' ? JSON.parse(workspace.collaborators) : workspace.collaborators,
      status: workspace.status
    }));

    console.log(`Fetched ${transformedWorkspaces.length} workspaces`);
    res.json(transformedWorkspaces);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// GET /api/workspaces/:id - Get specific workspace
router.get('/:id', async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const workspace = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);

    if (!workspace || workspace.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const workspaceData = workspace[0];

    // Transform the data to match the expected format
    const transformedWorkspace = {
      id: workspaceData.id,
      name: workspaceData.name,
      description: workspaceData.description,
      createdAt: workspaceData.createdAt,
      updatedAt: workspaceData.updatedAt,
      agentConfig: typeof workspaceData.agentConfig === 'string' ? JSON.parse(workspaceData.agentConfig) : workspaceData.agentConfig,
      testCases: workspaceData.testCases ? (typeof workspaceData.testCases === 'string' ? JSON.parse(workspaceData.testCases) : workspaceData.testCases) : [],
      collaborators: typeof workspaceData.collaborators === 'string' ? JSON.parse(workspaceData.collaborators) : workspaceData.collaborators,
      status: workspaceData.status
    };

    res.json(transformedWorkspace);
  } catch (error) {
    console.error('Error fetching workspace:', error);
    res.status(500).json({ error: 'Failed to fetch workspace' });
  }
});

// POST /api/workspaces - Create new workspace
router.post('/', async (req, res) => {
  try {
    const { name, description, agentConfig, testCases, collaborators, status } = req.body;

    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description are required' });
    }

    const newWorkspace = await db.insert(workspaces).values({
      name,
      description,
      agentConfig: JSON.stringify(agentConfig || {}),
      testCases: JSON.stringify(testCases || []),
      collaborators: JSON.stringify(collaborators || []),
      status: status || 'active'
    }).returning();

    console.log('Created workspace:', newWorkspace[0]);
    res.status(201).json(newWorkspace[0]);
  } catch (error) {
    console.error('Error creating workspace:', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

// PUT /api/workspaces/:id - Update workspace
router.put('/:id', async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const { name, description, agentConfig, testCases, collaborators, status } = req.body;

    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (agentConfig) updateData.agentConfig = JSON.stringify(agentConfig);
    if (testCases) updateData.testCases = JSON.stringify(testCases);
    if (collaborators) updateData.collaborators = JSON.stringify(collaborators);
    if (status) updateData.status = status;

    const updatedWorkspace = await db.update(workspaces)
      .set(updateData)
      .where(eq(workspaces.id, workspaceId))
      .returning();

    if (!updatedWorkspace || updatedWorkspace.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    console.log('Updated workspace:', updatedWorkspace[0]);
    res.json(updatedWorkspace[0]);
  } catch (error) {
    console.error('Error updating workspace:', error);
    res.status(500).json({ error: 'Failed to update workspace' });
  }
});

// DELETE /api/workspaces/:id - Delete workspace
router.delete('/:id', async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);

    const deletedWorkspace = await db.delete(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .returning();

    if (!deletedWorkspace || deletedWorkspace.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    console.log('Deleted workspace:', deletedWorkspace[0]);
    res.json({ message: 'Workspace deleted successfully' });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

export default router;

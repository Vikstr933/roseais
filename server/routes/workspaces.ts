import { Router } from 'express';
import { db } from '../../db';
import { workspaces, projectMembers } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { projectService } from '../services/ProjectService';
import { authenticateUser, optionalAuth } from '../middleware/auth';

const router = Router();

// GET /api/workspaces - Get user's projects (owned + member)
router.get('/', optionalAuth, async (req, res) => {
  try {
    console.log('GET /api/workspaces - Fetching user projects');

    if (!req.user) {
      // Return public workspaces if no user
      const publicWorkspaces = await db
        .select()
        .from(workspaces as any)
        .where(eq((workspaces as any).status, 'active'));
      const transformedWorkspaces = publicWorkspaces.map(workspace => ({
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
        projectType: workspace.projectType,
        projectStatus: workspace.projectStatus,
        agentConfig:
          typeof workspace.agentConfig === 'string'
            ? JSON.parse(workspace.agentConfig)
            : workspace.agentConfig,
        testCases: workspace.testCases
          ? typeof workspace.testCases === 'string'
            ? JSON.parse(workspace.testCases)
            : workspace.testCases
          : [],
        collaborators:
          typeof workspace.collaborators === 'string'
            ? JSON.parse(workspace.collaborators)
            : workspace.collaborators,
        status: workspace.status,
        members: [],
        recentActivity: [],
        fileCount: 0,
      }));

      return res.json(transformedWorkspaces);
    }

    const userProjects = await projectService.getUserProjects(req.user.id);
    console.log(
      `Fetched ${userProjects.length} projects for user ${req.user.id}`
    );
    res.json(userProjects);
  } catch (error) {
    console.error('Error fetching user projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /api/workspaces/:id - Get specific workspace with full details
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const workspace = await db
      .select()
      .from(workspaces as any)
      .where(eq((workspaces as any).id, workspaceId))
      .limit(1);

    if (!workspace || workspace.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const workspaceData = workspace[0];

    // Get project members
    const members = await projectService.getProjectMembers(workspaceId);

    // Get file count
    const files = await projectService.getProjectFiles(workspaceId);
    const fileCount = files.length;

    // Get recent activity
    const recentActivity = await projectService.getProjectActivity(workspaceId, 10);

    // Transform the data to match the expected format
    const transformedWorkspace = {
      id: workspaceData.id,
      name: workspaceData.name,
      description: workspaceData.description,
      createdAt: workspaceData.createdAt,
      updatedAt: workspaceData.updatedAt,
      projectType: workspaceData.projectType,
      projectStatus: workspaceData.projectStatus,
      inviteCode: workspaceData.inviteCode,
      ownerId: workspaceData.ownerId,
      agentConfig:
        typeof workspaceData.agentConfig === 'string'
          ? JSON.parse(workspaceData.agentConfig)
          : workspaceData.agentConfig,
      testCases: workspaceData.testCases
        ? typeof workspaceData.testCases === 'string'
          ? JSON.parse(workspaceData.testCases)
          : workspaceData.testCases
        : [],
      collaborators:
        typeof workspaceData.collaborators === 'string'
          ? JSON.parse(workspaceData.collaborators)
          : workspaceData.collaborators,
      status: workspaceData.status,
      settings: workspaceData.settings
        ? typeof workspaceData.settings === 'string'
          ? JSON.parse(workspaceData.settings)
          : workspaceData.settings
        : {},
      // Additional fields expected by frontend
      members,
      fileCount,
      recentActivity,
    };

    res.json(transformedWorkspace);
  } catch (error) {
    console.error('Error fetching workspace:', error);
    res.status(500).json({ error: 'Failed to fetch workspace' });
  }
});

// POST /api/workspaces - Create new project
router.post('/', authenticateUser, async (req, res) => {
  try {
    const { name, description, projectType, agentConfig, testCases, settings } =
      req.body;

    if (!name || !description) {
      return res
        .status(400)
        .json({ error: 'Name and description are required' });
    }

    const projectData = {
      name,
      description,
      projectType: projectType || 'web_app',
      ownerId: req.user!.id,
      agentConfig,
      testCases,
      settings,
    };

    const newProject = await projectService.createProject(projectData);
    console.log('Created project:', newProject);
    res.status(201).json(newProject);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// POST /api/workspaces/join - Join project by invite code
router.post('/join', authenticateUser, async (req, res) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    const project = await projectService.joinProjectByInviteCode(
      inviteCode,
      req.user!.id
    );

    if (!project) {
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    console.log(`User ${req.user!.id} joined project ${project.id}`);
    res.json({ project, message: 'Successfully joined project' });
  } catch (error) {
    console.error('Error joining project:', error);
    res.status(500).json({ error: 'Failed to join project' });
  }
});

// POST /api/workspaces/:id/export - Export playground generation to project
router.post('/:id/export', authenticateUser, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { files, componentName } = req.body;

    if (!files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'Files array is required' });
    }

    // First, verify workspace exists
    const [workspace] = await db
      .select()
      .from(workspaces as any)
      .where(eq((workspaces as any).id, projectId))
      .limit(1);

    if (!workspace) {
      console.error(`Workspace ${projectId} does not exist`);
      return res.status(404).json({
        error: 'Workspace not found',
        message: 'This workspace may have been deleted. Please refresh the page.'
      });
    }

    // Check if user has access to project
    const [member] = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, req.user!.id),
          eq(projectMembers.isActive, 1)
        )
      )
      .limit(1);

    if (!member) {
      return res.status(403).json({ error: 'Access denied to project' });
    }

    await projectService.exportToProject(
      projectId,
      req.user!.id,
      files,
      componentName
    );

    console.log(`Exported ${files.length} files to project ${projectId}`);
    res.json({ message: 'Successfully exported to project' });
  } catch (error) {
    console.error('Error exporting to project:', error);
    res.status(500).json({ error: 'Failed to export to project' });
  }
});

// PUT /api/workspaces/:id - Update workspace
router.put('/:id', async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const { name, description, agentConfig, testCases, collaborators, status } =
      req.body;

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (agentConfig) updateData.agentConfig = JSON.stringify(agentConfig);
    if (testCases) updateData.testCases = JSON.stringify(testCases);
    if (collaborators) updateData.collaborators = JSON.stringify(collaborators);
    if (status) updateData.status = status;

    const updatedWorkspace = await db
      .update(workspaces)
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

    const deletedWorkspace = await db
      .delete(workspaces)
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

// GET /api/workspaces/:id/chat - Get project chat messages
router.get('/:id/chat', optionalAuth, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 50;

    // Check if user has access to project (if authenticated)
    if (req.user) {
      const [member] = await db
        .select()
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, req.user.id),
            eq(projectMembers.isActive, 1)
          )
        )
        .limit(1);

      if (!member) {
        return res.status(403).json({ error: 'Access denied to project' });
      }
    }

    const messages = await projectService.getProjectChatMessages(
      projectId,
      limit
    );
    res.json(messages);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
});

// POST /api/workspaces/:id/chat - Send chat message
router.post('/:id/chat', authenticateUser, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { message, messageType = 'text', metadata = {} } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // First, verify workspace exists
    const [workspace] = await db
      .select()
      .from(workspaces as any)
      .where(eq((workspaces as any).id, projectId))
      .limit(1);

    if (!workspace) {
      console.error(`Workspace ${projectId} does not exist`);
      return res.status(404).json({
        error: 'Workspace not found',
        message: 'This workspace may have been deleted. Please refresh the page.'
      });
    }

    // Check if user has access to project
    const [member] = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, req.user!.id),
          eq(projectMembers.isActive, 1)
        )
      )
      .limit(1);

    if (!member) {
      return res.status(403).json({ error: 'Access denied to project' });
    }

    const newMessage = await projectService.sendChatMessage(
      projectId,
      req.user!.id,
      message,
      messageType,
      metadata
    );
    res.json(newMessage);
  } catch (error) {
    console.error('Error sending chat message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// POST /api/workspaces/:id/files - Save files to project
router.post('/:id/files', authenticateUser, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { files, componentName } = req.body;

    if (!files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'Files array is required' });
    }

    // First, verify workspace exists
    const [workspace] = await db
      .select()
      .from(workspaces as any)
      .where(eq((workspaces as any).id, projectId))
      .limit(1);

    if (!workspace) {
      console.error(`Workspace ${projectId} does not exist`);
      return res.status(404).json({
        error: 'Workspace not found',
        message: 'This workspace may have been deleted. Please refresh the page.'
      });
    }

    // Check if user has access to project
    const [member] = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, req.user!.id),
          eq(projectMembers.isActive, 1)
        )
      )
      .limit(1);

    if (!member) {
      return res.status(403).json({ error: 'Access denied to project' });
    }

    await projectService.exportToProject(
      projectId,
      req.user!.id,
      files,
      componentName || 'Component'
    );

    res.json({ success: true, message: `Saved ${files.length} files to project` });
  } catch (error) {
    console.error('Error saving project files:', error);
    res.status(500).json({ error: 'Failed to save project files' });
  }
});

// GET /api/workspaces/:id/files - Get project files
router.get('/:id/files', optionalAuth, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);

    // Check if user has access to project (if authenticated)
    if (req.user) {
      const [member] = await db
        .select()
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, req.user.id),
            eq(projectMembers.isActive, 1)
          )
        )
        .limit(1);

      if (!member) {
        return res.status(403).json({ error: 'Access denied to project' });
      }
    }

    const files = await projectService.getProjectFiles(projectId);
    res.json(files);
  } catch (error) {
    console.error('Error fetching project files:', error);
    res.status(500).json({ error: 'Failed to fetch project files' });
  }
});

export default router;

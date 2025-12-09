import { Router } from 'express';
import { db } from '../../db';
import { workspaces, projectMembers, projectRemixes } from '../../db/schema-pg';
import { chatMessages, codeGenerationSessions } from '../../db/schema-pg';
import { eq, and } from 'drizzle-orm';
import { projectService } from '../services/ProjectService';
import { authenticateUser, optionalAuth } from '../middleware/auth';
import { agentEventEmitter } from '../index';
import { performanceService } from '../services/PerformanceService';

// Helper to invalidate workspace list cache
// This clears all cached workspace list responses
function invalidateWorkspaceCache(userId?: string) {
  const cache = performanceService.getCache();
  // Delete all cache entries containing /api/workspaces
  // This handles different query params and user contexts
  const deleted = cache.deletePattern('/api/workspaces');
  console.log(`[Cache] Invalidated ${deleted} workspace cache entries`);
}

const router = Router();

// GET /api/workspaces - Get user's projects (owned + member)
router.get('/', optionalAuth, async (req, res) => {
  try {
    console.log('GET /api/workspaces - Fetching user projects');

    if (!req.user) {
      // Return ONLY public workspaces if no user (CRITICAL SECURITY FIX)
      const publicWorkspaces = await db
        .select()
        .from(workspaces as any)
        .where(
          and(
            eq((workspaces as any).status, 'active'),
            eq((workspaces as any).isPublic, true)
          )
        );
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
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
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

    // Security: Verify user is owner or member
    const members = await projectService.getProjectMembers(workspaceId);
    const isOwner = workspaceData.ownerId === userId;
    const isMember = members.some((m: any) => m.userId === userId);

    if (!isOwner && !isMember) {
      console.log(`[FORBIDDEN] User ${userId} attempted to access workspace ${workspaceId} (owner: ${workspaceData.ownerId})`);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this workspace'
      });
    }

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
    
    // Invalidate workspace list cache so new project appears immediately
    invalidateWorkspaceCache(req.user!.id);
    
    res.status(201).json(newProject);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// POST /api/workspaces/:id/reset - Clear files and chat history
router.post('/:id/reset', authenticateUser, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const userId = req.user!.id;

    const [workspace] = await db
      .select()
      .from(workspaces as any)
      .where(eq((workspaces as any).id, workspaceId))
      .limit(1);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    if (workspace.ownerId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only the workspace owner can reset it',
      });
    }

    await projectService.resetProjectData(workspaceId, userId);

    res.json({
      success: true,
      message: 'Workspace files and chat history cleared',
    });
  } catch (error) {
    console.error('Error resetting workspace:', error);
    res.status(500).json({ error: 'Failed to reset workspace' });
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
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const userId = req.user!.id;
    const { name, description, agentConfig, testCases, collaborators, status } =
      req.body;

    // First verify workspace exists and user owns it
    const [workspace] = await db
      .select()
      .from(workspaces as any)
      .where(eq((workspaces as any).id, workspaceId))
      .limit(1);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Security: Check if user is the owner
    if (workspace.ownerId !== userId) {
      console.log(`[FORBIDDEN] User ${userId} attempted to update workspace ${workspaceId} owned by ${workspace.ownerId}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only the workspace owner can update it'
      });
    }

    const updateData: any = {
      updatedAt: new Date(),
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

    console.log(`Updated workspace ${workspaceId} by owner ${userId}`);
    
    // Invalidate workspace list cache
    invalidateWorkspaceCache(userId);
    
    res.json(updatedWorkspace[0]);
  } catch (error) {
    console.error('Error updating workspace:', error);
    res.status(500).json({ error: 'Failed to update workspace' });
  }
});

// DELETE /api/workspaces/:id - Delete workspace
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const userId = req.user!.id;

    // First verify workspace exists and user owns it
    const [workspace] = await db
      .select()
      .from(workspaces as any)
      .where(eq((workspaces as any).id, workspaceId))
      .limit(1);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user is the owner
    if (workspace.ownerId !== userId) {
      return res.status(403).json({ error: 'Only the workspace owner can delete it' });
    }

    // Check if this project has been remixed by others
    // Remixed projects themselves are preserved (cascade only deletes the remix record, not the remixed project)
    // But we want to preserve the remix history, so we'll manually handle it
    const remixesAsOriginal = await db
      .select()
      .from(projectRemixes)
      .where(eq(projectRemixes.originalProjectId, workspaceId));

    if (remixesAsOriginal.length > 0) {
      console.log(`[Delete] Project ${workspaceId} has ${remixesAsOriginal.length} remixes. Remixed projects will be preserved.`);
      // Note: The cascade will delete the remix records, but the remixed projects themselves remain safe
      // This is the desired behavior - remixed projects should not be deleted when original is deleted
    }

    // Delete remix records where this project is the remixed one (safe to delete when deleting a remix)
    await db
      .delete(projectRemixes)
      .where(eq(projectRemixes.remixedProjectId, workspaceId));

    // Delete related records first to prevent foreign key violations
    // Delete chat messages
    await db
      .delete(chatMessages as any)
      .where(eq((chatMessages as any).projectId, workspaceId));

    // Delete code generation sessions
    await db
      .delete(codeGenerationSessions as any)
      .where(eq((codeGenerationSessions as any).workspaceId, workspaceId));

    // Delete project members
    await db
      .delete(projectMembers)
      .where(eq(projectMembers.projectId, workspaceId));

    // Finally delete the workspace
    const deletedWorkspace = await db
      .delete(workspaces as any)
      .where(eq((workspaces as any).id, workspaceId))
      .returning();

    console.log('Deleted workspace and all related records:', workspaceId);
    
    // Invalidate workspace list cache
    invalidateWorkspaceCache(userId);
    
    const deletedWorkspaceData = Array.isArray(deletedWorkspace) && deletedWorkspace.length > 0 ? deletedWorkspace[0] : null;
    
    res.json({
      success: true,
      message: 'Workspace deleted successfully',
      workspace: deletedWorkspaceData
    });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete workspace'
    });
  }
});

// GET /api/workspaces/:id/chat - Get project chat messages
router.get('/:id/chat', optionalAuth, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 50;

    // Check if user has access to project (if authenticated)
    if (req.user) {
      // First check if user is owner
      const [workspace] = await db
        .select()
        .from(workspaces as any)
        .where(eq((workspaces as any).id, projectId))
        .limit(1);

      if (!workspace) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (workspace.ownerId === req.user.id) {
        // User is owner, allow access
        console.log(`[Chat] User ${req.user.id} is owner of project ${projectId}`);
      } else {
        // Check if user is a member
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
          console.log(`[Chat] Access denied: User ${req.user.id} is not owner (owner: ${workspace.ownerId}) or member of project ${projectId}`);
          return res.status(403).json({ error: 'Access denied to project' });
        }
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

    // Check if user has access to project (owner or member)
    const isOwner = workspace.ownerId === req.user!.id;
    
    if (!isOwner) {
      // Check if user is a member
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
        console.log(`[Files] Access denied: User ${req.user!.id} is not owner (owner: ${workspace.ownerId}) or member of project ${projectId}`);
        return res.status(403).json({ error: 'Access denied to project' });
      }
    } else {
      console.log(`[Files] User ${req.user!.id} is owner of project ${projectId}`);
    }

    try {
      await projectService.exportToProject(
        projectId,
        req.user!.id,
        files,
        componentName || 'Component'
      );

      res.json({ success: true, message: `Saved ${files.length} files to project` });
    } catch (exportError) {
      console.error('Error in exportToProject:', exportError);
      const errorMessage = exportError instanceof Error ? exportError.message : 'Unknown error';
      console.error('Full error details:', {
        projectId,
        userId: req.user!.id,
        fileCount: files.length,
        error: errorMessage
      });
      return res.status(500).json({ 
        error: 'Failed to save project files',
        details: errorMessage
      });
    }
  } catch (error) {
    console.error('Error saving project files:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Failed to save project files',
      details: errorMessage
    });
  }
});

// GET /api/workspaces/:id/files - Get project files
router.get('/:id/files', optionalAuth, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);

    // Check if user has access to project (if authenticated)
    if (req.user) {
      // First check if user is owner
      const [workspace] = await db
        .select()
        .from(workspaces as any)
        .where(eq((workspaces as any).id, projectId))
        .limit(1);

      if (!workspace) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (workspace.ownerId === req.user.id) {
        // User is owner, allow access
        console.log(`[Files] User ${req.user.id} is owner of project ${projectId}`);
      } else {
        // Check if user is a member
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
          console.log(`[Files] Access denied: User ${req.user.id} is not owner (owner: ${workspace.ownerId}) or member of project ${projectId}`);
          return res.status(403).json({ error: 'Access denied to project' });
        }
      }
    }

    const files = await projectService.getProjectFiles(projectId);
    res.json(files);
  } catch (error) {
    console.error('Error fetching project files:', error);
    res.status(500).json({ error: 'Failed to fetch project files' });
  }
});

// GET /api/workspaces/:id/members - Get workspace members
router.get('/:id/members', authenticateUser, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);

    // Verify workspace exists and user has access
    const [workspace] = await db
      .select()
      .from(workspaces as any)
      .where(eq((workspaces as any).id, workspaceId))
      .limit(1);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Get all members with their details
    const members = await projectService.getProjectMembers(workspaceId);
    res.json(members);
  } catch (error) {
    console.error('Error fetching workspace members:', error);
    res.status(500).json({ error: 'Failed to fetch workspace members' });
  }
});

// POST /api/workspaces/:id/invite - Invite member by email
router.post('/:id/invite', authenticateUser, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const { email, role = 'editor', message } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Verify workspace exists and user has permission to invite
    const [workspace] = await db
      .select()
      .from(workspaces as any)
      .where(eq((workspaces as any).id, workspaceId))
      .limit(1);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if requester is owner or admin
    const [requesterMember] = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, workspaceId),
          eq(projectMembers.userId, req.user!.id)
        )
      )
      .limit(1);

    if (!requesterMember && workspace.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Only workspace owner or admins can invite members' });
    }

    // TODO: Send invitation email to the user
    // For now, we'll just return success
    console.log(`Invitation sent to ${email} for workspace ${workspaceId} with role ${role}`);

    res.json({
      success: true,
      message: `Invitation sent to ${email}`,
      email,
      role,
    });
  } catch (error) {
    console.error('Error inviting member:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// PATCH /api/workspaces/:id/members/:memberId - Update member role
router.patch('/:id/members/:memberId', authenticateUser, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const memberId = req.params.memberId;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    // Verify workspace exists
    const [workspace] = await db
      .select()
      .from(workspaces as any)
      .where(eq((workspaces as any).id, workspaceId))
      .limit(1);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if requester is owner or admin
    if (workspace.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Only workspace owner can update member roles' });
    }

    // Update the member's role
    const [updatedMember] = await db
      .update(projectMembers)
      .set({ role })
      .where(
        and(
          eq(projectMembers.projectId, workspaceId),
          eq(projectMembers.userId, memberId)
        )
      )
      .returning();

    if (!updatedMember) {
      return res.status(404).json({ error: 'Member not found' });
    }

    console.log(`Updated member ${memberId} role to ${role} in workspace ${workspaceId}`);
    res.json(updatedMember);
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// DELETE /api/workspaces/:id/members/:memberId - Remove member from workspace
router.delete('/:id/members/:memberId', authenticateUser, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const memberId = req.params.memberId;

    // Verify workspace exists
    const [workspace] = await db
      .select()
      .from(workspaces as any)
      .where(eq((workspaces as any).id, workspaceId))
      .limit(1);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if requester is owner or admin
    if (workspace.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Only workspace owner can remove members' });
    }

    // Can't remove the owner
    if (memberId === workspace.ownerId) {
      return res.status(400).json({ error: 'Cannot remove workspace owner' });
    }

    // Remove the member
    await db
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, workspaceId),
          eq(projectMembers.userId, memberId)
        )
      );

    console.log(`Removed member ${memberId} from workspace ${workspaceId}`);
    res.json({ success: true, message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// PATCH /api/workspaces/:id - Update workspace settings (alternative to PUT)
router.patch('/:id', authenticateUser, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const {
      name,
      description,
      isPublic,
      allowJoinRequests,
      requireApproval,
      maxMembers,
      allowComments,
      allowForking,
      enableAI,
      enableWebContainer,
      theme,
    } = req.body;

    // Verify workspace exists
    const [workspace] = await db
      .select()
      .from(workspaces as any)
      .where(eq((workspaces as any).id, workspaceId))
      .limit(1);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user has permission to update settings
    if (workspace.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Only workspace owner can update settings' });
    }

    // Build settings object from request
    const existingSettings = workspace.settings
      ? typeof workspace.settings === 'string'
        ? JSON.parse(workspace.settings)
        : workspace.settings
      : {};

    const newSettings = {
      ...existingSettings,
      ...(allowJoinRequests !== undefined && { allowJoinRequests }),
      ...(requireApproval !== undefined && { requireApproval }),
      ...(maxMembers !== undefined && { maxMembers }),
      ...(allowComments !== undefined && { allowComments }),
      ...(allowForking !== undefined && { allowForking }),
      ...(enableAI !== undefined && { enableAI }),
      ...(enableWebContainer !== undefined && { enableWebContainer }),
      ...(theme !== undefined && { theme }),
    };

    // Build update object
    const updateData: any = {
      updatedAt: new Date(),
      settings: JSON.stringify(newSettings),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isPublic !== undefined) {
      updateData.isPublic = isPublic;
      console.log(`[PATCH /workspaces/${workspaceId}] Updating isPublic to: ${isPublic}`);
    }

    // Update workspace
    const [updatedWorkspace] = await db
      .update(workspaces)
      .set(updateData)
      .where(eq(workspaces.id, workspaceId))
      .returning();

    console.log(`[PATCH /workspaces/${workspaceId}] Updated workspace settings:`, {
      isPublic: updatedWorkspace?.isPublic,
      name: updatedWorkspace?.name,
    });
    res.json(updatedWorkspace);
  } catch (error) {
    console.error('Error updating workspace settings:', error);
    res.status(500).json({ error: 'Failed to update workspace settings' });
  }
});

// POST /api/workspaces/:id/invite-code - Generate new invite code
router.post('/:id/invite-code', authenticateUser, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);

    // Verify workspace exists
    const [workspace] = await db
      .select()
      .from(workspaces as any)
      .where(eq((workspaces as any).id, workspaceId))
      .limit(1);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user has permission
    if (workspace.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Only workspace owner can generate invite codes' });
    }

    // Generate new invite code (8 characters)
    const newInviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    // Update workspace with new invite code
    const [updatedWorkspace] = await db
      .update(workspaces)
      .set({
        inviteCode: newInviteCode,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspaceId))
      .returning();

    console.log(`Generated new invite code for workspace ${workspaceId}: ${newInviteCode}`);
    res.json({
      success: true,
      inviteCode: newInviteCode,
      workspace: updatedWorkspace,
    });
  } catch (error) {
    console.error('Error generating invite code:', error);
    res.status(500).json({ error: 'Failed to generate invite code' });
  }
});

// POST /api/workspaces/:id/retry-database-provisioning - Retry database provisioning after API keys are configured
router.post('/:id/retry-database-provisioning', authenticateUser, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const userId = req.user!.id;

    // Verify workspace exists and user has access
    const [workspace] = await db
      .select()
      .from(workspaces as any)
      .where(eq((workspaces as any).id, workspaceId))
      .limit(1);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user owns the workspace or is a member
    if (workspace.ownerId !== userId) {
      // Check if user is a member
      const [member] = await db
        .select()
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, workspaceId),
            eq(projectMembers.userId, userId)
          )
        )
        .limit(1);

      if (!member) {
        return res.status(403).json({ error: 'You do not have access to this workspace' });
      }
    }

    // Retry database provisioning
    const { DatabaseProvisioningService } = await import('../services/DatabaseProvisioningService');
    const databaseProvisioningService = new DatabaseProvisioningService();
    const result = await databaseProvisioningService.retryProvisioning(userId, workspaceId);

    if (result.success) {
      // Emit success event
      agentEventEmitter.emit('agent-event', {
        type: 'DATABASE_PROVISIONED',
        projectId: workspaceId,
        userId,
        provider: result.provider,
        message: `Database successfully provisioned using ${result.provider}`
      });

      res.json({
        success: true,
        message: 'Database provisioned successfully',
        provider: result.provider,
        databaseUrl: result.databaseUrl
      });
    } else {
      // Emit API_KEY_REQUIRED event if still missing keys
      if (result.pending && result.missingKeys) {
        agentEventEmitter.emit('agent-event', {
          type: 'API_KEY_REQUIRED',
          missingApiKeys: result.missingKeys,
          databaseType: 'postgresql', // Will be determined from pending request
          projectId: workspaceId,
          userId,
          message: `API keys still required: ${result.missingKeys.join(', ')}`
        });
      }

      res.status(400).json({
        success: false,
        error: result.error,
        pending: result.pending,
        missingKeys: result.missingKeys
      });
    }
  } catch (error) {
    console.error('Error retrying database provisioning:', error);
    res.status(500).json({ 
      error: 'Failed to retry database provisioning',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

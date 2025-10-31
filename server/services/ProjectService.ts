import { db } from '../../db';
import {
  workspaces,
  projectMembers,
  projectChatMessages,
  projectActivities,
  projectFiles,
  users,
  type Workspace,
  type ProjectMember,
  type ProjectChatMessage,
  type ProjectActivity,
  type ProjectFile,
} from '../../db/schema';
import { eq, and, desc, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export interface CreateProjectData {
  name: string;
  description: string;
  projectType: 'web_app' | 'mobile_app' | 'api' | 'desktop_app';
  ownerId: string;
  agentConfig?: any;
  testCases?: any[];
  settings?: any;
}

export interface ProjectWithMembers extends Workspace {
  members: (ProjectMember & {
    user: { id: string; username: string; displayName: string };
  })[];
  recentActivity: ProjectActivity[];
  fileCount: number;
}

export interface ChatMessageWithUser extends ProjectChatMessage {
  user: { id: string; username: string; displayName: string };
}

export class ProjectService {
  /**
   * Create a new project
   */
  async createProject(data: CreateProjectData): Promise<Workspace> {
    const inviteCode = this.generateInviteCode();

    const [newProject] = await db
      .insert(workspaces)
      .values({
        name: data.name,
        description: data.description,
        projectType: data.projectType,
        ownerId: data.ownerId,
        agentConfig: JSON.stringify(data.agentConfig || {}),
        testCases: JSON.stringify(data.testCases || []),
        settings: JSON.stringify(data.settings || {}),
        inviteCode,
        collaborators: JSON.stringify([]),
        status: 'active',
      })
      .returning();

    // Add owner as project member
    await db.insert(projectMembers).values({
      projectId: newProject.id,
      userId: data.ownerId,
      role: 'owner',
      permissions: JSON.stringify({
        canEdit: true,
        canDelete: true,
        canInvite: true,
      }),
    });

    // Log project creation activity
    await this.logActivity(
      newProject.id,
      data.ownerId,
      'project_created',
      `Created project "${data.name}"`
    );

    return newProject;
  }

  /**
   * Get projects for a user (owned + member)
   */
  async getUserProjects(userId: string): Promise<ProjectWithMembers[]> {
    // Get projects where user is owner or member
    const userProjects = await db
      .select({
        workspace: workspaces,
        member: projectMembers,
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
        },
      })
      .from(workspaces)
      .leftJoin(projectMembers, eq(workspaces.id, projectMembers.projectId))
      .leftJoin(users, eq(projectMembers.userId, users.id))
      .where(
        or(
          eq(workspaces.ownerId, userId),
          and(eq(projectMembers.userId, userId), eq(projectMembers.isActive, 1))
        )
      );

    // Group by project
    const projectMap = new Map<number, ProjectWithMembers>();

    for (const row of userProjects) {
      const projectId = row.workspace.id;

      if (!projectMap.has(projectId)) {
        // Get recent activity and file count
        const [recentActivity, fileCount] = await Promise.all([
          this.getRecentActivity(projectId, 5),
          this.getFileCount(projectId),
        ]);

        projectMap.set(projectId, {
          ...row.workspace,
          members: [],
          recentActivity,
          fileCount,
        });
      }

      const project = projectMap.get(projectId)!;
      if (row.member && row.user) {
        project.members.push({
          ...row.member,
          user: row.user,
        });
      }
    }

    return Array.from(projectMap.values());
  }

  /**
   * Join project by invite code
   */
  async joinProjectByInviteCode(
    inviteCode: string,
    userId: string
  ): Promise<Workspace | null> {
    // Find project by invite code
    const [project] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.inviteCode, inviteCode))
      .limit(1);

    if (!project) {
      return null;
    }

    // Check if user is already a member
    const [existingMember] = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, project.id),
          eq(projectMembers.userId, userId)
        )
      )
      .limit(1);

    if (existingMember) {
      // Reactivate if inactive
      if (!existingMember.isActive) {
        await db
          .update(projectMembers)
          .set({ isActive: 1, joinedAt: new Date() })  // Fixed: Date object not string
          .where(eq(projectMembers.id, existingMember.id));
      }
      return project;
    }

    // Add user as collaborator
    await db.insert(projectMembers).values({
      projectId: project.id,
      userId,
      role: 'collaborator',
      permissions: JSON.stringify({ canEdit: true, canInvite: false }),
    });

    // Log join activity
    await this.logActivity(
      project.id,
      userId,
      'user_joined',
      'Joined the project'
    );

    return project;
  }

  /**
   * Get project chat messages
   */
  async getProjectChatMessages(
    projectId: number,
    limit: number = 50
  ): Promise<ChatMessageWithUser[]> {
    return await db
      .select({
        message: projectChatMessages,
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
        },
      })
      .from(projectChatMessages)
      .leftJoin(users, eq(projectChatMessages.userId, users.id))
      .where(eq(projectChatMessages.projectId, projectId))
      .orderBy(desc(projectChatMessages.createdAt))
      .limit(limit);
  }

  /**
   * Send chat message
   */
  async sendChatMessage(
    projectId: number,
    userId: string,
    message: string,
    messageType: string = 'text',
    metadata: any = {}
  ): Promise<ProjectChatMessage> {
    const [newMessage] = await db
      .insert(projectChatMessages)
      .values({
        projectId,
        userId,
        message,
        messageType,
        metadata: JSON.stringify(metadata),
      })
      .returning();

    // Log chat activity
    await this.logActivity(projectId, userId, 'chat_message', `Sent a message`);

    return newMessage;
  }

  /**
   * Export playground generation to project
   */
  async exportToProject(
    projectId: number,
    userId: string,
    files: Array<{ path: string; content: string }>,
    componentName: string
  ): Promise<void> {
    // Save files to project
    for (const file of files) {
      await db.insert(projectFiles).values({
        projectId,
        filePath: file.path,
        fileContent: file.content,
        fileType: this.getFileType(file.path),
        createdBy: userId,
        lastModifiedBy: userId,
      });
    }

    // Log export activity
    await this.logActivity(
      projectId,
      userId,
      'file_added',
      `Exported ${files.length} files from playground: ${componentName}`
    );
  }

  /**
   * Get project files
   */
  async getProjectFiles(projectId: number): Promise<ProjectFile[]> {
    return await db
      .select()
      .from(projectFiles)
      .where(
        and(eq(projectFiles.projectId, projectId), eq(projectFiles.isActive, 1))
      )
      .orderBy(projectFiles.filePath);
  }

  /**
   * Update project file
   */
  async updateProjectFile(
    fileId: number,
    userId: string,
    content: string
  ): Promise<void> {
    await db
      .update(projectFiles)
      .set({
        fileContent: content,
        lastModifiedBy: userId,
        updatedAt: new Date(),
        version: db
          .select()
          .from(projectFiles)
          .where(eq(projectFiles.id, fileId))
          .then(files => (files[0]?.version || 0) + 1),
      })
      .where(eq(projectFiles.id, fileId));

    // Log file modification activity
    const [file] = await db
      .select()
      .from(projectFiles)
      .where(eq(projectFiles.id, fileId))
      .limit(1);
    if (file) {
      await this.logActivity(
        file.projectId,
        userId,
        'file_modified',
        `Modified ${file.filePath}`
      );
    }
  }

  /**
   * Get recent project activity
   */
  async getRecentActivity(
    projectId: number,
    limit: number = 10
  ): Promise<ProjectActivity[]> {
    return await db
      .select()
      .from(projectActivities)
      .where(eq(projectActivities.projectId, projectId))
      .orderBy(desc(projectActivities.createdAt))
      .limit(limit);
  }

  /**
   * Log project activity
   */
  private async logActivity(
    projectId: number,
    userId: string,
    activityType: string,
    description: string,
    metadata: any = {}
  ): Promise<void> {
    await db.insert(projectActivities).values({
      projectId,
      userId,
      activityType,
      description,
      metadata: JSON.stringify(metadata),
    });

    // Update project last activity
    await db
      .update(workspaces)
      .set({ lastActivity: new Date() })  // Fixed: Date object not string
      .where(eq(workspaces.id, projectId));
  }

  /**
   * Get file count for project
   */
  private async getFileCount(projectId: number): Promise<number> {
    const result = await db
      .select({ count: projectFiles.id })
      .from(projectFiles)
      .where(
        and(eq(projectFiles.projectId, projectId), eq(projectFiles.isActive, 1))
      );

    return result.length;
  }

  /**
   * Generate unique invite code
   */
  private generateInviteCode(): string {
    return uuidv4().substring(0, 8).toUpperCase();
  }

  /**
   * Get file type from path
   */
  private getFileType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'tsx':
      case 'jsx':
        return 'component';
      case 'ts':
      case 'js':
        return 'script';
      case 'css':
      case 'scss':
        return 'style';
      case 'json':
        return 'config';
      case 'md':
        return 'documentation';
      default:
        return 'other';
    }
  }

  /**
   * Get project members
   */
  async getProjectMembers(projectId: number): Promise<any[]> {
    try {
      // Check if project_members table exists and use it
      const result = await db
        .select({
          id: (projectMembers as any).id,
          userId: (projectMembers as any).userId,
          role: (projectMembers as any).role,
          joinedAt: (projectMembers as any).joinedAt,
          user: {
            id: (users as any).id,
            email: (users as any).email,
            name: (users as any).name,
            avatar_url: (users as any).avatar_url,
          }
        })
        .from(projectMembers as any)
        .leftJoin(users as any, eq((projectMembers as any).userId, (users as any).id))
        .where(eq((projectMembers as any).projectId, projectId));

      return result;
    } catch (error) {
      // If project_members table doesn't exist, return empty array
      console.warn('getProjectMembers: project_members table may not exist', error);
      return [];
    }
  }

  /**
   * Get project activity
   */
  async getProjectActivity(projectId: number, limit: number = 10): Promise<any[]> {
    try {
      // Get recent chat messages as activity
      const messages = await db
        .select()
        .from(projectChatMessages as any)
        .where(eq((projectChatMessages as any).projectId, projectId))
        .orderBy(desc((projectChatMessages as any).createdAt))
        .limit(limit);

      return messages.map((msg: any) => ({
        type: 'message',
        description: msg.message?.substring(0, 100) + '...',
        timestamp: msg.createdAt,
        userId: msg.userId
      }));
    } catch (error) {
      console.warn('getProjectActivity error:', error);
      return [];
    }
  }
}

export const projectService = new ProjectService();

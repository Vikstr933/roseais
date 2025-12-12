import { db } from '../../db';
// Import from PostgreSQL schema for database operations
import { 
  workspaces,
  projectMembers,
  projectFiles,
  chatMessages,
  projectChatMessages,
  projectActivities,
  codeGenerationSessions,
  users,
  type Workspace,
  type ProjectMember,
  type ProjectChatMessage,
  type ProjectActivity,
  type ProjectFile,
} from '../../db/schema-pg';
import { eq, and, desc, or, sql } from 'drizzle-orm';
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

    // Sort: starred first, then by lastActivity
    const sortedProjects = Array.from(projectMap.values()).sort((a, b) => {
      // Starred projects first
      const aStarred = (a as any).isStarred === true;
      const bStarred = (b as any).isStarred === true;
      if (aStarred !== bStarred) {
        return aStarred ? -1 : 1;
      }
      // Then by lastActivity (most recent first)
      const aActivity = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
      const bActivity = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
      return bActivity - aActivity;
    });

    return sortedProjects;
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
          .set({ isActive: 1, joinedAt: new Date() })  // INTEGER: 1 = active
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
    const results = await db
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
    
    // Filter out null users and ensure type safety
    return results
      .filter((r) => r.user !== null)
      .map((r) => ({
        ...r.message,
        user: r.user!,
      })) as ChatMessageWithUser[];
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
    // Save files to project using UPSERT logic
    // This prevents duplicates and updates existing files
    const savedFiles: string[] = [];
    const failedFiles: Array<{ path: string; error: string }> = [];
    
    for (const file of files) {
      try {
        await db
          .insert(projectFiles)
          .values({
            projectId,
            filePath: file.path,
            fileContent: file.content,
            fileType: this.getFileType(file.path),
            createdBy: userId,
            lastModifiedBy: userId,
            version: 1,
          })
          .onConflictDoUpdate({
            target: [projectFiles.projectId, projectFiles.filePath],
            set: {
              fileContent: file.content,
              lastModifiedBy: userId,
              version: sql`${projectFiles.version} + 1`,
              updatedAt: new Date(),
            },
          });
        savedFiles.push(file.path);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to save file ${file.path} to project ${projectId}:`, error);
        failedFiles.push({ path: file.path, error: errorMessage });
      }
    }

    if (failedFiles.length > 0) {
      const errorMessage = `Failed to save ${failedFiles.length} of ${files.length} files. Errors: ${failedFiles.map(f => `${f.path}: ${f.error}`).join('; ')}`;
      console.error('exportToProject errors:', {
        projectId,
        userId,
        totalFiles: files.length,
        savedFiles: savedFiles.length,
        failedFiles: failedFiles.length,
        errors: failedFiles
      });
      throw new Error(errorMessage);
    }

    // Log export activity
    try {
      await this.logActivity(
        projectId,
        userId,
        'file_added',
        `Exported ${files.length} files from playground: ${componentName}`
      );
    } catch (activityError) {
      // Don't fail the entire operation if activity logging fails
      console.warn('Failed to log export activity:', activityError);
    }
  }

  /**
   * Reset project data (files, chat history, activities, sessions)
   */
  async resetProjectData(projectId: number, userId: string): Promise<void> {
    await db.delete(projectFiles).where(eq(projectFiles.projectId, projectId));
    await db
      .delete(projectChatMessages)
      .where(eq(projectChatMessages.projectId, projectId));
    await db
      .delete(projectActivities)
      .where(eq(projectActivities.projectId, projectId));
    await db
      .delete(chatMessages as any)
      .where(eq((chatMessages as any).projectId, projectId));
    await db
      .delete(codeGenerationSessions as any)
      .where(eq((codeGenerationSessions as any).workspaceId, projectId));

    await this.logActivity(
      projectId,
      userId,
      'project_reset',
      'Cleared project workspace'
    );
  }

  /**
   * Get project files
   */
  async getProjectFiles(projectId: number): Promise<ProjectFile[]> {
    const { retryDbOperation } = await import('../utils/dbRetry');
    return await retryDbOperation(async () => {
      return await db
        .select()
        .from(projectFiles)
        .where(
          and(eq(projectFiles.projectId, projectId), eq(projectFiles.isActive, true))
        )
        .orderBy(projectFiles.filePath);
    });
  }

  /**
   * Create a new project file
   */
  async createProjectFile(
    projectId: number,
    filePath: string,
    content: string,
    userId: string
  ): Promise<ProjectFile> {
    // Check if file already exists
    const existing = await db
      .select()
      .from(projectFiles)
      .where(
        and(
          eq(projectFiles.projectId, projectId),
          eq(projectFiles.filePath, filePath),
          eq(projectFiles.isActive, true)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`File ${filePath} already exists in project ${projectId}`);
    }

    const fileType = filePath.split('.').pop() || 'txt';
    
    const [newFile] = await db
      .insert(projectFiles)
      .values({
        projectId,
        filePath,
        fileContent: content,
        fileType,
        createdBy: userId,
        lastModifiedBy: userId,
        isActive: true,
        version: 1,
      })
      .returning();

    // Log file creation activity
    await this.logActivity(
      projectId,
      userId,
      'file_created',
      `Created ${filePath}`
    );

    return newFile;
  }

  /**
   * Update project file by file path (instead of file ID)
   */
  async updateProjectFileByPath(
    projectId: number,
    filePath: string,
    userId: string,
    content: string
  ): Promise<void> {
    const existing = await db
      .select()
      .from(projectFiles)
      .where(
        and(
          eq(projectFiles.projectId, projectId),
          eq(projectFiles.filePath, filePath),
          eq(projectFiles.isActive, true)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      // File doesn't exist, create it instead
      await this.createProjectFile(projectId, filePath, content, userId);
      return;
    }

    await db
      .update(projectFiles)
      .set({
        fileContent: content,
        lastModifiedBy: userId,
        updatedAt: new Date(),
        version: (existing[0]?.version || 0) + 1,
      })
      .where(eq(projectFiles.id, existing[0].id));

    // Log file modification activity
    await this.logActivity(
      projectId,
      userId,
      'file_modified',
      `Modified ${filePath}`
    );
  }

  /**
   * Update project file by file ID
   */
  async updateProjectFile(
    fileId: number,
    userId: string,
    content: string
  ): Promise<void> {
    // Get current version first
    const currentFile = await db
      .select({ version: projectFiles.version })
      .from(projectFiles)
      .where(eq(projectFiles.id, fileId))
      .limit(1);
    
    const newVersion = currentFile[0]?.version ? currentFile[0].version + 1 : 1;
    
    await db
      .update(projectFiles)
      .set({
        fileContent: content,
        lastModifiedBy: userId,
        updatedAt: new Date(),
        version: newVersion,
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
   * Delete project file (soft delete by setting isActive = false)
   */
  async deleteProjectFile(
    projectId: number,
    filePath: string,
    userId: string
  ): Promise<void> {
    const existing = await db
      .select()
      .from(projectFiles)
      .where(
        and(
          eq(projectFiles.projectId, projectId),
          eq(projectFiles.filePath, filePath),
            eq(projectFiles.isActive, true)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      throw new Error(`File ${filePath} not found in project ${projectId}`);
    }

    await db
      .update(projectFiles)
      .set({
        isActive: false,
        lastModifiedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(projectFiles.id, existing[0].id));

    // Log file deletion activity
    await this.logActivity(
      projectId,
      userId,
      'file_deleted',
      `Deleted ${filePath}`
    );
  }

  /**
   * Check if user has access to project
   */
  async checkProjectAccess(projectId: number, userId: string): Promise<boolean> {
    // Check if user is owner
    const project = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, projectId))
      .limit(1);

    if (project.length === 0) {
      return false;
    }

    if (project[0].ownerId === userId) {
      return true;
    }

    // Check if user is a member
    const member = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
          eq(projectMembers.isActive, 1)
        )
      )
      .limit(1);

    return member.length > 0;
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
        and(eq(projectFiles.projectId, projectId), eq(projectFiles.isActive, true))
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
      // Try PostgreSQL schema first (project_members table)
      try {
        const result = await db
          .select({
            id: projectMembers.id,
            projectId: projectMembers.projectId,
            userId: projectMembers.userId,
            role: projectMembers.role,
            joinedAt: projectMembers.joinedAt,
            isActive: projectMembers.isActive,
            user: {
              id: users.id,
              username: users.username,
              displayName: users.displayName,
              email: users.email,
            }
          })
          .from(projectMembers)
          .leftJoin(users, eq(projectMembers.userId, users.id))
          .where(and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.isActive, 1)
          ));

        if (result && Array.isArray(result)) {
          return result
            .filter((member: any) => member != null && member.user != null)
            .map((member: any) => ({
              id: member.id,
              projectId: member.projectId,
              userId: member.userId,
              role: member.role,
              joinedAt: member.joinedAt,
              isActive: member.isActive,
              user: {
                id: member.user.id,
                username: member.user.username,
                displayName: member.user.displayName,
                email: member.user.email,
              }
            }));
        }
      } catch (pgError) {
        console.warn('PostgreSQL project_members query failed, trying SQLite schema:', pgError);
        // Fall through to SQLite schema
      }

      // Fallback to SQLite schema if PostgreSQL fails
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

      // Validate result - ensure it's an array and filter out null/undefined entries
      if (!result || !Array.isArray(result)) {
        return [];
      }

      // Filter out any null/undefined entries and ensure user object exists
      return result
        .filter((member: any) => member != null)
        .map((member: any) => ({
          ...member,
          user: member.user || null
        }));
    } catch (error: any) {
      // If project_members table doesn't exist or query fails, return empty array
      console.warn('getProjectMembers: project_members table may not exist or query failed', {
        error: error?.message || String(error),
        projectId
      });
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

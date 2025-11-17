import { useState, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { getAuthHeaders } from '../contexts/AuthContext';
import { useToast } from '../hooks/use-toast';

interface Project {
  id: number;
  name: string;
  description?: string;
  workspaceType?: 'personal' | 'team';
}

interface UseProjectManagementOptions {
  onProjectCreated?: (project: Project) => void;
  onProjectDeleted?: (projectId: number) => void;
  onProjectRenamed?: (project: Project) => void;
}

/**
 * Custom hook for managing project operations
 * Handles creating, deleting, renaming, and switching projects
 */
export function useProjectManagement(
  sessionToken: string | null,
  options: UseProjectManagementOptions = {}
) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  const createProject = useCallback(
    async (projectData: { name: string; description: string; projectType?: string }) => {
      if (!sessionToken) {
        toast({
          title: "Error",
          description: "You must be logged in to create a project",
          variant: "destructive",
        });
        return null;
      }

      setIsCreating(true);
      try {
        const response = await apiFetch('/api/workspaces', {
          method: 'POST',
          headers: {
            ...getAuthHeaders(sessionToken),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(projectData),
        });

        if (!response.ok) {
          throw new Error('Failed to create project');
        }

        const newProject = await response.json();
        
        toast({
          title: "Project Created",
          description: `${newProject.name} has been created successfully!`,
        });

        options.onProjectCreated?.(newProject);
        return newProject;
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to create project",
          variant: "destructive",
        });
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [sessionToken, toast, options]
  );

  const deleteProject = useCallback(
    async (projectId: number) => {
      if (!sessionToken) {
        toast({
          title: "Error",
          description: "You must be logged in to delete a project",
          variant: "destructive",
        });
        return false;
      }

      setIsDeleting(true);
      try {
        const response = await apiFetch(`/api/workspaces/${projectId}`, {
          method: 'DELETE',
          headers: {
            ...getAuthHeaders(sessionToken),
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to delete project');
        }

        toast({
          title: "Project Deleted",
          description: "The project has been deleted successfully.",
        });

        options.onProjectDeleted?.(projectId);
        return true;
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to delete project",
          variant: "destructive",
        });
        return false;
      } finally {
        setIsDeleting(false);
      }
    },
    [sessionToken, toast, options]
  );

  const renameProject = useCallback(
    async (projectId: number, newName: string) => {
      if (!sessionToken) {
        toast({
          title: "Error",
          description: "You must be logged in to rename a project",
          variant: "destructive",
        });
        return null;
      }

      if (!newName || newName.trim().length === 0) {
        toast({
          title: "Error",
          description: "Project name cannot be empty",
          variant: "destructive",
        });
        return null;
      }

      setIsRenaming(true);
      try {
        const response = await apiFetch(`/api/workspaces/${projectId}`, {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(sessionToken),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: newName.trim() }),
        });

        if (!response.ok) {
          throw new Error('Failed to rename project');
        }

        const updatedProject = await response.json();
        
        toast({
          title: "Project Renamed",
          description: `Project renamed to "${updatedProject.name}"`,
        });

        options.onProjectRenamed?.(updatedProject);
        return updatedProject;
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to rename project",
          variant: "destructive",
        });
        return null;
      } finally {
        setIsRenaming(false);
      }
    },
    [sessionToken, toast, options]
  );

  const saveProjectFiles = useCallback(
    async (projectId: number, files: Array<{ path: string; content: string }>, componentName: string) => {
      if (!sessionToken) {
        toast({
          title: "Error",
          description: "You must be logged in to save files",
          variant: "destructive",
        });
        return false;
      }

      try {
        const response = await apiFetch(`/api/workspaces/${projectId}/export`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(sessionToken),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            files,
            componentName,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save files');
        }

        toast({
          title: "Saved",
          description: "Project files saved successfully",
        });
        return true;
      } catch (error: any) {
        toast({
          title: "Save Failed",
          description: error.message || "Could not save files",
          variant: "destructive",
        });
        return false;
      }
    },
    [sessionToken, toast]
  );

  return {
    createProject,
    deleteProject,
    renameProject,
    saveProjectFiles,
    isCreating,
    isDeleting,
    isRenaming,
  };
}


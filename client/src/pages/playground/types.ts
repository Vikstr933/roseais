/**
 * Type definitions for the PromptPlayground
 * Extracted from PromptPlayground.tsx for better code organization
 */

import type { GeneratedFile, ChatMessage as WorkspaceChatMessage } from '../../contexts/WorkspaceContext';

// Re-export for convenience
export type { GeneratedFile, WorkspaceChatMessage };

/**
 * Raw file from AI generation before normalization
 */
export type RawGeneratedFile = {
  path: string;
  content: string;
};

/**
 * AI response structure from the generation API
 */
export interface AIResponse {
  type: 'text' | 'component';
  text: string;
  files?: RawGeneratedFile[];
}

/**
 * Step in the orchestration pipeline
 */
export interface OrchestrationStep {
  agent: string;
  task: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[];
  previews?: string[];
}

/**
 * Response from the generate API endpoint
 */
export interface GenerateResponse {
  response: AIResponse;
  orchestrationPlan: {
    subtasks: OrchestrationStep[];
  } | null;
}

/**
 * Playground-specific response with normalized files
 */
export type PlaygroundResponse = Omit<AIResponse, 'files'> & { 
  files?: GeneratedFile[];
};

/**
 * Session data from the API
 */
export interface Session {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  inputPrompt: string;
  generatedCode: string;
  status: string;
}

/**
 * Form field props for react-hook-form integration
 */
export interface FormFieldProps {
  field: {
    value: any;
    onChange: (value: any) => void;
  };
}

/**
 * Project data structure
 */
export interface Project {
  id: number;
  name: string;
  description?: string;
  workspaceType?: 'personal' | 'team';
}

/**
 * Agent status for tracking orchestration progress
 */
export interface AgentStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  currentMessage?: string;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
}

/**
 * Status message for real-time updates
 */
export interface StatusMessage {
  id: string;
  content: string;
  timestamp: number;
  type: string;
}

/**
 * API key dialog state
 */
export interface APIKeyDialogData {
  missingApiKeys: string[];
  databaseType: 'mongodb' | 'postgresql' | 'mysql';
  projectId?: number;
}

/**
 * Tab types for the main playground interface
 * Note: 'sessions' tab has been removed
 */
export type PlaygroundTab = 'desktop' | 'editor' | 'preview' | 'settings';

/**
 * Editor theme options
 */
export type EditorTheme = 'vs-dark' | 'light';

/**
 * Project type options for generation
 */
export type ProjectType = 'react' | 'vue' | 'node' | 'python';

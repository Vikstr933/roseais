/**
 * Utility functions for PromptPlayground
 * Pure functions with no side effects - safe to extract and test
 */

import type { GeneratedFile } from "../../contexts/WorkspaceContext";
import type { RawGeneratedFile, AIResponse, PlaygroundResponse } from "./types";

// ============================================================================
// File Language Detection
// ============================================================================

/**
 * Get the language identifier for Monaco Editor based on file extension
 */
export function getFileLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'sql':
      return 'sql';
    case 'py':
      return 'python';
    case 'sh':
    case 'bash':
      return 'shell';
    default:
      return 'typescript';
  }
}

// ============================================================================
// Path Normalization
// ============================================================================

/**
 * Remove workspace prefix from file paths
 * e.g., "/workspaces/my-project/src/App.tsx" -> "src/App.tsx"
 */
export function stripWorkspacePrefix(filePath: string): string {
  return filePath.replace(/^\/?workspaces\/[^/]+\//, '');
}

/**
 * Normalize a file path to be consistent
 */
export function normalizePath(path: string): string {
  return stripWorkspacePrefix(path)
    .replace(/\\/g, '/') // Convert Windows backslashes
    .replace(/^\/+/, ''); // Remove leading slashes
}

// ============================================================================
// File Creation Helpers
// ============================================================================

/**
 * Create a GeneratedFile object from path and content
 */
export function createGeneratedFile(path: string, content: string): GeneratedFile {
  return {
    path: normalizePath(path),
    content,
    language: getFileLanguage(path),
  };
}

/**
 * Map raw API files to GeneratedFile format
 */
export function mapRawFilesToGenerated(files: RawGeneratedFile[]): GeneratedFile[] {
  return files.map((file) => createGeneratedFile(file.path, file.content));
}

/**
 * Convert raw AI response to playground response format
 */
export function toPlaygroundResponse(raw: AIResponse): PlaygroundResponse {
  return {
    type: raw.type,
    text: raw.text,
    files: raw.files ? mapRawFilesToGenerated(raw.files) : undefined,
  };
}

// ============================================================================
// File Content Helpers
// ============================================================================

/**
 * Get file extension from path
 */
export function getFileExtension(path: string): string {
  return path.split('.').pop()?.toLowerCase() || '';
}

/**
 * Check if file is a TypeScript/JavaScript file
 */
export function isCodeFile(path: string): boolean {
  const ext = getFileExtension(path);
  return ['ts', 'tsx', 'js', 'jsx'].includes(ext);
}

/**
 * Check if file is a style file
 */
export function isStyleFile(path: string): boolean {
  const ext = getFileExtension(path);
  return ['css', 'scss', 'sass', 'less'].includes(ext);
}

/**
 * Check if file is a config file
 */
export function isConfigFile(path: string): boolean {
  const filename = path.split('/').pop() || '';
  const configPatterns = [
    'package.json',
    'tsconfig.json',
    'vite.config',
    'tailwind.config',
    'postcss.config',
    '.env',
  ];
  return configPatterns.some(pattern => filename.includes(pattern));
}

// ============================================================================
// Agent Name Formatting
// ============================================================================

/**
 * Format agent ID to display name
 * e.g., "component-developer" -> "Component Developer"
 */
export function formatAgentName(agentId: string): string {
  return agentId
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// Time Formatting
// ============================================================================

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Format token count with thousands separator
 */
export function formatTokenCount(count: number): string {
  return count.toLocaleString();
}

// ============================================================================
// Chat History Filtering
// ============================================================================

import { isStatusMessage } from './constants';

/**
 * Filter chat history to remove status messages
 */
export function filterChatHistory<T extends { role: string; content?: string }>(
  history: T[]
): T[] {
  return history.filter(msg => {
    const content = msg.content || '';
    // Keep user messages
    if (msg.role === 'user') return true;
    // Filter out status messages for assistant
    return !isStatusMessage(content);
  });
}

// ============================================================================
// File Path Utilities
// ============================================================================

/**
 * Get the directory part of a file path
 */
export function getDirectory(path: string): string {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/') || '/';
}

/**
 * Get the filename from a path
 */
export function getFilename(path: string): string {
  return path.split('/').pop() || path;
}

/**
 * Sort files by path for consistent display
 */
export function sortFilesByPath(files: GeneratedFile[]): GeneratedFile[] {
  return [...files].sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Group files by directory
 */
export function groupFilesByDirectory(files: GeneratedFile[]): Map<string, GeneratedFile[]> {
  const groups = new Map<string, GeneratedFile[]>();
  
  for (const file of files) {
    const dir = getDirectory(file.path);
    const existing = groups.get(dir) || [];
    groups.set(dir, [...existing, file]);
  }
  
  return groups;
}


export interface AgentConfig {
  name: string;
  description: string;
  role: string;
  model: string;
  temperature: number;
  capabilities: Record<string, boolean>;
  expertise: Record<string, string>;
  frameworks: Record<string, boolean>;
  libraries: Record<string, boolean>;
  bestPractices: Record<string, boolean>;
}

export interface DependencyConfig {
  [key: string]: string;
}

export interface ApplicationConfig {
  name: string;
  features: string[];
  dependencies: DependencyConfig;
  devDependencies: DependencyConfig;
  scripts: { [key: string]: string };
}

export interface ComponentFeatures {
  name: string;
  features: string[];
  styling: {
    animations: boolean;
    theme: 'light' | 'dark';
  };
  selectedAgents?: string[];
  routing?: boolean;
  stateManagement?: {
    type: 'redux' | 'context' | 'none';
    persist?: boolean;
  };
  testing?: {
    unit?: boolean;
    integration?: boolean;
    e2e?: boolean;
  };
  api?: {
    type: 'rest' | 'graphql';
    endpoints?: string[];
  };
}

export interface PluginConfig {
  entryPoint: string;
  dependencies: Record<string, string>;
  hooks: {
    beforeExecution?: string;
    afterExecution?: string;
    onError?: string;
  };
}

export interface AgentResult {
  success: boolean;
  content?: string;
  errors?: string[];
  files?: GeneratedFile[];
  metadata?: {
    executionTime: number;
    resourceUsage: {
      memory: number;
      cpu: number;
    };
  };
}

export interface OrchestrationResult {
  success: boolean;
  files: GeneratedFile[];
  errors: string[];
  warnings: string[];
  metadata: {
    startTime: string;
    endTime: string;
    agentsUsed: string[];
    resourceUsage: {
      totalMemory: number;
      peakMemory: number;
      averageCpu: number;
    };
  };
}

export interface VersionControl {
  version: string;
  changes: {
    type: 'added' | 'modified' | 'deleted';
    path: string;
    timestamp: string;
    author: string;
  }[];
  dependencies: Record<string, string>;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  component: string;
  message: string;
  metadata?: Record<string, unknown>;
  context?: {
    agentId?: string;
    workflowId?: string;
    requestId?: string;
  };
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

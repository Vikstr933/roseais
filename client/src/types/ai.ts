export interface AIResponse {
  type: 'text' | 'component';
  text?: string;
  files?: Array<{
    path: string;
    content: string;
  }>;
  preview?: {
    url: string;
    editorUrl: string;
  };
  webContainer?: {
    url: string;
    instanceId: string;
  };
}

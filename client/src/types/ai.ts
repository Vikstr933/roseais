export interface AIResponse {
  type: 'text' | 'component';
  text: string;
  files?: Array<{
    path: string;
    content: string;
  }>;
} 
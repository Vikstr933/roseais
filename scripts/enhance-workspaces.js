import Database from 'better-sqlite3';

const db = new Database('./db/db.sqlite');

console.log('Adding enhanced workspace examples for AI development...');

// More comprehensive workspace examples
const enhancedWorkspacesData = [
  {
    name: 'Multi-Agent Code Review System',
    description:
      'Automated code review system using multiple AI agents for comprehensive analysis, security scanning, and performance optimization',
    agentConfig: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      parameters: {
        temperature: 0.3,
        maxTokens: 8000,
      },
      prompts: [
        'Analyze code for security vulnerabilities',
        'Check for performance bottlenecks and optimization opportunities',
        'Review code style and best practices',
        'Generate comprehensive documentation',
        'Suggest architectural improvements',
        'Validate test coverage and add missing tests',
      ],
    }),
    testCases: JSON.stringify([
      {
        name: 'Security Vulnerability Detection',
        input: 'Review this authentication middleware for security issues',
        expectedOutput:
          'Should identify SQL injection, XSS, and authentication bypass vulnerabilities',
      },
      {
        name: 'Performance Analysis',
        input: 'Analyze database query performance in this React component',
        expectedOutput:
          'Should suggest query optimization and caching strategies',
      },
      {
        name: 'Code Quality Assessment',
        input: 'Review this Python API for code quality and maintainability',
        expectedOutput:
          'Should provide detailed code quality metrics and improvement suggestions',
      },
    ]),
    collaborators: JSON.stringify([
      'security-team@company.com',
      'dev-team@company.com',
      'qa-team@company.com',
    ]),
    status: 'active',
  },
  {
    name: 'AI Content Generation Pipeline',
    description:
      'End-to-end content creation system with AI agents for research, writing, editing, and multimedia generation',
    agentConfig: JSON.stringify({
      model: 'gpt-4o-2024-11-20',
      parameters: {
        temperature: 0.8,
        maxTokens: 6000,
      },
      prompts: [
        'Research trending topics and generate content outlines',
        'Write engaging blog posts based on research',
        'Create relevant images and graphics for content',
        'Generate social media posts and captions',
        'Optimize content for SEO and readability',
        'Create video scripts and storyboards',
      ],
    }),
    testCases: JSON.stringify([
      {
        name: 'Blog Post Generation',
        input: 'Generate a blog post about AI in healthcare',
        expectedOutput:
          'Should produce well-researched, engaging content with proper structure',
      },
      {
        name: 'Social Media Content',
        input: 'Create social media posts for the blog article',
        expectedOutput:
          'Should generate platform-specific content (Twitter, LinkedIn, Instagram)',
      },
    ]),
    collaborators: JSON.stringify([
      'content-team@company.com',
      'marketing@company.com',
      'design@company.com',
    ]),
    status: 'active',
  },
  {
    name: 'Machine Learning Model Development',
    description:
      'Complete ML pipeline with data preprocessing, model training, evaluation, and deployment automation',
    agentConfig: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      parameters: {
        temperature: 0.4,
        maxTokens: 10000,
      },
      prompts: [
        'Analyze dataset and suggest preprocessing steps',
        'Design and implement ML model architecture',
        'Create comprehensive evaluation metrics',
        'Generate model deployment code',
        'Create monitoring and alerting systems',
        'Document model performance and limitations',
      ],
    }),
    testCases: JSON.stringify([
      {
        name: 'Dataset Analysis',
        input: 'Analyze this customer churn dataset and suggest ML approaches',
        expectedOutput:
          'Should provide data insights, feature engineering suggestions, and model recommendations',
      },
      {
        name: 'Model Deployment',
        input: 'Generate deployment code for the trained model',
        expectedOutput:
          'Should create production-ready API with proper error handling and monitoring',
      },
    ]),
    collaborators: JSON.stringify([
      'ml-team@company.com',
      'data-team@company.com',
      'devops@company.com',
    ]),
    status: 'planning',
  },
  {
    name: 'API Integration and Testing Suite',
    description:
      'Comprehensive API development, testing, and integration system with automated documentation and client generation',
    agentConfig: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      parameters: {
        temperature: 0.6,
        maxTokens: 5000,
      },
      prompts: [
        'Design RESTful API architecture and endpoints',
        'Generate comprehensive API documentation',
        'Create automated test suites',
        'Build client SDKs and examples',
        'Implement authentication and authorization',
        'Add rate limiting and caching strategies',
      ],
    }),
    testCases: JSON.stringify([
      {
        name: 'API Documentation',
        input: 'Generate OpenAPI specification for user management API',
        expectedOutput:
          'Should create complete OpenAPI 3.0 specification with examples',
      },
      {
        name: 'Test Coverage',
        input: 'Create comprehensive test suite for authentication endpoints',
        expectedOutput:
          'Should generate unit tests, integration tests, and load tests',
      },
    ]),
    collaborators: JSON.stringify([
      'backend-team@company.com',
      'frontend-team@company.com',
      'qa-team@company.com',
    ]),
    status: 'in_progress',
  },
  {
    name: 'Real-time Data Dashboard',
    description:
      'Interactive dashboard with real-time data visualization, alerts, and automated report generation',
    agentConfig: JSON.stringify({
      model: 'gpt-4o-2024-11-20',
      parameters: {
        temperature: 0.5,
        maxTokens: 4000,
      },
      prompts: [
        'Design interactive dashboard layout and components',
        'Implement real-time data streaming and updates',
        'Create alerting and notification systems',
        'Generate automated reports and insights',
        'Build data export and sharing features',
        'Add user customization and preferences',
      ],
    }),
    testCases: JSON.stringify([
      {
        name: 'Real-time Updates',
        input: 'Implement WebSocket connection for live data updates',
        expectedOutput:
          'Should handle connection management, data synchronization, and error recovery',
      },
      {
        name: 'Report Generation',
        input: 'Create automated weekly report generation system',
        expectedOutput:
          'Should generate PDF reports with charts, insights, and recommendations',
      },
    ]),
    collaborators: JSON.stringify([
      'analytics@company.com',
      'product@company.com',
      'executive@company.com',
    ]),
    status: 'active',
  },
  {
    name: 'Voice Assistant Development',
    description:
      'Advanced voice assistant with natural language understanding, speech synthesis, and contextual awareness',
    agentConfig: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      parameters: {
        temperature: 0.7,
        maxTokens: 3000,
      },
      prompts: [
        'Implement speech-to-text processing',
        'Build natural language understanding pipeline',
        'Create contextual response generation',
        'Add voice synthesis capabilities',
        'Implement conversation memory and context',
        'Add multi-language support',
      ],
    }),
    testCases: JSON.stringify([
      {
        name: 'Speech Recognition',
        input: 'Implement speech-to-text for voice commands',
        expectedOutput:
          'Should accurately transcribe various accents and speaking styles',
      },
      {
        name: 'Contextual Responses',
        input: 'Generate contextually appropriate responses to user queries',
        expectedOutput:
          'Should maintain conversation context and provide relevant, helpful responses',
      },
    ]),
    collaborators: JSON.stringify([
      'ai-team@company.com',
      'ux-team@company.com',
      'linguistics@company.com',
    ]),
    status: 'planning',
  },
];

// Insert enhanced workspaces data
const insertWorkspace = db.prepare(`
  INSERT OR IGNORE INTO workspaces (name, description, agent_config, test_cases, collaborators, status)
  VALUES (?, ?, ?, ?, ?, ?)
`);

for (const workspace of enhancedWorkspacesData) {
  try {
    insertWorkspace.run(
      workspace.name,
      workspace.description,
      workspace.agentConfig,
      workspace.testCases,
      workspace.collaborators,
      workspace.status
    );
    console.log(`✅ Inserted enhanced workspace: ${workspace.name}`);
  } catch (error) {
    console.error(`❌ Failed to insert workspace ${workspace.name}:`, error);
  }
}

console.log('🎉 Enhanced workspaces added successfully!');
db.close();

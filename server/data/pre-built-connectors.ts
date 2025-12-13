/**
 * Pre-built Connectors Configuration
 * These are ready-to-use connectors that users can configure with API keys and env variables
 */

export interface EnvVariable {
  name: string;
  label: string;
  description: string;
  type: 'password' | 'text' | 'url';
  required: boolean;
  placeholder?: string;
  helpUrl?: string;
}

export interface PreBuiltConnector {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'payment' | 'deployment' | 'ai' | 'version-control' | 'communication';
  apiKeys: Array<{
    name: string;
    label: string;
    description: string;
    type: 'api_key' | 'secret' | 'token' | 'password';
    required: boolean;
    placeholder?: string;
    helpUrl?: string;
  }>;
  envVariables: EnvVariable[];
  documentationUrl?: string;
  isShared: boolean; // If true, should be configured as shared connector
}

export const PRE_BUILT_CONNECTORS: PreBuiltConnector[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing and subscription management',
    icon: '💳',
    category: 'payment',
    isShared: true,
    apiKeys: [
      {
        name: 'STRIPE_SECRET_KEY',
        label: 'Secret Key',
        description: 'Your Stripe secret key (starts with sk_test_ or sk_live_)',
        type: 'secret',
        required: true,
        placeholder: 'sk_test_...',
        helpUrl: 'https://dashboard.stripe.com/apikeys',
      },
      {
        name: 'STRIPE_PUBLISHABLE_KEY',
        label: 'Publishable Key',
        description: 'Your Stripe publishable key (starts with pk_test_ or pk_live_)',
        type: 'api_key',
        required: false,
        placeholder: 'pk_test_...',
        helpUrl: 'https://dashboard.stripe.com/apikeys',
      },
      {
        name: 'STRIPE_WEBHOOK_SECRET',
        label: 'Webhook Secret',
        description: 'Webhook signing secret for verifying webhook events',
        type: 'secret',
        required: false,
        placeholder: 'whsec_...',
        helpUrl: 'https://dashboard.stripe.com/webhooks',
      },
    ],
    envVariables: [
      {
        name: 'STRIPE_SECRET_KEY',
        label: 'Stripe Secret Key',
        description: 'Used in backend for payment processing',
        type: 'password',
        required: true,
        helpUrl: 'https://dashboard.stripe.com/apikeys',
      },
      {
        name: 'STRIPE_PUBLISHABLE_KEY',
        label: 'Stripe Publishable Key',
        description: 'Used in frontend for payment forms',
        type: 'text',
        required: false,
        helpUrl: 'https://dashboard.stripe.com/apikeys',
      },
    ],
    documentationUrl: 'https://stripe.com/docs',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Deploy and host your applications',
    icon: '▲',
    category: 'deployment',
    isShared: true,
    apiKeys: [
      {
        name: 'VERCEL_TOKEN',
        label: 'Vercel API Token',
        description: 'Your Vercel API token for deployments',
        type: 'token',
        required: true,
        placeholder: 'vercel_...',
        helpUrl: 'https://vercel.com/account/tokens',
      },
      {
        name: 'VERCEL_TEAM_ID',
        label: 'Team ID (Optional)',
        description: 'Your Vercel team ID if using team account',
        type: 'text',
        required: false,
        placeholder: 'team_...',
        helpUrl: 'https://vercel.com/docs/teams',
      },
    ],
    envVariables: [
      {
        name: 'VERCEL_TOKEN',
        label: 'Vercel Token',
        description: 'Used for automatic deployments',
        type: 'password',
        required: true,
        helpUrl: 'https://vercel.com/account/tokens',
      },
    ],
    documentationUrl: 'https://vercel.com/docs',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Version control and repository management',
    icon: '🐙',
    category: 'version-control',
    isShared: true,
    apiKeys: [
      {
        name: 'GITHUB_TOKEN',
        label: 'Personal Access Token',
        description: 'GitHub personal access token with repo permissions',
        type: 'token',
        required: true,
        placeholder: 'ghp_...',
        helpUrl: 'https://github.com/settings/tokens',
      },
    ],
    envVariables: [
      {
        name: 'GITHUB_TOKEN',
        label: 'GitHub Token',
        description: 'Used for repository operations',
        type: 'password',
        required: true,
        helpUrl: 'https://github.com/settings/tokens',
      },
    ],
    documentationUrl: 'https://docs.github.com',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'AI models and API access',
    icon: '🤖',
    category: 'ai',
    isShared: false, // Usually personal
    apiKeys: [
      {
        name: 'OPENAI_API_KEY',
        label: 'API Key',
        description: 'Your OpenAI API key',
        type: 'api_key',
        required: true,
        placeholder: 'sk-...',
        helpUrl: 'https://platform.openai.com/api-keys',
      },
    ],
    envVariables: [
      {
        name: 'OPENAI_API_KEY',
        label: 'OpenAI API Key',
        description: 'Used for AI model access',
        type: 'password',
        required: true,
        helpUrl: 'https://platform.openai.com/api-keys',
      },
    ],
    documentationUrl: 'https://platform.openai.com/docs',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude AI models and API access',
    icon: '🧠',
    category: 'ai',
    isShared: false, // Usually personal
    apiKeys: [
      {
        name: 'ANTHROPIC_API_KEY',
        label: 'API Key',
        description: 'Your Anthropic API key',
        type: 'api_key',
        required: true,
        placeholder: 'sk-ant-api03-...',
        helpUrl: 'https://console.anthropic.com/settings/keys',
      },
    ],
    envVariables: [
      {
        name: 'ANTHROPIC_API_KEY',
        label: 'Anthropic API Key',
        description: 'Used for Claude AI model access',
        type: 'password',
        required: true,
        helpUrl: 'https://console.anthropic.com/settings/keys',
      },
    ],
    documentationUrl: 'https://docs.anthropic.com',
  },
];

/**
 * Get a pre-built connector by ID
 */
export function getPreBuiltConnector(id: string): PreBuiltConnector | undefined {
  return PRE_BUILT_CONNECTORS.find(connector => connector.id === id);
}

/**
 * Get all pre-built connectors
 */
export function getAllPreBuiltConnectors(): PreBuiltConnector[] {
  return PRE_BUILT_CONNECTORS;
}

/**
 * Get shared connectors (for workspace-wide use)
 */
export function getSharedConnectors(): PreBuiltConnector[] {
  return PRE_BUILT_CONNECTORS.filter(connector => connector.isShared);
}

/**
 * Get personal connectors (for individual use)
 */
export function getPersonalConnectors(): PreBuiltConnector[] {
  return PRE_BUILT_CONNECTORS.filter(connector => !connector.isShared);
}


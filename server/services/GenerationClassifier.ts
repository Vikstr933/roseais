export type GenerationSpeedMode = 'fast_frontend' | 'standard';

const SIMPLE_FRONTEND_KEYWORDS = [
  'qr',
  'qr code',
  'qr-code',
  'qr-kod',
  'qrkod',
  'calculator',
  'räknare',
  'raknare',
  'converter',
  'konverterare',
  'timer',
  'stopwatch',
  'counter',
  'todo',
  'to-do',
  'notes',
  'note app',
  'landing page',
  'portfolio',
  'static site',
  'browser-only',
  'frontend only',
  'frontend-only',
];

const BACKEND_OR_EXTERNAL_SIGNALS = [
  'supabase',
  'cloudinary',
  'database',
  'databas',
  'postgres',
  'postgresql',
  'mongodb',
  'mysql',
  'firebase',
  'backend',
  'server',
  'api endpoint',
  'rest api',
  'auth',
  'authentication',
  'login',
  'log in',
  'signin',
  'sign in',
  'register',
  'signup',
  'user account',
  'users',
  'användare',
  'anvandare',
  'logga in',
  'registrera',
  'konto',
  'cloud storage',
  'online storage',
  'save to account',
  'spara i konto',
  'payments',
  'payment',
  'stripe',
  'subscription',
  'openai',
  'gpt',
  'chatgpt',
  'anthropic',
  'claude',
];

const BROWSER_ONLY_OVERRIDES = [
  'browser-only',
  'frontend only',
  'frontend-only',
  'client-side only',
  'client side only',
  'local browser',
  'no backend',
  'without backend',
  'no api keys',
  'without api keys',
  'utan backend',
  'utan api nycklar',
  'utan api-nycklar',
];

export function isSimpleFrontendPrompt(prompt: string): boolean {
  const promptLower = prompt.toLowerCase();
  const hasSimpleSignal = SIMPLE_FRONTEND_KEYWORDS.some(keyword => promptLower.includes(keyword));
  if (!hasSimpleSignal) return false;

  const hasBackendSignal = BACKEND_OR_EXTERNAL_SIGNALS.some(signal => promptLower.includes(signal));
  const hasBrowserOnlyOverride = BROWSER_ONLY_OVERRIDES.some(signal => promptLower.includes(signal));

  return !hasBackendSignal || hasBrowserOnlyOverride;
}

export function getGenerationSpeedMode(prompt: string): GenerationSpeedMode {
  return isSimpleFrontendPrompt(prompt) ? 'fast_frontend' : 'standard';
}

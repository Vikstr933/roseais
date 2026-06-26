export type PlanTier = 'free' | 'pro' | 'enterprise';

export interface TierLimits {
  appGenerationsPerMonth: number;
  maxProjects: number;
  projectApiKeys: boolean;
  userWideApiKeys: boolean;
  fullstackGeneration: boolean;
  publicProjects: boolean;
  codeExport: boolean;
  productionDeploy: boolean;
}

export interface PlanDetails {
  name: string;
  price: number;
  priceId?: string;
  credits: number;
  features: string[];
  limits: TierLimits;
}

function numberFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export const TIER_LIMITS: Record<PlanTier, TierLimits> = {
  free: {
    appGenerationsPerMonth: numberFromEnv('FREE_MONTHLY_GENERATION_LIMIT', 3),
    maxProjects: numberFromEnv('FREE_MAX_PROJECTS', 3),
    projectApiKeys: false,
    userWideApiKeys: false,
    fullstackGeneration: false,
    publicProjects: false,
    codeExport: false,
    productionDeploy: false,
  },
  pro: {
    appGenerationsPerMonth: numberFromEnv('PRO_MONTHLY_GENERATION_LIMIT', 500),
    maxProjects: numberFromEnv('PRO_MAX_PROJECTS', 50),
    projectApiKeys: true,
    userWideApiKeys: false,
    fullstackGeneration: true,
    publicProjects: true,
    codeExport: true,
    productionDeploy: true,
  },
  enterprise: {
    appGenerationsPerMonth: numberFromEnv('ENTERPRISE_MONTHLY_GENERATION_LIMIT', 2000),
    maxProjects: numberFromEnv('ENTERPRISE_MAX_PROJECTS', 250),
    projectApiKeys: true,
    userWideApiKeys: true,
    fullstackGeneration: true,
    publicProjects: true,
    codeExport: true,
    productionDeploy: true,
  },
};

export const PLAN_DETAILS: Record<PlanTier, PlanDetails> = {
  free: {
    name: 'Free',
    price: 0,
    credits: TIER_LIMITS.free.appGenerationsPerMonth,
    limits: TIER_LIMITS.free,
    features: [
      `${TIER_LIMITS.free.appGenerationsPerMonth} free app generations per month`,
      `${TIER_LIMITS.free.maxProjects} active projects`,
      'Frontend web apps',
      'Community support',
      'Preview before upgrading',
    ],
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    price: 29,
    credits: TIER_LIMITS.pro.appGenerationsPerMonth,
    limits: TIER_LIMITS.pro,
    features: [
      `${TIER_LIMITS.pro.appGenerationsPerMonth} app generations per month`,
      `${TIER_LIMITS.pro.maxProjects} active projects`,
      'Project-specific API keys',
      'Fullstack apps with backend, auth, databases, and uploads',
      'Priority support',
      'Publish to community',
      'Export source code',
      'Deploy to production',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    price: 99,
    credits: TIER_LIMITS.enterprise.appGenerationsPerMonth,
    limits: TIER_LIMITS.enterprise,
    features: [
      `${TIER_LIMITS.enterprise.appGenerationsPerMonth} app generations per month`,
      `${TIER_LIMITS.enterprise.maxProjects} active projects`,
      'Project-specific and reusable API keys',
      'All Pro features',
      'Dedicated support',
      'Custom AI training',
      'SLA guarantee',
      'Advanced analytics',
    ],
  },
};

export function normalizePlanTier(tier?: string | null): PlanTier {
  if (tier === 'pro' || tier === 'enterprise') return tier;
  return 'free';
}

export function getTierLimits(tier?: string | null): TierLimits {
  return TIER_LIMITS[normalizePlanTier(tier)];
}

export function getPlanDetails(tier?: string | null): PlanDetails {
  return PLAN_DETAILS[normalizePlanTier(tier)];
}

export function hasPaidEntitlement(
  tier?: string | null,
  role?: string | null
): boolean {
  if (role === 'admin' || role === 'superadmin') return true;
  return normalizePlanTier(tier) !== 'free';
}

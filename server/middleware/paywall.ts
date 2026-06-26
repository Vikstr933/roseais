import { NextFunction, Request, Response } from 'express';
import { and, eq, gte, sum } from 'drizzle-orm';
import { db } from '../../db';
import { userUsage } from '../../db/schema-pg';
import { getTierLimits, hasPaidEntitlement } from '../services/TierLimitsService';

export type PaidFeature =
  | 'production_deploy'
  | 'code_export'
  | 'public_project'
  | 'fullstack_generation'
  | 'generation_limit'
  | 'api_keys'
  | 'project_limit';

const FULLSTACK_TERMS = [
  'backend',
  'back end',
  'fullstack',
  'full stack',
  'server',
  'rest api',
  'graphql',
  'api service',
  'api endpoint',
  'api route',
  'database',
  'databas',
  'postgres',
  'mysql',
  'mongodb',
  'supabase',
  'auth',
  'login',
  'log in',
  'signin',
  'sign in',
  'register',
  'signup',
  'sign up',
  'user account',
  'users',
  'anvandare',
  'användare',
  'logga in',
  'registrera',
  'konto',
  'upload',
  'file upload',
  'image upload',
  'ladda upp',
  'bilder',
  'filer',
];

function isPaidUser(req: Request): boolean {
  return hasPaidEntitlement(req.user?.tier, req.user?.role);
}

function sendPaywallResponse(
  res: Response,
  feature: PaidFeature,
  message: string
) {
  return res.status(402).json({
    success: false,
    error: 'Upgrade required',
    message,
    upgradeRequired: true,
    requiredTier: 'pro',
    feature,
  });
}

function currentMonthStart(): string {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return monthStart.toISOString().split('T')[0];
}

export function promptNeedsPaidFullstack(prompt: string): boolean {
  const normalizedPrompt = prompt.toLowerCase();
  return FULLSTACK_TERMS.some(term => normalizedPrompt.includes(term));
}

export function requirePaidPlan(
  feature: PaidFeature,
  message = 'This feature requires a Pro plan.'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (isPaidUser(req)) return next();
    return sendPaywallResponse(res, feature, message);
  };
}

export function requirePaidPlanWhen(
  feature: PaidFeature,
  predicate: (req: Request) => boolean,
  message = 'This feature requires a Pro plan.'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!predicate(req) || isPaidUser(req)) return next();
    return sendPaywallResponse(res, feature, message);
  };
}

export function requirePaidForFullstackGeneration(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const prompt =
    typeof req.body?.prompt === 'string'
      ? req.body.prompt
      : typeof req.body?.userPrompt === 'string'
        ? req.body.userPrompt
        : '';

  if (!promptNeedsPaidFullstack(prompt) || isPaidUser(req)) {
    return next();
  }

  return sendPaywallResponse(
    res,
    'fullstack_generation',
    'Apps that need backend, auth, databases, or uploads require a Pro plan.'
  );
}

export function enforceFreeGenerationLimit(
  limit = getTierLimits('free').appGenerationsPerMonth
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (isPaidUser(req)) return next();

    try {
      const userId = req.user?.id;
      if (!userId) return next();

      const [usage] = await db
        .select({ totalRequests: sum(userUsage.aiRequests) })
        .from(userUsage)
        .where(
          and(
            eq(userUsage.userId, userId),
            gte(userUsage.date, currentMonthStart())
          )
        );

      const usedRequests = Number(usage?.totalRequests || 0);
      if (usedRequests < limit) return next();

      return sendPaywallResponse(
        res,
        'generation_limit',
        `Free accounts include ${limit} app generations per month. Upgrade to Pro to keep building.`
      );
    } catch (error) {
      console.error('Failed to check free generation limit:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to check usage limit',
      });
    }
  };
}

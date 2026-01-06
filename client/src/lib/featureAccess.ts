import { PLAN_LIMITS, PlanState, PlanTier } from '@/types/subscription';

export type FeatureKey = 'analyze' | 'adapt' | 'autoApply' | 'jobMatches' | 'tracker' | 'roiStats';

interface AccessResult {
  allowed: boolean;
  requiredTier?: PlanTier;
  reason?: string;
}

const limitExceeded = (current: number, limit: number) => limit !== -1 && current >= limit;

export function checkFeatureAccess(plan: PlanState, feature: FeatureKey): AccessResult {
  const limits = PLAN_LIMITS[plan.tier];

  switch (feature) {
    case 'analyze':
      if (limitExceeded(plan.usage.analyses, limits.monthlyAnalyses)) {
        return { allowed: false, requiredTier: plan.tier === 'free' ? 'basic' : 'pro', reason: 'Fler CV-analyser ingår i högre plan.' };
      }
      return { allowed: true };

    case 'adapt':
      if (limitExceeded(plan.usage.adaptations, limits.monthlyAdaptations)) {
        return { allowed: false, requiredTier: plan.tier === 'free' ? 'basic' : 'pro', reason: 'AI-anpassningar ingår i högre plan eller köp credits.' };
      }
      return { allowed: true };

    case 'jobMatches':
      if (limitExceeded(plan.usage.jobMatchesToday, limits.dailyJobMatches)) {
        return { allowed: false, requiredTier: plan.tier === 'free' ? 'basic' : 'pro', reason: 'Fler dagliga jobbmatchningar kräver uppgradering.' };
      }
      return { allowed: true };

    case 'tracker':
      if (limitExceeded(plan.usage.activeApplications, limits.maxActiveApplications)) {
        return { allowed: false, requiredTier: plan.tier === 'free' ? 'basic' : 'basic', reason: 'Fler loggade ansökningar kräver uppgradering.' };
      }
      return { allowed: true };

    case 'autoApply':
      if (!limits.autoApplyEnabled) {
        return { allowed: false, requiredTier: 'pro', reason: 'Auto-Apply ingår i Workme Pro.' };
      }
      return { allowed: true };

    case 'roiStats':
      if (!limits.roiStats) {
        return { allowed: false, requiredTier: 'basic', reason: 'Detaljerad ROI-statistik ingår i Workme Basic.' };
      }
      return { allowed: true };

    default:
      return { allowed: true };
  }
}


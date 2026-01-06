export type PlanTier = 'free' | 'basic' | 'pro';

export interface PlanLimits {
  maxCVs: number;
  monthlyAnalyses: number; // -1 means unlimited
  monthlyAdaptations: number; // -1 means unlimited
  maxActiveApplications: number; // -1 means unlimited
  dailyJobMatches: number; // -1 means unlimited
  autoApplyEnabled: boolean;
  roiStats: boolean;
}

export interface PlanUsage {
  analyses: number;
  adaptations: number;
  activeApplications: number;
  jobMatchesToday: number;
}

export interface PlanState {
  tier: PlanTier;
  usage: PlanUsage;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    maxCVs: 1,
    monthlyAnalyses: 2,
    monthlyAdaptations: 0,
    maxActiveApplications: 30,
    dailyJobMatches: 20,
    autoApplyEnabled: false,
    roiStats: false,
  },
  basic: {
    maxCVs: 3,
    monthlyAnalyses: 10,
    monthlyAdaptations: 20,
    maxActiveApplications: -1,
    dailyJobMatches: -1,
    autoApplyEnabled: false,
    roiStats: true,
  },
  pro: {
    maxCVs: 10,
    monthlyAnalyses: -1,
    monthlyAdaptations: -1,
    maxActiveApplications: -1,
    dailyJobMatches: -1,
    autoApplyEnabled: true,
    roiStats: true,
  },
};


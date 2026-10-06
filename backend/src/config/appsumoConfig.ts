/**
 * Centralized AppSumo Licensing Configuration
 * 
 * Provides:
 * - Credentials and base URLs for AppSumo Licensing API v2
 * - Configurable Tier-to-TaskNera quotas mapping
 * - Rate limiting constraints (20 requests per minute)
 */

export interface AppSumoTierConfig {
  tier: number;
  name: string;
  subscriptionPlan: string;
  billingCycle: string;
  maxUsers: number;
  maxRecruiters: number;
  maxActiveJobs: number;
  maxResumesPerMonth: number;
}

export const APPSUMO_CONFIG = {
  // AppSumo API credentials
  apiKey: process.env.APPSUMO_API_KEY || '',
  clientId: process.env.APPSUMO_CLIENT_ID || '',
  clientSecret: process.env.APPSUMO_CLIENT_SECRET || '',
  // HMAC verification secret: AppSumo Licensing Guide specifies using AppSumo API key as HMAC secret,
  // with APPSUMO_WEBHOOK_SECRET supported as an explicit override.
  webhookSecret: process.env.APPSUMO_WEBHOOK_SECRET || process.env.APPSUMO_API_KEY || '',
  
  // AppSumo API base URL
  apiBaseUrl: process.env.APPSUMO_API_BASE_URL || 'https://api.licensing.appsumo.com/v2/',
  
  // AppSumo API rate limit (20 req / minute)
  rateLimitPerMinute: 20,
  
  // Frontend redirection URL for OAuth onboarding
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // Central Tier Configurations
  tiers: {
    1: {
      tier: 1,
      name: 'AppSumo Tier 1 (Starter LTD)',
      subscriptionPlan: 'APPSUMO_TIER_1',
      billingCycle: 'lifetime',
      maxUsers: Number(process.env.APPSUMO_TIER_1_MAX_USERS) || 5,
      maxRecruiters: Number(process.env.APPSUMO_TIER_1_MAX_RECRUITERS) || 5,
      maxActiveJobs: Number(process.env.APPSUMO_TIER_1_MAX_ACTIVE_JOBS) || 25,
      maxResumesPerMonth: Number(process.env.APPSUMO_TIER_1_MAX_RESUMES) || 1000,
    },
    2: {
      tier: 2,
      name: 'AppSumo Tier 2 (Growth LTD)',
      subscriptionPlan: 'APPSUMO_TIER_2',
      billingCycle: 'lifetime',
      maxUsers: Number(process.env.APPSUMO_TIER_2_MAX_USERS) || 15,
      maxRecruiters: Number(process.env.APPSUMO_TIER_2_MAX_RECRUITERS) || 15,
      maxActiveJobs: Number(process.env.APPSUMO_TIER_2_MAX_ACTIVE_JOBS) || 75,
      maxResumesPerMonth: Number(process.env.APPSUMO_TIER_2_MAX_RESUMES) || 3000,
    },
    3: {
      tier: 3,
      name: 'AppSumo Tier 3 (Scale LTD)',
      subscriptionPlan: 'APPSUMO_TIER_3',
      billingCycle: 'lifetime',
      maxUsers: Number(process.env.APPSUMO_TIER_3_MAX_USERS) || 50,
      maxRecruiters: Number(process.env.APPSUMO_TIER_3_MAX_RECRUITERS) || 50,
      maxActiveJobs: Number(process.env.APPSUMO_TIER_3_MAX_ACTIVE_JOBS) || 250,
      maxResumesPerMonth: Number(process.env.APPSUMO_TIER_3_MAX_RESUMES) || 10000,
    }
  } as Record<number, AppSumoTierConfig>
};

/**
 * Resolve limits for a given tier number.
 * Gracefully handles custom/higher tiers (e.g. Tier 4+) by scaling incrementally.
 */
export function getAppSumoTierLimits(tier: number = 1): AppSumoTierConfig {
  const normalizedTier = Math.max(1, Math.floor(Number(tier) || 1));
  
  if (APPSUMO_CONFIG.tiers[normalizedTier]) {
    return APPSUMO_CONFIG.tiers[normalizedTier];
  }
  
  // For tiers > 3, scale dynamically from Tier 3
  const tier3 = APPSUMO_CONFIG.tiers[3] || {
    tier: 3,
    name: 'AppSumo Tier 3 (Scale LTD)',
    subscriptionPlan: 'APPSUMO_TIER_3',
    billingCycle: 'lifetime',
    maxUsers: 50,
    maxRecruiters: 50,
    maxActiveJobs: 250,
    maxResumesPerMonth: 10000
  };
  const multiplier = normalizedTier - 2;
  return {
    tier: normalizedTier,
    name: `AppSumo Tier ${normalizedTier} (Enterprise LTD)`,
    subscriptionPlan: `APPSUMO_TIER_${normalizedTier}`,
    billingCycle: 'lifetime',
    maxUsers: tier3.maxUsers * multiplier,
    maxRecruiters: tier3.maxRecruiters * multiplier,
    maxActiveJobs: tier3.maxActiveJobs * multiplier,
    maxResumesPerMonth: tier3.maxResumesPerMonth * multiplier,
  };
}

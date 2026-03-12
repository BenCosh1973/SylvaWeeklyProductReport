import type { FunnelStep, SubFunnelStep, SanityCheckResult, TrialUserProfile, PaidUserProfile } from '../types.js';

export interface SanityCheckInput {
  funnelTable: FunnelStep[];
  subFunnel: SubFunnelStep[];
  trialProfiles: Map<string, TrialUserProfile>;
  paidProfiles: Map<string, PaidUserProfile>;
  rcActiveSubs: number;
  events: { uxcamuserid: string }[];
  userFileUserIds: string[];
  sessions: { totalsessiontime: number; locationcountry?: string }[];
  chatDigestPss10: { before: number | null; after: number | null }[];
  chatDigestTests: { userId: string; testsCompleted: number; timestamp: string }[];
}

export function runSanityChecks(input: SanityCheckInput): SanityCheckResult[] {
  throw new Error('Not implemented');
}

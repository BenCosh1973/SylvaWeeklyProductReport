import type { BaselineMetrics, FunnelStep, DropoffCohort, TrialUserProfile, PaidUserProfile } from '../types.js';

export interface BaselineInput {
  weekEnding: string;
  funnelTable: FunnelStep[];
  dropoffs: DropoffCohort[];
  rcActiveSubs: number;
  rcMrr: number;
  rcNewCustomers: number;
  rcNewPaying: number;
  adjustW1Retention: number;
  chatSessions: number;
  chatUniqueUsers: number;
  trialProfiles: Map<string, TrialUserProfile>;
  paidProfiles: Map<string, PaidUserProfile>;
}

export function calculateBaselineMetrics(input: BaselineInput): BaselineMetrics {
  throw new Error('Not implemented');
}

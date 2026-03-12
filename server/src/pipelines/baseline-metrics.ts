import type { BaselineMetrics, FunnelStep, DropoffCohort, TrialUserProfile, PaidUserProfile } from '../types.js';
import { median } from '../utils/stats.js';

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

function profileMedian(profiles: Map<string, TrialUserProfile | PaidUserProfile>, extract: (p: TrialUserProfile | PaidUserProfile) => number): number {
  const values = [...profiles.values()].map(extract);
  return median(values) ?? 0;
}

export function calculateBaselineMetrics(input: BaselineInput): BaselineMetrics {
  const funnelCounts = input.funnelTable.map(s => s.usersReached);

  // Top dropoff
  let topDropoff = { label: 'none', count: 0 };
  for (const d of input.dropoffs) {
    if (d.count > topDropoff.count) {
      topDropoff = { label: d.stepLabel, count: d.count };
    }
  }

  const uxcamUsersTracked = funnelCounts[0] ?? 0;

  return {
    weekEnding: input.weekEnding,
    activeSubs: input.rcActiveSubs,
    mrr: input.rcMrr,
    newCustomers: input.rcNewCustomers,
    newPaying: input.rcNewPaying,
    w1Retention: input.adjustW1Retention,
    uxcamUsersTracked,
    funnelCounts,
    topDropoff,
    chatSessions: input.chatSessions,
    chatUniqueUsers: input.chatUniqueUsers,
    trialMedianSessions: profileMedian(input.trialProfiles, p => p.totalSessions),
    trialMedianMsgPerSession: profileMedian(input.trialProfiles, p => p.meanMsgCount),
    trialMedianDuration: profileMedian(input.trialProfiles, p => p.meanDurationMin),
    trialMedianTests: profileMedian(input.trialProfiles, p => p.testsCompleted),
    paidMedianSessions: profileMedian(input.paidProfiles, p => p.totalSessions),
    paidMedianMsgPerSession: profileMedian(input.paidProfiles, p => p.meanMsgCount),
    paidMedianDuration: profileMedian(input.paidProfiles, p => p.meanDurationMin),
    paidMedianTests: profileMedian(input.paidProfiles, p => p.testsCompleted),
  };
}

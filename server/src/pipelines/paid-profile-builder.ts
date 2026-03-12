import type { PaidUserProfile, EngagementComparison, TrialUserProfile } from '../types.js';
import type { ChatDigestRow } from './chat-digest-segmentation.js';
import { buildTrialProfile } from './trial-profile-builder.js';
import { median, firstNonNull } from '../utils/stats.js';

export function buildPaidProfile(
  userId: string,
  userChats: ChatDigestRow[],
  todayDate: Date
): PaidUserProfile {
  const base = buildTrialProfile(userId, userChats, todayDate, 7);

  const sorted = [...userChats].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const trialStartDate = firstNonNull(sorted.map(r => r.trialStartDate || null));
  const subscriptionStartDate = firstNonNull(sorted.map(r => r.subscriptionStartDate || null));

  let daysTrialToPaid: number | null = null;
  if (trialStartDate && subscriptionStartDate) {
    daysTrialToPaid = Math.round(
      (new Date(subscriptionStartDate).getTime() - new Date(trialStartDate).getTime()) / (24 * 60 * 60 * 1000)
    );
  }

  return {
    ...base,
    subscriptionStartDate,
    daysTrialToPaid,
  };
}

const METRICS: { name: string; extract: (p: TrialUserProfile) => number | null }[] = [
  { name: 'Sessions', extract: p => p.totalSessions },
  { name: 'Messages/session', extract: p => p.meanMsgCount },
  { name: 'Duration (min)/session', extract: p => p.meanDurationMin },
  { name: 'Tests completed', extract: p => p.testsCompleted },
  { name: 'CSAT', extract: p => p.meanCsat },
  { name: 'Days active', extract: p => p.daysActive },
  { name: 'PSS10 change', extract: p => p.pss10Change },
];

export function compareTrialVsPaid(
  trialProfiles: Map<string, TrialUserProfile>,
  paidProfiles: Map<string, PaidUserProfile>
): {
  comparison: EngagementComparison[];
  strongestPredictor: string;
  strongestGap: number;
} {
  const comparison: EngagementComparison[] = [];
  let strongestPredictor = 'none';
  let strongestGap = 0;

  for (const m of METRICS) {
    const trialValues = [...trialProfiles.values()].map(m.extract).filter((v): v is number => v !== null);
    const paidValues = [...paidProfiles.values()].map(m.extract).filter((v): v is number => v !== null);

    const trialMedian = median(trialValues);
    const paidMedian = median(paidValues);

    let gapRatio: number | null = null;
    if (trialMedian !== null && paidMedian !== null && trialMedian !== 0) {
      gapRatio = Math.abs(paidMedian / trialMedian);
    } else if (trialMedian === 0 && paidMedian !== null && paidMedian !== 0) {
      gapRatio = Infinity;
    }

    comparison.push({ metric: m.name, trialMedian, paidMedian, gapRatio });

    if (gapRatio !== null && gapRatio !== Infinity && gapRatio > strongestGap) {
      strongestGap = gapRatio;
      strongestPredictor = m.name;
    }
  }

  return { comparison, strongestPredictor, strongestGap };
}

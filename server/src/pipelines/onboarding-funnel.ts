import type { FunnelStep, DropoffCohort, UxcamEvent } from '../types.js';
import { ONBOARDING_FUNNEL_STEPS } from '../types.js';

export interface OnboardingFunnelResult {
  funnelTable: FunnelStep[];
  dropoffs: DropoffCohort[];
  userDeepestStep: Map<string, number>;
}

const STEP_EVENTS: string[] = ONBOARDING_FUNNEL_STEPS.map(s => s.event);

export function buildOnboardingFunnel(events: UxcamEvent[]): OnboardingFunnelResult {
  // Collect all unique user IDs
  const allUserIds = new Set<string>();
  for (const e of events) {
    allUserIds.add(e.uxcamuserid);
  }

  // For each user, find deepest funnel step reached
  const userDeepestStep = new Map<string, number>();
  for (const uid of allUserIds) {
    userDeepestStep.set(uid, 0); // 0 = no funnel engagement
  }

  for (const e of events) {
    const stepIdx = STEP_EVENTS.indexOf(e.eventname);
    if (stepIdx >= 0) {
      const stepNum = stepIdx + 1; // 1-indexed
      const current = userDeepestStep.get(e.uxcamuserid) ?? 0;
      if (stepNum > current) {
        userDeepestStep.set(e.uxcamuserid, stepNum);
      }
    }
  }

  const totalTracked = allUserIds.size;

  // Count users who reached at least step N (deepest >= N)
  const stepsReached: number[] = new Array(STEP_EVENTS.length).fill(0);
  for (const [, deepest] of userDeepestStep) {
    for (let s = 0; s < STEP_EVENTS.length; s++) {
      if (deepest >= s + 1) {
        stepsReached[s]++;
      }
    }
  }

  // Build funnel table
  const funnelTable: FunnelStep[] = [];

  // Row 0: total_tracked
  funnelTable.push({
    step: 'total_tracked',
    usersReached: totalTracked,
    droppedHere: totalTracked - (stepsReached[0] ?? 0),
    dropPct: totalTracked > 0 ? ((totalTracked - (stepsReached[0] ?? 0)) / totalTracked) * 100 : 0,
    conversionFromPrev: 100,
  });

  // Steps 1–7
  for (let i = 0; i < STEP_EVENTS.length; i++) {
    const reached = stepsReached[i];
    const nextReached = i + 1 < STEP_EVENTS.length ? stepsReached[i + 1] : 0;
    const prevReached = i === 0 ? totalTracked : stepsReached[i - 1];
    const dropped = reached - nextReached;

    funnelTable.push({
      step: STEP_EVENTS[i],
      usersReached: reached,
      droppedHere: i + 1 < STEP_EVENTS.length ? dropped : 0,
      dropPct: totalTracked > 0 ? (dropped / totalTracked) * 100 : 0,
      conversionFromPrev: prevReached > 0 ? (reached / prevReached) * 100 : 0,
    });
  }

  // Build dropoff cohorts: users whose deepest step = N (and N < max)
  const dropoffs: DropoffCohort[] = [];
  const maxStep = STEP_EVENTS.length;

  // Step 0 = no funnel engagement
  const noEngagement = [...userDeepestStep.entries()].filter(([, d]) => d === 0).map(([uid]) => uid);
  if (noEngagement.length > 0) {
    dropoffs.push({
      stepNum: 0,
      stepLabel: 'no_engagement',
      count: noEngagement.length,
      pctOfTotal: totalTracked > 0 ? (noEngagement.length / totalTracked) * 100 : 0,
      userIds: noEngagement,
    });
  }

  // Steps 1 through maxStep-1 (users who stopped at step N, didn't reach N+1)
  for (let s = 1; s < maxStep; s++) {
    const stoppedHere = [...userDeepestStep.entries()].filter(([, d]) => d === s).map(([uid]) => uid);
    if (stoppedHere.length > 0) {
      dropoffs.push({
        stepNum: s,
        stepLabel: STEP_EVENTS[s - 1],
        count: stoppedHere.length,
        pctOfTotal: totalTracked > 0 ? (stoppedHere.length / totalTracked) * 100 : 0,
        userIds: stoppedHere,
      });
    }
  }

  return { funnelTable, dropoffs, userDeepestStep };
}

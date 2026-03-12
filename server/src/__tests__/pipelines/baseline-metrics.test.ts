import { describe, it, expect } from 'vitest';
import { calculateBaselineMetrics } from '../../pipelines/baseline-metrics.js';
import type { BaselineInput } from '../../pipelines/baseline-metrics.js';
import type { FunnelStep, DropoffCohort, TrialUserProfile, PaidUserProfile } from '../../types.js';

function makeTrialProfile(overrides: Partial<TrialUserProfile> = {}): TrialUserProfile {
  return {
    userId: 't1', totalSessions: 4, firstChat: '', lastChat: '', daysActive: 3,
    trialStartDate: null, daysSinceTrialStart: null, trialLengthDays: 7,
    meanCsat: 3.4, meanMsgCount: 4, meanDurationMin: 1, totalMessages: 16,
    topics: [], testsCompleted: 1, testsNames: null,
    pss10Before: 29, pss10After: 21, pss10Change: -8,
    emotionsBefore: null, emotionsAfter: null, reliefVelocity: null,
    ...overrides,
  };
}

function makePaidProfile(overrides: Partial<PaidUserProfile> = {}): PaidUserProfile {
  return {
    ...makeTrialProfile(),
    userId: 'p1', totalSessions: 6, meanMsgCount: 6, meanDurationMin: 6,
    testsCompleted: 8,
    subscriptionStartDate: null, daysTrialToPaid: 7,
    ...overrides,
  };
}

function makeInput(overrides: Partial<BaselineInput> = {}): BaselineInput {
  return {
    weekEnding: '2026-03-09',
    funnelTable: [
      { step: 'total_tracked', usersReached: 130, droppedHere: 36, dropPct: 27.7, conversionFromPrev: 100 },
      { step: 'get_started_click', usersReached: 94, droppedHere: 17, dropPct: 13.1, conversionFromPrev: 72.3 },
      { step: 'trial_start', usersReached: 32, droppedHere: 0, dropPct: 0, conversionFromPrev: 100 },
    ],
    dropoffs: [
      { stepNum: 3, stepLabel: 'challenges → SMS_auth', count: 43, pctOfTotal: 33, userIds: [] },
      { stepNum: 2, stepLabel: 'name → challenges', count: 17, pctOfTotal: 13, userIds: [] },
    ],
    rcActiveSubs: 10,
    rcMrr: 90.24,
    rcNewCustomers: 134,
    rcNewPaying: 0,
    adjustW1Retention: 0.0,
    chatSessions: 143,
    chatUniqueUsers: 33,
    trialProfiles: new Map([
      ['t1', makeTrialProfile({ totalSessions: 4, meanMsgCount: 4, meanDurationMin: 1, testsCompleted: 1 })],
      ['t2', makeTrialProfile({ totalSessions: 3, meanMsgCount: 5, meanDurationMin: 2, testsCompleted: 2 })],
    ]),
    paidProfiles: new Map([
      ['p1', makePaidProfile({ totalSessions: 6, meanMsgCount: 6, meanDurationMin: 6, testsCompleted: 8 })],
      ['p2', makePaidProfile({ totalSessions: 7, meanMsgCount: 7, meanDurationMin: 5, testsCompleted: 10 })],
    ]),
    ...overrides,
  };
}

describe('Baseline Metrics Auto-Calculation', () => {
  // AC-PIPE-5: Baseline metrics are auto-stored after each analysis for the following week's reference

  it('calculates all required baseline fields', () => {
    const metrics = calculateBaselineMetrics(makeInput());

    expect(metrics.weekEnding).toBe('2026-03-09');
    expect(metrics.activeSubs).toBe(10);
    expect(metrics.mrr).toBe(90.24);
    expect(metrics.newCustomers).toBe(134);
    expect(metrics.newPaying).toBe(0);
    expect(metrics.w1Retention).toBe(0.0);
    expect(metrics.chatSessions).toBe(143);
    expect(metrics.chatUniqueUsers).toBe(33);
  });

  it('extracts funnel counts array', () => {
    const metrics = calculateBaselineMetrics(makeInput());
    expect(metrics.funnelCounts).toContain(130);
    expect(metrics.funnelCounts).toContain(94);
    expect(metrics.funnelCounts).toContain(32);
  });

  it('identifies top dropoff', () => {
    const metrics = calculateBaselineMetrics(makeInput());
    expect(metrics.topDropoff.count).toBe(43);
    expect(metrics.topDropoff.label).toContain('challenges');
  });

  it('calculates trial user medians', () => {
    const metrics = calculateBaselineMetrics(makeInput());
    // Median of [4, 3] sessions = 3.5
    expect(metrics.trialMedianSessions).toBeCloseTo(3.5, 0);
    // Median of [4, 5] msg/session = 4.5
    expect(metrics.trialMedianMsgPerSession).toBeCloseTo(4.5, 0);
    // Median of [1, 2] duration = 1.5
    expect(metrics.trialMedianDuration).toBeCloseTo(1.5, 0);
    // Median of [1, 2] tests = 1.5
    expect(metrics.trialMedianTests).toBeCloseTo(1.5, 0);
  });

  it('calculates paid user medians', () => {
    const metrics = calculateBaselineMetrics(makeInput());
    // Median of [6, 7] = 6.5
    expect(metrics.paidMedianSessions).toBeCloseTo(6.5, 0);
    // Median of [6, 7] = 6.5
    expect(metrics.paidMedianMsgPerSession).toBeCloseTo(6.5, 0);
    // Median of [6, 5] = 5.5
    expect(metrics.paidMedianDuration).toBeCloseTo(5.5, 0);
    // Median of [8, 10] = 9
    expect(metrics.paidMedianTests).toBeCloseTo(9, 0);
  });

  it('handles empty profile maps (returns 0 for medians)', () => {
    const metrics = calculateBaselineMetrics(makeInput({
      trialProfiles: new Map(),
      paidProfiles: new Map(),
    }));

    expect(metrics.trialMedianSessions).toBe(0);
    expect(metrics.paidMedianSessions).toBe(0);
  });

  it('selects the largest dropoff as topDropoff', () => {
    const metrics = calculateBaselineMetrics(makeInput({
      dropoffs: [
        { stepNum: 1, stepLabel: 'a → b', count: 10, pctOfTotal: 10, userIds: [] },
        { stepNum: 2, stepLabel: 'b → c', count: 50, pctOfTotal: 50, userIds: [] },
        { stepNum: 3, stepLabel: 'c → d', count: 5, pctOfTotal: 5, userIds: [] },
      ],
    }));

    expect(metrics.topDropoff.count).toBe(50);
    expect(metrics.topDropoff.label).toContain('b → c');
  });
});

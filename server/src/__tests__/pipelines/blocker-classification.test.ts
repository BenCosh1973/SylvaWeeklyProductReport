import { describe, it, expect } from 'vitest';
import { classifyConversionBlockers } from '../../pipelines/blocker-classification.js';
import type {
  TrialSegmentation, TrialUserProfile, PaidUserProfile,
  SubFunnelStep, ScreenMetrics, EngagementComparison,
} from '../../types.js';

function makeTrialProfile(overrides: Partial<TrialUserProfile> = {}): TrialUserProfile {
  return {
    userId: 't1', totalSessions: 2, firstChat: '', lastChat: '', daysActive: 2,
    trialStartDate: null, daysSinceTrialStart: null, trialLengthDays: 7,
    meanCsat: 3.4, meanMsgCount: 4, meanDurationMin: 1, totalMessages: 8,
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
    testsCompleted: 8, meanCsat: 4.0,
    subscriptionStartDate: null, daysTrialToPaid: 7,
    ...overrides,
  };
}

const defaultSegments: TrialSegmentation = {
  high_engagement_no_convert: ['t1', 't2'],
  moderate_fading: ['t3', 't4', 't5'],
  single_session: ['t6', 't7', 't8', 't9', 't10', 't11'],
  active_trial: ['t12'],
  expired_lapsed: ['t13', 't14', 't15', 't16', 't17', 't18', 't19', 't20'],
};

const defaultSubFunnel: SubFunnelStep[] = [
  { step: 'trial_start', uniqueUsers: 33, userIds: [], totalEvents: 33 },
  { step: 'subscription_pricing_viewed', uniqueUsers: 4, userIds: [], totalEvents: 5 },
  { step: 'subscription_plan_selected', uniqueUsers: 1, userIds: [], totalEvents: 1 },
  { step: 'subscription_purchase_started', uniqueUsers: 1, userIds: [], totalEvents: 1 },
  { step: 'subscription_payment_viewed', uniqueUsers: 1, userIds: [], totalEvents: 1 },
  { step: 'subscription_completed', uniqueUsers: 1, userIds: [], totalEvents: 1 },
  { step: 'subscription_started', uniqueUsers: 1, userIds: [], totalEvents: 1 },
];

const defaultScreenMetrics: ScreenMetrics[] = [
  { screenName: '/subscribe', totalSessions: 9, bounceRate: 0, medianEngagementTime: 2.4, totalRage: 0, totalExits: 3 },
  { screenName: '/chat', totalSessions: 120, bounceRate: 51.5, medianEngagementTime: 45, totalRage: 5, totalExits: 30 },
];

const defaultComparison: EngagementComparison[] = [
  { metric: 'Sessions', trialMedian: 2, paidMedian: 6, gapRatio: 3 },
  { metric: 'Messages/session', trialMedian: 4, paidMedian: 6, gapRatio: 1.5 },
  { metric: 'Duration (min)/session', trialMedian: 1, paidMedian: 6, gapRatio: 6 },
  { metric: 'Tests completed', trialMedian: 1, paidMedian: 8, gapRatio: 8 },
  { metric: 'CSAT', trialMedian: 3.4, paidMedian: 4.0, gapRatio: 1.18 },
];

describe('Conversion Blocker Classification', () => {
  it('identifies value delivery blocker when many single-session users', () => {
    const trialProfiles = new Map([['t1', makeTrialProfile()]]);
    const paidProfiles = new Map([['p1', makePaidProfile()]]);

    const blockers = classifyConversionBlockers(
      defaultSegments, trialProfiles, paidProfiles,
      defaultSubFunnel, defaultScreenMetrics, defaultComparison,
      'Tests completed', 8
    );

    const valueDelivery = blockers.filter(b => b.category === 'value_delivery');
    expect(valueDelivery.length).toBeGreaterThanOrEqual(1);
    // Single session users = 6 out of 20 total = 30% > 20% threshold
    expect(valueDelivery.some(b => b.title.toLowerCase().includes('session'))).toBe(true);
  });

  it('identifies value delivery blocker for test completion gap', () => {
    const trialProfiles = new Map([['t1', makeTrialProfile({ testsCompleted: 1 })]]);
    const paidProfiles = new Map([['p1', makePaidProfile({ testsCompleted: 8 })]]);

    const blockers = classifyConversionBlockers(
      defaultSegments, trialProfiles, paidProfiles,
      defaultSubFunnel, defaultScreenMetrics, defaultComparison,
      'Tests completed', 8
    );

    const testBlocker = blockers.find(b => b.title.toLowerCase().includes('test'));
    expect(testBlocker).toBeDefined();
    expect(testBlocker?.severity).toBe('HIGH');
  });

  it('identifies value awareness blocker when few users see pricing', () => {
    // 4/33 = 12% viewed pricing, below 15% threshold
    const trialProfiles = new Map([['t1', makeTrialProfile()]]);
    const paidProfiles = new Map([['p1', makePaidProfile()]]);

    const blockers = classifyConversionBlockers(
      defaultSegments, trialProfiles, paidProfiles,
      defaultSubFunnel, defaultScreenMetrics, defaultComparison,
      'Tests completed', 8
    );

    const awareness = blockers.filter(b => b.category === 'value_awareness');
    expect(awareness.length).toBeGreaterThanOrEqual(1);
  });

  it('identifies pricing/timing blocker when trial length too short', () => {
    // 8 expired out of 20 total = 40% > 30% threshold
    const trialProfiles = new Map([['t1', makeTrialProfile()]]);
    const paidProfiles = new Map([['p1', makePaidProfile()]]);

    const blockers = classifyConversionBlockers(
      defaultSegments, trialProfiles, paidProfiles,
      defaultSubFunnel, defaultScreenMetrics, defaultComparison,
      'Tests completed', 8
    );

    const timing = blockers.filter(b => b.category === 'pricing_timing');
    expect(timing.length).toBeGreaterThanOrEqual(1);
  });

  it('identifies trial expiration blocker', () => {
    // Create profiles for expired users with low days active
    const trialProfiles = new Map<string, TrialUserProfile>();
    for (const uid of defaultSegments.expired_lapsed) {
      trialProfiles.set(uid, makeTrialProfile({ userId: uid, daysActive: 1, daysSinceTrialStart: 10 }));
    }
    const paidProfiles = new Map([['p1', makePaidProfile()]]);

    const blockers = classifyConversionBlockers(
      defaultSegments, trialProfiles, paidProfiles,
      defaultSubFunnel, defaultScreenMetrics, defaultComparison,
      'Tests completed', 8
    );

    const expiration = blockers.filter(b => b.category === 'trial_expiration');
    expect(expiration.length).toBeGreaterThanOrEqual(1);
  });

  it('sorts blockers by severity (HIGH first)', () => {
    const trialProfiles = new Map<string, TrialUserProfile>();
    for (const uid of [...defaultSegments.expired_lapsed, ...defaultSegments.single_session]) {
      trialProfiles.set(uid, makeTrialProfile({ userId: uid, daysActive: 1, daysSinceTrialStart: 10 }));
    }
    const paidProfiles = new Map([['p1', makePaidProfile()]]);

    const blockers = classifyConversionBlockers(
      defaultSegments, trialProfiles, paidProfiles,
      defaultSubFunnel, defaultScreenMetrics, defaultComparison,
      'Tests completed', 8
    );

    // All HIGH blockers should come before MEDIUM
    const severities = blockers.map(b => b.severity);
    const firstMediumIdx = severities.indexOf('MEDIUM');
    const lastHighIdx = severities.lastIndexOf('HIGH');
    if (firstMediumIdx !== -1 && lastHighIdx !== -1) {
      expect(lastHighIdx).toBeLessThan(firstMediumIdx);
    }
  });

  it('each blocker has required fields', () => {
    const trialProfiles = new Map([['t1', makeTrialProfile()]]);
    const paidProfiles = new Map([['p1', makePaidProfile()]]);

    const blockers = classifyConversionBlockers(
      defaultSegments, trialProfiles, paidProfiles,
      defaultSubFunnel, defaultScreenMetrics, defaultComparison,
      'Tests completed', 8
    );

    blockers.forEach(b => {
      expect(b.category).toBeDefined();
      expect(b.title).toBeTruthy();
      expect(b.evidence).toBeTruthy();
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(b.severity);
    });
  });

  it('does not flag value awareness when pricing is well-exposed', () => {
    const wellExposedFunnel: SubFunnelStep[] = [
      { step: 'trial_start', uniqueUsers: 20, userIds: [], totalEvents: 20 },
      { step: 'subscription_pricing_viewed', uniqueUsers: 10, userIds: [], totalEvents: 12 }, // 50% > 15%
      { step: 'subscription_plan_selected', uniqueUsers: 5, userIds: [], totalEvents: 5 },
      { step: 'subscription_purchase_started', uniqueUsers: 3, userIds: [], totalEvents: 3 },
      { step: 'subscription_payment_viewed', uniqueUsers: 3, userIds: [], totalEvents: 3 },
      { step: 'subscription_completed', uniqueUsers: 2, userIds: [], totalEvents: 2 },
      { step: 'subscription_started', uniqueUsers: 2, userIds: [], totalEvents: 2 },
    ];

    const trialProfiles = new Map([['t1', makeTrialProfile()]]);
    const paidProfiles = new Map([['p1', makePaidProfile()]]);

    const blockers = classifyConversionBlockers(
      { ...defaultSegments, single_session: [], expired_lapsed: [] },
      trialProfiles, paidProfiles,
      wellExposedFunnel, defaultScreenMetrics, defaultComparison,
      'Tests completed', 8
    );

    const awareness = blockers.filter(b =>
      b.category === 'value_awareness' && b.title.includes('never see')
    );
    expect(awareness).toHaveLength(0);
  });
});

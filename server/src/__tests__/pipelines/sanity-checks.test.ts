import { describe, it, expect } from 'vitest';
import { runSanityChecks } from '../../pipelines/sanity-checks.js';
import type { SanityCheckInput } from '../../pipelines/sanity-checks.js';
import type { FunnelStep, SubFunnelStep } from '../../types.js';

function makeInput(overrides: Partial<SanityCheckInput> = {}): SanityCheckInput {
  return {
    funnelTable: [
      { step: 'total_tracked', usersReached: 130, droppedHere: 36, dropPct: 27.7, conversionFromPrev: 100 },
      { step: 'get_started_click', usersReached: 94, droppedHere: 17, dropPct: 13.1, conversionFromPrev: 72.3 },
      { step: 'onboarding_user_step_name', usersReached: 78, droppedHere: 0, dropPct: 0, conversionFromPrev: 83 },
      { step: 'onboarding_user_step_challenges', usersReached: 78, droppedHere: 43, dropPct: 33.1, conversionFromPrev: 100 },
      { step: 'signup_sms_auth_viewed', usersReached: 40, droppedHere: 3, dropPct: 2.3, conversionFromPrev: 51.3 },
      { step: 'signup_sms_pin_entered', usersReached: 37, droppedHere: 5, dropPct: 3.8, conversionFromPrev: 92.5 },
      { step: 'signup_complete', usersReached: 32, droppedHere: 0, dropPct: 0, conversionFromPrev: 86.5 },
      { step: 'trial_start', usersReached: 32, droppedHere: 0, dropPct: 0, conversionFromPrev: 100 },
    ],
    subFunnel: [
      { step: 'trial_start', uniqueUsers: 33, userIds: [], totalEvents: 33 },
      { step: 'subscription_pricing_viewed', uniqueUsers: 4, userIds: [], totalEvents: 5 },
      { step: 'subscription_plan_selected', uniqueUsers: 1, userIds: [], totalEvents: 1 },
      { step: 'subscription_purchase_started', uniqueUsers: 1, userIds: [], totalEvents: 1 },
      { step: 'subscription_payment_viewed', uniqueUsers: 1, userIds: [], totalEvents: 1 },
      { step: 'subscription_completed', uniqueUsers: 1, userIds: [], totalEvents: 1 },
      { step: 'subscription_started', uniqueUsers: 1, userIds: [], totalEvents: 1 },
    ],
    trialProfiles: new Map(),
    paidProfiles: new Map(),
    rcActiveSubs: 10,
    events: Array.from({ length: 130 }, (_, i) => ({ uxcamuserid: `u${i}` })),
    userFileUserIds: Array.from({ length: 120 }, (_, i) => `u${i}`),
    sessions: Array.from({ length: 200 }, () => ({ totalsessiontime: 120, locationcountry: 'United Kingdom' })),
    chatDigestPss10: [{ before: 28, after: 20 }, { before: 32, after: 25 }],
    chatDigestTests: [
      { userId: 'u1', testsCompleted: 1, timestamp: '2026-03-01' },
      { userId: 'u1', testsCompleted: 3, timestamp: '2026-03-03' },
    ],
    ...overrides,
  };
}

describe('Sanity Checks', () => {
  // AC-SAN-1: Sanity check results are stored with the weekly report

  it('passes all checks for valid data', () => {
    const results = runSanityChecks(makeInput());
    const fails = results.filter(r => r.level === 'FAIL');
    expect(fails).toHaveLength(0);
  });

  it('FAIL: detects funnel monotonicity violation', () => {
    const badFunnel: FunnelStep[] = [
      { step: 'total_tracked', usersReached: 100, droppedHere: 0, dropPct: 0, conversionFromPrev: 100 },
      { step: 'get_started_click', usersReached: 80, droppedHere: 0, dropPct: 0, conversionFromPrev: 80 },
      { step: 'onboarding_user_step_name', usersReached: 90, droppedHere: 0, dropPct: 0, conversionFromPrev: 112 }, // VIOLATION: 90 > 80
    ];

    const results = runSanityChecks(makeInput({ funnelTable: badFunnel }));
    const monotonicity = results.find(r => r.check === 'funnel_monotonicity');
    expect(monotonicity?.level).toBe('FAIL');
  });

  it('FAIL: detects subscription funnel monotonicity violation', () => {
    const badSubFunnel: SubFunnelStep[] = [
      { step: 'trial_start', uniqueUsers: 10, userIds: [], totalEvents: 10 },
      { step: 'subscription_pricing_viewed', uniqueUsers: 15, userIds: [], totalEvents: 15 }, // VIOLATION
    ];

    const results = runSanityChecks(makeInput({ subFunnel: badSubFunnel }));
    const check = results.find(r => r.check === 'sub_funnel_monotonicity');
    expect(check?.level).toBe('FAIL');
  });

  it('WARN: flags when many event users missing from user file', () => {
    // 130 event users but only 50 in user file = 61% missing > 20% threshold
    const results = runSanityChecks(makeInput({
      userFileUserIds: Array.from({ length: 50 }, (_, i) => `u${i}`),
    }));

    const check = results.find(r => r.check === 'user_id_coverage');
    expect(check?.level).toBe('WARN');
  });

  it('FAIL: detects negative session times', () => {
    const results = runSanityChecks(makeInput({
      sessions: [{ totalsessiontime: -5, locationcountry: 'United Kingdom' }],
    }));

    const check = results.find(r => r.check === 'session_time_plausibility');
    expect(check?.level).toBe('FAIL');
  });

  it('WARN: flags sessions longer than 24 hours', () => {
    const results = runSanityChecks(makeInput({
      sessions: [
        { totalsessiontime: 100000, locationcountry: 'United Kingdom' }, // >86400
        ...Array.from({ length: 100 }, () => ({ totalsessiontime: 120, locationcountry: 'United Kingdom' })),
      ],
    }));

    const check = results.find(r => r.check === 'session_time_plausibility');
    expect(check?.level).toBe('WARN');
  });

  it('WARN: flags when UK traffic is below 80%', () => {
    const sessions = [
      ...Array.from({ length: 60 }, () => ({ totalsessiontime: 120, locationcountry: 'United Kingdom' })),
      ...Array.from({ length: 40 }, () => ({ totalsessiontime: 120, locationcountry: 'Myanmar' })),
    ];

    const results = runSanityChecks(makeInput({ sessions }));
    const check = results.find(r => r.check === 'geography');
    expect(check?.level).toBe('WARN');
  });

  it('PASS: geography check passes when UK is 97%', () => {
    const sessions = [
      ...Array.from({ length: 97 }, () => ({ totalsessiontime: 120, locationcountry: 'United Kingdom' })),
      ...Array.from({ length: 3 }, () => ({ totalsessiontime: 120, locationcountry: 'Australia' })),
    ];

    const results = runSanityChecks(makeInput({ sessions }));
    const check = results.find(r => r.check === 'geography');
    expect(check?.level).toBe('PASS');
  });

  it('WARN: flags large discrepancy between RC active subs and chat digest active users', () => {
    const paidProfiles = new Map([
      ['p1', {} as any], ['p2', {} as any], ['p3', {} as any],
    ]);
    // RC says 10 active subs but only 3 in chat digests — |10-3| > 50% of max(10,3)
    const results = runSanityChecks(makeInput({ rcActiveSubs: 10, paidProfiles }));
    const check = results.find(r => r.check === 'rc_active_subs_crosscheck');
    expect(check?.level).toBe('WARN');
  });

  it('WARN: flags PSS10 scores outside 0-40 range', () => {
    const results = runSanityChecks(makeInput({
      chatDigestPss10: [{ before: 45, after: 20 }], // 45 > 40
    }));

    const check = results.find(r => r.check === 'pss10_range');
    expect(check?.level).toBe('WARN');
  });

  it('WARN: flags non-monotonic test completion per user', () => {
    const results = runSanityChecks(makeInput({
      chatDigestTests: [
        { userId: 'u1', testsCompleted: 5, timestamp: '2026-03-01' },
        { userId: 'u1', testsCompleted: 3, timestamp: '2026-03-03' }, // decreased!
      ],
    }));

    const check = results.find(r => r.check === 'tests_monotonic');
    expect(check?.level).toBe('WARN');
  });

  it('returns results with required fields', () => {
    const results = runSanityChecks(makeInput());
    results.forEach(r => {
      expect(r.check).toBeTruthy();
      expect(['PASS', 'WARN', 'FAIL']).toContain(r.level);
      expect(r.message).toBeTruthy();
    });
  });

  it('includes the no-fabrication reminder', () => {
    const results = runSanityChecks(makeInput());
    const reminder = results.find(r => r.check === 'no_fabrication');
    expect(reminder).toBeDefined();
  });
});

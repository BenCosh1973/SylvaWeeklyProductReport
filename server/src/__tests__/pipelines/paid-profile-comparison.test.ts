import { describe, it, expect } from 'vitest';
import { buildPaidProfile, compareTrialVsPaid } from '../../pipelines/paid-profile-builder.js';
import type { TrialUserProfile, PaidUserProfile } from '../../types.js';
import type { ChatDigestRow } from '../../pipelines/chat-digest-segmentation.js';

function makeRow(overrides: Partial<ChatDigestRow>): ChatDigestRow {
  return {
    userId: 'paid1',
    timestamp: '2026-03-05T10:00:00Z',
    subscriptionStatus: 'active',
    csat: 4,
    messageCount: 6,
    durationMin: 6,
    topic: 'co-parenting',
    emotionsBefore: "['stressed']",
    emotionsAfter: "['heard']",
    pss10Before: 26,
    pss10After: 19,
    reliefVelocity: 'fast',
    testsCompletedCount: 8,
    testsCompletedNames: 'PSS-10, SDQ, KIDSCREEN',
    strategies: 'co-regulation, advocacy',
    sessionCount: 6,
    trialStartDate: '2026-02-01',
    subscriptionStartDate: '2026-02-08',
    model: 'Hazel',
    totalCost: 0.12,
    kidscreen27Score: 75,
    ...overrides,
  };
}

const TODAY = new Date('2026-03-09T12:00:00Z');

describe('Paid User Profile Builder', () => {
  describe('buildPaidProfile', () => {
    it('calculates days from trial to paid conversion', () => {
      const chats = [
        makeRow({ trialStartDate: '2026-02-01', subscriptionStartDate: '2026-02-08' }),
      ];

      const profile = buildPaidProfile('paid1', chats, TODAY);
      expect(profile.daysTrialToPaid).toBe(7);
    });

    it('returns null daysTrialToPaid when dates are missing', () => {
      const chats = [
        makeRow({ trialStartDate: '', subscriptionStartDate: '' }),
      ];

      const profile = buildPaidProfile('paid1', chats, TODAY);
      expect(profile.daysTrialToPaid).toBeNull();
    });

    it('includes all TrialUserProfile fields', () => {
      const chats = [
        makeRow({ messageCount: 8, durationMin: 7, csat: 5 }),
        makeRow({ messageCount: 6, durationMin: 5, csat: 4 }),
      ];

      const profile = buildPaidProfile('paid1', chats, TODAY);
      expect(profile.totalSessions).toBe(2);
      expect(profile.meanMsgCount).toBeCloseTo(7, 0);
      expect(profile.meanDurationMin).toBeCloseTo(6, 0);
      expect(profile.meanCsat).toBeCloseTo(4.5, 1);
    });
  });

  describe('compareTrialVsPaid', () => {
    function makeTrialProfile(overrides: Partial<TrialUserProfile>): TrialUserProfile {
      return {
        userId: 't1', totalSessions: 2, firstChat: '', lastChat: '', daysActive: 2,
        trialStartDate: null, daysSinceTrialStart: null, trialLengthDays: 7,
        meanCsat: 3.4, meanMsgCount: 4, meanDurationMin: 1, totalMessages: 8,
        topics: ['anxiety'], testsCompleted: 1, testsNames: 'PSS-10',
        pss10Before: 29, pss10After: 21, pss10Change: -8,
        emotionsBefore: 'overwhelmed', emotionsAfter: 'supported', reliefVelocity: 'moderate',
        ...overrides,
      };
    }

    function makePaidProfileData(overrides: Partial<PaidUserProfile>): PaidUserProfile {
      return {
        userId: 'p1', totalSessions: 6, firstChat: '', lastChat: '', daysActive: 14,
        trialStartDate: null, daysSinceTrialStart: null, trialLengthDays: 7,
        meanCsat: 4.0, meanMsgCount: 6, meanDurationMin: 6, totalMessages: 36,
        topics: ['co-parenting'], testsCompleted: 8, testsNames: 'PSS-10, SDQ',
        pss10Before: 26, pss10After: 19, pss10Change: -7,
        emotionsBefore: 'stressed', emotionsAfter: 'heard', reliefVelocity: 'fast',
        subscriptionStartDate: '2026-02-08', daysTrialToPaid: 7,
        ...overrides,
      };
    }

    it('compares all key metrics between trial and paid', () => {
      const trialProfiles = new Map([
        ['t1', makeTrialProfile({ testsCompleted: 1, meanMsgCount: 4, meanDurationMin: 1 })],
        ['t2', makeTrialProfile({ testsCompleted: 2, meanMsgCount: 3, meanDurationMin: 2 })],
      ]);

      const paidProfiles = new Map([
        ['p1', makePaidProfileData({ testsCompleted: 8, meanMsgCount: 6, meanDurationMin: 6 })],
        ['p2', makePaidProfileData({ testsCompleted: 10, meanMsgCount: 7, meanDurationMin: 5 })],
      ]);

      const { comparison, strongestPredictor, strongestGap } = compareTrialVsPaid(trialProfiles, paidProfiles);

      // Should have entries for sessions, messages/session, duration, CSAT, tests, PSS10, days active
      expect(comparison.length).toBeGreaterThanOrEqual(5);

      // Tests completed: trial median ~1.5, paid median ~9 → gap ~6x
      const testsRow = comparison.find(c => c.metric.toLowerCase().includes('test'));
      expect(testsRow).toBeDefined();
      expect(testsRow!.gapRatio).toBeGreaterThan(4);
    });

    it('identifies strongest predictor (largest gap ratio)', () => {
      const trialProfiles = new Map([
        ['t1', makeTrialProfile({ testsCompleted: 1, meanDurationMin: 1 })],
      ]);
      const paidProfiles = new Map([
        ['p1', makePaidProfileData({ testsCompleted: 8, meanDurationMin: 6 })],
      ]);

      const { strongestPredictor, strongestGap } = compareTrialVsPaid(trialProfiles, paidProfiles);

      // Tests: 8x gap, Duration: 6x gap → tests should be strongest
      expect(strongestPredictor.toLowerCase()).toContain('test');
      expect(strongestGap).toBeGreaterThanOrEqual(8);
    });

    it('handles empty profile maps', () => {
      const result = compareTrialVsPaid(new Map(), new Map());
      expect(result.comparison).toBeDefined();
      // All medians should be null
      result.comparison.forEach(c => {
        expect(c.trialMedian).toBeNull();
        expect(c.paidMedian).toBeNull();
      });
    });

    it('handles zero values in trial metrics without division by zero', () => {
      const trialProfiles = new Map([
        ['t1', makeTrialProfile({ testsCompleted: 0 })],
      ]);
      const paidProfiles = new Map([
        ['p1', makePaidProfileData({ testsCompleted: 8 })],
      ]);

      const { comparison } = compareTrialVsPaid(trialProfiles, paidProfiles);
      const testsRow = comparison.find(c => c.metric.toLowerCase().includes('test'));
      // Gap ratio should be null or Infinity — not a crash
      expect(testsRow).toBeDefined();
    });
  });
});

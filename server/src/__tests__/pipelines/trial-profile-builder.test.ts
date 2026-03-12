import { describe, it, expect } from 'vitest';
import { buildTrialProfile, segmentTrialUsers } from '../../pipelines/trial-profile-builder.js';
import type { ChatDigestRow } from '../../pipelines/chat-digest-segmentation.js';
import type { TrialUserProfile } from '../../types.js';

function makeRow(overrides: Partial<ChatDigestRow>): ChatDigestRow {
  return {
    userId: 'u1',
    timestamp: '2026-03-05T10:00:00Z',
    subscriptionStatus: 'trial',
    csat: 4,
    messageCount: 6,
    durationMin: 5,
    topic: 'anxiety',
    emotionsBefore: "['overwhelmed']",
    emotionsAfter: "['supported']",
    pss10Before: 30,
    pss10After: 22,
    reliefVelocity: 'moderate',
    testsCompletedCount: 2,
    testsCompletedNames: 'PSS-10, SDQ',
    strategies: 'breathing, grounding',
    sessionCount: 3,
    trialStartDate: '2026-03-01',
    subscriptionStartDate: '',
    model: 'Hazel',
    totalCost: 0.05,
    kidscreen27Score: null,
    ...overrides,
  };
}

const TODAY = new Date('2026-03-09T12:00:00Z');

describe('Trial User Profile Builder', () => {
  describe('buildTrialProfile', () => {
    it('calculates basic engagement metrics', () => {
      const chats = [
        makeRow({ timestamp: '2026-03-01T10:00:00Z', messageCount: 4, durationMin: 2, csat: 3 }),
        makeRow({ timestamp: '2026-03-03T10:00:00Z', messageCount: 6, durationMin: 5, csat: 4 }),
        makeRow({ timestamp: '2026-03-05T10:00:00Z', messageCount: 8, durationMin: 8, csat: 5 }),
      ];

      const profile = buildTrialProfile('u1', chats, TODAY, 7);

      expect(profile.userId).toBe('u1');
      expect(profile.totalSessions).toBe(3);
      expect(profile.meanMsgCount).toBeCloseTo(6, 0); // (4+6+8)/3
      expect(profile.meanDurationMin).toBeCloseTo(5, 0); // (2+5+8)/3
      expect(profile.meanCsat).toBeCloseTo(4, 0); // (3+4+5)/3
      expect(profile.totalMessages).toBe(18); // 4+6+8
    });

    it('calculates days active from first to last chat', () => {
      const chats = [
        makeRow({ timestamp: '2026-03-01T10:00:00Z' }),
        makeRow({ timestamp: '2026-03-05T10:00:00Z' }),
      ];

      const profile = buildTrialProfile('u1', chats, TODAY, 7);
      expect(profile.daysActive).toBe(4); // Mar 1 to Mar 5
    });

    it('calculates days since trial start', () => {
      const chats = [
        makeRow({ trialStartDate: '2026-03-01' }),
      ];

      const profile = buildTrialProfile('u1', chats, TODAY, 7);
      expect(profile.daysSinceTrialStart).toBe(8); // Mar 1 to Mar 9
      expect(profile.trialLengthDays).toBe(7);
    });

    it('uses provided trial length days', () => {
      const chats = [makeRow({})];
      const profile = buildTrialProfile('u1', chats, TODAY, 30);
      expect(profile.trialLengthDays).toBe(30);
    });

    it('defaults trial length to 7 when not specified', () => {
      const chats = [makeRow({})];
      const profile = buildTrialProfile('u1', chats, TODAY, 7);
      expect(profile.trialLengthDays).toBe(7);
    });

    it('takes max tests completed count (cumulative field)', () => {
      const chats = [
        makeRow({ testsCompletedCount: 1, timestamp: '2026-03-01T10:00:00Z' }),
        makeRow({ testsCompletedCount: 3, timestamp: '2026-03-03T10:00:00Z' }),
        makeRow({ testsCompletedCount: 5, timestamp: '2026-03-05T10:00:00Z' }),
      ];

      const profile = buildTrialProfile('u1', chats, TODAY, 7);
      expect(profile.testsCompleted).toBe(5);
    });

    it('calculates PSS10 change (first before, last after)', () => {
      const chats = [
        makeRow({ pss10Before: 30, pss10After: 25, timestamp: '2026-03-01T10:00:00Z' }),
        makeRow({ pss10Before: 28, pss10After: 20, timestamp: '2026-03-05T10:00:00Z' }),
      ];

      const profile = buildTrialProfile('u1', chats, TODAY, 7);
      expect(profile.pss10Before).toBe(30); // first non-null before
      expect(profile.pss10After).toBe(20);  // last non-null after
      expect(profile.pss10Change).toBe(-10); // 20 - 30 = -10 (improvement)
    });

    it('handles null PSS10 values gracefully', () => {
      const chats = [
        makeRow({ pss10Before: null, pss10After: null }),
      ];

      const profile = buildTrialProfile('u1', chats, TODAY, 7);
      expect(profile.pss10Before).toBeNull();
      expect(profile.pss10After).toBeNull();
      expect(profile.pss10Change).toBeNull();
    });

    it('collects unique topics', () => {
      const chats = [
        makeRow({ topic: 'anxiety' }),
        makeRow({ topic: 'sleep' }),
        makeRow({ topic: 'anxiety' }), // duplicate
      ];

      const profile = buildTrialProfile('u1', chats, TODAY, 7);
      expect(profile.topics).toContain('anxiety');
      expect(profile.topics).toContain('sleep');
      expect(profile.topics).toHaveLength(2);
    });

    it('handles CSAT of 0 (excludes from mean)', () => {
      const chats = [
        makeRow({ csat: 0 }), // no rating
        makeRow({ csat: 4 }),
        makeRow({ csat: 5 }),
      ];

      const profile = buildTrialProfile('u1', chats, TODAY, 7);
      // Mean of 4 and 5 (excluding 0) = 4.5
      expect(profile.meanCsat).toBeCloseTo(4.5, 1);
    });

    it('returns null meanCsat when all CSATs are 0 or null', () => {
      const chats = [
        makeRow({ csat: 0 }),
        makeRow({ csat: null }),
      ];

      const profile = buildTrialProfile('u1', chats, TODAY, 7);
      expect(profile.meanCsat).toBeNull();
    });
  });

  describe('segmentTrialUsers', () => {
    function makeProfile(overrides: Partial<TrialUserProfile>): TrialUserProfile {
      return {
        userId: 'u1',
        totalSessions: 3,
        firstChat: '2026-03-01T10:00:00Z',
        lastChat: '2026-03-07T10:00:00Z',
        daysActive: 6,
        trialStartDate: '2026-03-01',
        daysSinceTrialStart: 8,
        trialLengthDays: 7,
        meanCsat: 3.5,
        meanMsgCount: 5,
        meanDurationMin: 3,
        totalMessages: 15,
        topics: ['anxiety'],
        testsCompleted: 2,
        testsNames: 'PSS-10',
        pss10Before: 28,
        pss10After: 22,
        pss10Change: -6,
        emotionsBefore: 'overwhelmed',
        emotionsAfter: 'supported',
        reliefVelocity: 'moderate',
        ...overrides,
      };
    }

    it('classifies high-engagement no-convert users', () => {
      const profiles = new Map<string, TrialUserProfile>([
        ['u1', makeProfile({
          userId: 'u1',
          totalSessions: 8,
          daysActive: 5,
          daysSinceTrialStart: 10,
          trialLengthDays: 7,
          lastChat: '2026-03-07T10:00:00Z',
        })],
      ]);

      const segments = segmentTrialUsers(profiles, TODAY);
      // 5+ sessions, 3+ days active, trial expired → high_engagement_no_convert
      // But trial is expired, so could also be expired_lapsed
      // The spec says: check expired first, then high-engagement
      // Actually re-reading spec: high_engagement_no_convert = "5+ chat sessions, 3+ days active, still trial"
      // If trial expired, they go to expired_lapsed instead
      expect(segments.expired_lapsed).toContain('u1');
    });

    it('classifies high-engagement user still in trial', () => {
      const profiles = new Map<string, TrialUserProfile>([
        ['u1', makeProfile({
          userId: 'u1',
          totalSessions: 6,
          daysActive: 4,
          daysSinceTrialStart: 5, // still within 7-day trial
          trialLengthDays: 7,
          lastChat: '2026-03-08T10:00:00Z', // recent
        })],
      ]);

      const segments = segmentTrialUsers(profiles, TODAY);
      expect(segments.high_engagement_no_convert).toContain('u1');
    });

    it('classifies moderate fading users', () => {
      const profiles = new Map<string, TrialUserProfile>([
        ['u1', makeProfile({
          userId: 'u1',
          totalSessions: 3,
          daysActive: 2,
          daysSinceTrialStart: 5,
          trialLengthDays: 7,
          lastChat: '2026-03-04T10:00:00Z', // 5 days ago, >3 days
        })],
      ]);

      const segments = segmentTrialUsers(profiles, TODAY);
      expect(segments.moderate_fading).toContain('u1');
    });

    it('classifies single-session users', () => {
      const profiles = new Map<string, TrialUserProfile>([
        ['u1', makeProfile({
          userId: 'u1',
          totalSessions: 1,
          daysActive: 0,
          daysSinceTrialStart: 3,
          trialLengthDays: 7,
        })],
      ]);

      const segments = segmentTrialUsers(profiles, TODAY);
      expect(segments.single_session).toContain('u1');
    });

    it('classifies active trial users (chat within last 48h)', () => {
      const profiles = new Map<string, TrialUserProfile>([
        ['u1', makeProfile({
          userId: 'u1',
          totalSessions: 2,
          daysActive: 1,
          daysSinceTrialStart: 2,
          trialLengthDays: 7,
          lastChat: '2026-03-08T10:00:00Z', // within 48h of TODAY
        })],
      ]);

      const segments = segmentTrialUsers(profiles, TODAY);
      expect(segments.active_trial).toContain('u1');
    });

    it('classifies expired/lapsed trial users', () => {
      const profiles = new Map<string, TrialUserProfile>([
        ['u1', makeProfile({
          userId: 'u1',
          totalSessions: 2,
          daysSinceTrialStart: 10, // 7-day trial expired 3 days ago
          trialLengthDays: 7,
          lastChat: '2026-03-02T10:00:00Z',
        })],
      ]);

      const segments = segmentTrialUsers(profiles, TODAY);
      expect(segments.expired_lapsed).toContain('u1');
    });

    it('handles 30-day trial correctly (not expired at day 10)', () => {
      const profiles = new Map<string, TrialUserProfile>([
        ['u1', makeProfile({
          userId: 'u1',
          totalSessions: 3,
          daysSinceTrialStart: 10,
          trialLengthDays: 30, // 30-day trial
          lastChat: '2026-03-08T10:00:00Z',
        })],
      ]);

      const segments = segmentTrialUsers(profiles, TODAY);
      // Not expired (day 10 of 30), active recently → active_trial
      expect(segments.expired_lapsed).not.toContain('u1');
    });

    it('handles 90-day trial correctly', () => {
      const profiles = new Map<string, TrialUserProfile>([
        ['u1', makeProfile({
          userId: 'u1',
          totalSessions: 4,
          daysSinceTrialStart: 50,
          trialLengthDays: 90,
          lastChat: '2026-03-04T10:00:00Z', // 5 days ago
        })],
      ]);

      const segments = segmentTrialUsers(profiles, TODAY);
      // Not expired (day 50 of 90), but fading (last chat 5 days ago)
      expect(segments.moderate_fading).toContain('u1');
    });

    it('each user appears in exactly one segment', () => {
      const profiles = new Map<string, TrialUserProfile>();
      for (let i = 0; i < 20; i++) {
        profiles.set(`u${i}`, makeProfile({
          userId: `u${i}`,
          totalSessions: Math.ceil(Math.random() * 10),
          daysActive: Math.floor(Math.random() * 14),
          daysSinceTrialStart: Math.floor(Math.random() * 20),
          trialLengthDays: [7, 30, 90][Math.floor(Math.random() * 3)],
          lastChat: new Date(Date.now() - Math.random() * 14 * 86400000).toISOString(),
        }));
      }

      const segments = segmentTrialUsers(profiles, TODAY);
      const allSegmented = [
        ...segments.high_engagement_no_convert,
        ...segments.moderate_fading,
        ...segments.single_session,
        ...segments.active_trial,
        ...segments.expired_lapsed,
      ];

      // No duplicates
      expect(new Set(allSegmented).size).toBe(allSegmented.length);
      // All users accounted for
      expect(allSegmented.length).toBe(profiles.size);
    });
  });
});

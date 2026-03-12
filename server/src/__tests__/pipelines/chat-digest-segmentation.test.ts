import { describe, it, expect } from 'vitest';
import { segmentChatUsers, normalizeSubscriptionStatus } from '../../pipelines/chat-digest-segmentation.js';
import type { ChatDigestRow } from '../../pipelines/chat-digest-segmentation.js';

function makeRow(overrides: Partial<ChatDigestRow>): ChatDigestRow {
  return {
    userId: 'user-1',
    timestamp: '2026-03-05T10:00:00Z',
    subscriptionStatus: 'trial',
    csat: 3,
    messageCount: 5,
    durationMin: 3,
    topic: 'anxiety',
    emotionsBefore: "['overwhelmed']",
    emotionsAfter: "['supported']",
    pss10Before: 28,
    pss10After: 22,
    reliefVelocity: 'moderate',
    testsCompletedCount: 1,
    testsCompletedNames: 'PSS-10',
    strategies: 'breathing',
    sessionCount: 3,
    trialStartDate: '2026-03-01',
    subscriptionStartDate: '',
    model: 'Hazel',
    totalCost: 0.05,
    kidscreen27Score: null,
    ...overrides,
  };
}

describe('Chat Digest User Segmentation', () => {
  describe('normalizeSubscriptionStatus', () => {
    it('normalizes "trial" status', () => {
      expect(normalizeSubscriptionStatus('trial')).toBe('trial');
    });

    it('normalizes "active" status', () => {
      expect(normalizeSubscriptionStatus('active')).toBe('active');
    });

    it('normalizes "free" status', () => {
      expect(normalizeSubscriptionStatus('free')).toBe('free');
    });

    it('normalizes "cancelled" status', () => {
      expect(normalizeSubscriptionStatus('cancelled')).toBe('cancelled');
    });

    it('normalizes null/undefined/empty to "unknown"', () => {
      expect(normalizeSubscriptionStatus(null)).toBe('unknown');
      expect(normalizeSubscriptionStatus(undefined)).toBe('unknown');
      expect(normalizeSubscriptionStatus('')).toBe('unknown');
    });

    it('normalizes NaN string to "unknown"', () => {
      expect(normalizeSubscriptionStatus('NaN')).toBe('unknown');
      expect(normalizeSubscriptionStatus('nan')).toBe('unknown');
    });

    it('is case-insensitive', () => {
      expect(normalizeSubscriptionStatus('Trial')).toBe('trial');
      expect(normalizeSubscriptionStatus('ACTIVE')).toBe('active');
      expect(normalizeSubscriptionStatus('Cancelled')).toBe('cancelled');
    });
  });

  describe('segmentChatUsers', () => {
    it('segments users by subscription status', () => {
      const rows = [
        makeRow({ userId: 'u1', subscriptionStatus: 'trial' }),
        makeRow({ userId: 'u1', subscriptionStatus: 'trial' }),
        makeRow({ userId: 'u2', subscriptionStatus: 'active' }),
        makeRow({ userId: 'u3', subscriptionStatus: 'free' }),
        makeRow({ userId: 'u4', subscriptionStatus: 'cancelled' }),
        makeRow({ userId: 'u5', subscriptionStatus: '' }),
      ];

      const segments = segmentChatUsers(rows);
      expect(segments.trial).toContain('u1');
      expect(segments.active).toContain('u2');
      expect(segments.free).toContain('u3');
      expect(segments.cancelled).toContain('u4');
      expect(segments.unknown).toContain('u5');
    });

    it('assigns user to most advanced status when they have multiple', () => {
      // Priority: active > cancelled > trial > free > unknown
      const rows = [
        makeRow({ userId: 'u1', subscriptionStatus: 'trial', timestamp: '2026-03-01T10:00:00Z' }),
        makeRow({ userId: 'u1', subscriptionStatus: 'active', timestamp: '2026-03-05T10:00:00Z' }),
      ];

      const segments = segmentChatUsers(rows);
      expect(segments.active).toContain('u1');
      expect(segments.trial).not.toContain('u1');
    });

    it('deduplicates user IDs within segments', () => {
      const rows = [
        makeRow({ userId: 'u1', subscriptionStatus: 'trial' }),
        makeRow({ userId: 'u1', subscriptionStatus: 'trial' }),
        makeRow({ userId: 'u1', subscriptionStatus: 'trial' }),
      ];

      const segments = segmentChatUsers(rows);
      expect(segments.trial).toHaveLength(1);
    });

    it('handles empty rows', () => {
      const segments = segmentChatUsers([]);
      expect(segments.trial).toEqual([]);
      expect(segments.active).toEqual([]);
      expect(segments.free).toEqual([]);
      expect(segments.cancelled).toEqual([]);
      expect(segments.unknown).toEqual([]);
    });
  });
});

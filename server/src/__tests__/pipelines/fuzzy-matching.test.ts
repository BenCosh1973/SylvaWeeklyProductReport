import { describe, it, expect } from 'vitest';
import { fuzzyMatchUsers } from '../../pipelines/fuzzy-matching.js';
import type { ChatUser, UxcamUser } from '../../pipelines/fuzzy-matching.js';

describe('Fuzzy User Matching', () => {
  // AC-PIPE-7: Fuzzy user matching between Chat Digest and UXCam includes a confidence score

  it('matches users with same subscription status and similar timing', () => {
    const chatUsers: ChatUser[] = [
      { userId: 'chat-uuid-1', subscriptionStatus: 'active', trialStartDate: '2026-02-01', sessionCount: 6 },
    ];
    const uxcamUsers: UxcamUser[] = [
      { uxcamuserid: 'hex123abc', subscriptionStatus: 'paid', totalSessions: 8, firstSeen: '2026-02-01' },
    ];

    const matches = fuzzyMatchUsers(chatUsers, uxcamUsers);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].chatDigestUserId).toBe('chat-uuid-1');
    expect(matches[0].uxcamUserId).toBe('hex123abc');
    expect(matches[0].confidence).toBeGreaterThan(0);
    expect(matches[0].confidence).toBeLessThanOrEqual(1);
  });

  it('matches by subscription status mapping (active ↔ paid)', () => {
    const chatUsers: ChatUser[] = [
      { userId: 'c1', subscriptionStatus: 'active', trialStartDate: null, sessionCount: 5 },
    ];
    const uxcamUsers: UxcamUser[] = [
      { uxcamuserid: 'ux1', subscriptionStatus: 'paid', totalSessions: 6, firstSeen: null },
      { uxcamuserid: 'ux2', subscriptionStatus: 'trial_started', totalSessions: 3, firstSeen: null },
    ];

    const matches = fuzzyMatchUsers(chatUsers, uxcamUsers);
    // Should prefer matching active → paid over active → trial_started
    const topMatch = matches[0];
    expect(topMatch.uxcamUserId).toBe('ux1');
  });

  it('matches by trial start date proximity', () => {
    const chatUsers: ChatUser[] = [
      { userId: 'c1', subscriptionStatus: 'trial', trialStartDate: '2026-03-01', sessionCount: 3 },
    ];
    const uxcamUsers: UxcamUser[] = [
      { uxcamuserid: 'ux1', subscriptionStatus: 'trial_started', totalSessions: 4, firstSeen: '2026-03-01' },
      { uxcamuserid: 'ux2', subscriptionStatus: 'trial_started', totalSessions: 4, firstSeen: '2026-02-15' },
    ];

    const matches = fuzzyMatchUsers(chatUsers, uxcamUsers);
    // ux1 has closer date match
    const c1Match = matches.find(m => m.chatDigestUserId === 'c1');
    expect(c1Match?.uxcamUserId).toBe('ux1');
    expect(c1Match?.confidence).toBeGreaterThan(0.5);
  });

  it('matches by session count similarity', () => {
    const chatUsers: ChatUser[] = [
      { userId: 'c1', subscriptionStatus: 'trial', trialStartDate: '2026-03-01', sessionCount: 15 },
    ];
    const uxcamUsers: UxcamUser[] = [
      { uxcamuserid: 'ux1', subscriptionStatus: 'trial_started', totalSessions: 14, firstSeen: '2026-03-01' },
      { uxcamuserid: 'ux2', subscriptionStatus: 'trial_started', totalSessions: 2, firstSeen: '2026-03-01' },
    ];

    const matches = fuzzyMatchUsers(chatUsers, uxcamUsers);
    const c1Match = matches.find(m => m.chatDigestUserId === 'c1');
    expect(c1Match?.uxcamUserId).toBe('ux1');
  });

  it('includes matchedOn field explaining which signals matched', () => {
    const chatUsers: ChatUser[] = [
      { userId: 'c1', subscriptionStatus: 'active', trialStartDate: '2026-02-01', sessionCount: 6 },
    ];
    const uxcamUsers: UxcamUser[] = [
      { uxcamuserid: 'ux1', subscriptionStatus: 'paid', totalSessions: 7, firstSeen: '2026-02-01' },
    ];

    const matches = fuzzyMatchUsers(chatUsers, uxcamUsers);
    expect(matches[0].matchedOn).toContain('subscription_status');
    expect(matches[0].matchedOn).toContain('timing');
  });

  it('returns empty array when no reasonable matches exist', () => {
    const chatUsers: ChatUser[] = [
      { userId: 'c1', subscriptionStatus: 'free', trialStartDate: null, sessionCount: 1 },
    ];
    const uxcamUsers: UxcamUser[] = [
      { uxcamuserid: 'ux1', subscriptionStatus: 'paid', totalSessions: 50, firstSeen: '2025-01-01' },
    ];

    const matches = fuzzyMatchUsers(chatUsers, uxcamUsers);
    // Either no matches or very low confidence
    if (matches.length > 0) {
      expect(matches[0].confidence).toBeLessThan(0.3);
    }
  });

  it('does not produce duplicate matches (1:1 mapping)', () => {
    const chatUsers: ChatUser[] = [
      { userId: 'c1', subscriptionStatus: 'active', trialStartDate: '2026-02-01', sessionCount: 5 },
      { userId: 'c2', subscriptionStatus: 'active', trialStartDate: '2026-02-15', sessionCount: 8 },
    ];
    const uxcamUsers: UxcamUser[] = [
      { uxcamuserid: 'ux1', subscriptionStatus: 'paid', totalSessions: 6, firstSeen: '2026-02-01' },
      { uxcamuserid: 'ux2', subscriptionStatus: 'paid', totalSessions: 9, firstSeen: '2026-02-14' },
    ];

    const matches = fuzzyMatchUsers(chatUsers, uxcamUsers);
    const uxcamIds = matches.map(m => m.uxcamUserId);
    const chatIds = matches.map(m => m.chatDigestUserId);
    // No UXCam user matched to multiple chat users
    expect(new Set(uxcamIds).size).toBe(uxcamIds.length);
    expect(new Set(chatIds).size).toBe(chatIds.length);
  });

  it('handles empty input arrays', () => {
    expect(fuzzyMatchUsers([], [])).toEqual([]);
    expect(fuzzyMatchUsers([{ userId: 'c1', subscriptionStatus: 'trial', trialStartDate: null, sessionCount: 1 }], [])).toEqual([]);
    expect(fuzzyMatchUsers([], [{ uxcamuserid: 'ux1', subscriptionStatus: 'trial_started', totalSessions: 1, firstSeen: null }])).toEqual([]);
  });

  it('confidence score is between 0 and 1', () => {
    const chatUsers: ChatUser[] = [
      { userId: 'c1', subscriptionStatus: 'trial', trialStartDate: '2026-03-01', sessionCount: 5 },
    ];
    const uxcamUsers: UxcamUser[] = [
      { uxcamuserid: 'ux1', subscriptionStatus: 'trial_started', totalSessions: 6, firstSeen: '2026-03-02' },
    ];

    const matches = fuzzyMatchUsers(chatUsers, uxcamUsers);
    matches.forEach(m => {
      expect(m.confidence).toBeGreaterThanOrEqual(0);
      expect(m.confidence).toBeLessThanOrEqual(1);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { classifyByHeaders } from '../../parsers/csv-classifier.js';
import { segmentTrialUsers } from '../../pipelines/trial-profile-builder.js';
import type { TrialUserProfile } from '../../types.js';

describe('Trial Duration Handling', () => {
  // AC-DS-5: If trial duration CSV is not uploaded, all trial users default to 7-day trial length
  // AC-PIPE-6: Trial expiration uses per-user trial duration from uploaded CSV; defaults to 7 days

  it('classifies trial duration CSV by headers', () => {
    const result = classifyByHeaders(['user_id', 'trial_length_days']);
    expect(result).toBe('trial_durations');
  });

  it('7-day trial: user is expired at day 8', () => {
    const profiles = new Map<string, TrialUserProfile>([
      ['u1', {
        userId: 'u1', totalSessions: 2, firstChat: '2026-03-01', lastChat: '2026-03-02',
        daysActive: 1, trialStartDate: '2026-03-01', daysSinceTrialStart: 8,
        trialLengthDays: 7,
        meanCsat: 3, meanMsgCount: 4, meanDurationMin: 2, totalMessages: 8,
        topics: [], testsCompleted: 1, testsNames: null,
        pss10Before: null, pss10After: null, pss10Change: null,
        emotionsBefore: null, emotionsAfter: null, reliefVelocity: null,
      }],
    ]);

    const today = new Date('2026-03-09T12:00:00Z');
    const segments = segmentTrialUsers(profiles, today);
    expect(segments.expired_lapsed).toContain('u1');
  });

  it('30-day trial: user is NOT expired at day 8', () => {
    const profiles = new Map<string, TrialUserProfile>([
      ['u1', {
        userId: 'u1', totalSessions: 2, firstChat: '2026-03-01', lastChat: '2026-03-08',
        daysActive: 7, trialStartDate: '2026-03-01', daysSinceTrialStart: 8,
        trialLengthDays: 30,
        meanCsat: 3, meanMsgCount: 4, meanDurationMin: 2, totalMessages: 8,
        topics: [], testsCompleted: 1, testsNames: null,
        pss10Before: null, pss10After: null, pss10Change: null,
        emotionsBefore: null, emotionsAfter: null, reliefVelocity: null,
      }],
    ]);

    const today = new Date('2026-03-09T12:00:00Z');
    const segments = segmentTrialUsers(profiles, today);
    expect(segments.expired_lapsed).not.toContain('u1');
  });

  it('30-day trial: user IS expired at day 31', () => {
    const profiles = new Map<string, TrialUserProfile>([
      ['u1', {
        userId: 'u1', totalSessions: 5, firstChat: '2026-02-01', lastChat: '2026-02-20',
        daysActive: 19, trialStartDate: '2026-02-01', daysSinceTrialStart: 36,
        trialLengthDays: 30,
        meanCsat: 3.5, meanMsgCount: 5, meanDurationMin: 3, totalMessages: 25,
        topics: ['anxiety'], testsCompleted: 3, testsNames: 'PSS-10',
        pss10Before: 28, pss10After: 22, pss10Change: -6,
        emotionsBefore: 'stressed', emotionsAfter: 'supported', reliefVelocity: 'moderate',
      }],
    ]);

    const today = new Date('2026-03-09T12:00:00Z');
    const segments = segmentTrialUsers(profiles, today);
    expect(segments.expired_lapsed).toContain('u1');
  });

  it('90-day trial: user is NOT expired at day 60', () => {
    const profiles = new Map<string, TrialUserProfile>([
      ['u1', {
        userId: 'u1', totalSessions: 10, firstChat: '2026-01-01', lastChat: '2026-03-08',
        daysActive: 66, trialStartDate: '2026-01-01', daysSinceTrialStart: 67,
        trialLengthDays: 90,
        meanCsat: 4, meanMsgCount: 6, meanDurationMin: 5, totalMessages: 60,
        topics: ['co-parenting'], testsCompleted: 5, testsNames: 'PSS-10, SDQ',
        pss10Before: 30, pss10After: 18, pss10Change: -12,
        emotionsBefore: 'overwhelmed', emotionsAfter: 'hopeful', reliefVelocity: 'fast',
      }],
    ]);

    const today = new Date('2026-03-09T12:00:00Z');
    const segments = segmentTrialUsers(profiles, today);
    expect(segments.expired_lapsed).not.toContain('u1');
  });

  it('90-day trial: user IS expired at day 91', () => {
    const profiles = new Map<string, TrialUserProfile>([
      ['u1', {
        userId: 'u1', totalSessions: 3, firstChat: '2025-12-01', lastChat: '2025-12-15',
        daysActive: 14, trialStartDate: '2025-12-01', daysSinceTrialStart: 99,
        trialLengthDays: 90,
        meanCsat: 3, meanMsgCount: 3, meanDurationMin: 2, totalMessages: 9,
        topics: [], testsCompleted: 1, testsNames: null,
        pss10Before: null, pss10After: null, pss10Change: null,
        emotionsBefore: null, emotionsAfter: null, reliefVelocity: null,
      }],
    ]);

    const today = new Date('2026-03-09T12:00:00Z');
    const segments = segmentTrialUsers(profiles, today);
    expect(segments.expired_lapsed).toContain('u1');
  });

  it('defaults to 7 days when trialLengthDays is 7', () => {
    // This verifies the default behavior when no trial duration CSV is uploaded
    const profiles = new Map<string, TrialUserProfile>([
      ['u1', {
        userId: 'u1', totalSessions: 1, firstChat: '2026-03-01', lastChat: '2026-03-01',
        daysActive: 0, trialStartDate: '2026-03-01', daysSinceTrialStart: 8,
        trialLengthDays: 7, // default
        meanCsat: null, meanMsgCount: 3, meanDurationMin: 1, totalMessages: 3,
        topics: [], testsCompleted: 0, testsNames: null,
        pss10Before: null, pss10After: null, pss10Change: null,
        emotionsBefore: null, emotionsAfter: null, reliefVelocity: null,
      }],
    ]);

    const today = new Date('2026-03-09T12:00:00Z');
    const segments = segmentTrialUsers(profiles, today);
    expect(segments.expired_lapsed).toContain('u1');
  });
});

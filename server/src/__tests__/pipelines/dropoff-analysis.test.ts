import { describe, it, expect } from 'vitest';
import { analyseDropoffCohort } from '../../pipelines/dropoff-analysis.js';
import type { SessionRecord, UserRecord } from '../../pipelines/dropoff-analysis.js';

describe('Drop-off Cohort Analysis', () => {
  const events = [
    { uxcamuserid: 'u1', sessionid: 's1', real_screen: 'get_started', eventname: 'get_started_click' },
    { uxcamuserid: 'u1', sessionid: 's1', real_screen: 'user_onboarding', eventname: 'onboarding_user_step_challenges' },
    { uxcamuserid: 'u1', sessionid: 's2', real_screen: 'get_started', eventname: 'get_started_click' },
    { uxcamuserid: 'u2', sessionid: 's3', real_screen: 'get_started', eventname: 'get_started_click' },
    { uxcamuserid: 'u2', sessionid: 's3', real_screen: 'user_onboarding', eventname: 'onboarding_user_step_challenges' },
  ];

  const sessions: SessionRecord[] = [
    { sessionid: 's1', uxcamuserid: 'u1', totalsessiontime: 120, ragegesturecount: 2, locationcountry: 'United Kingdom', locationcity: 'London' },
    { sessionid: 's2', uxcamuserid: 'u1', totalsessiontime: 60, ragegesturecount: 0, locationcountry: 'United Kingdom', locationcity: 'London' },
    { sessionid: 's3', uxcamuserid: 'u2', totalsessiontime: 45, ragegesturecount: 1, locationcountry: 'United Kingdom', locationcity: 'Manchester' },
  ];

  const users: UserRecord[] = [
    { uxcamuserid: 'u1', country: 'United Kingdom', totalsession: 2, totalsessiontime: 180, subscriptionstatus: '', signupsource: 'organic' },
    { uxcamuserid: 'u2', country: 'United Kingdom', totalsession: 1, totalsessiontime: 45, subscriptionstatus: '', signupsource: 'ad' },
  ];

  it('returns correct user count for a dropoff cohort', () => {
    const result = analyseDropoffCohort(['u1', 'u2'], events, sessions, users);
    expect(result.userCount).toBe(2);
  });

  it('calculates median session time across users', () => {
    const result = analyseDropoffCohort(['u1', 'u2'], events, sessions, users);
    // u1 total = 120 + 60 = 180, u2 total = 45, median = (180 + 45) / 2 = 112.5 or median of [45, 180] = 112.5
    expect(result.medianSessionTime).toBeDefined();
    expect(result.medianSessionTime).toBeGreaterThan(0);
  });

  it('calculates median session count per user', () => {
    const result = analyseDropoffCohort(['u1', 'u2'], events, sessions, users);
    // u1 has 2 sessions, u2 has 1. Median = 1.5
    expect(result.medianSessionCount).toBeDefined();
  });

  it('sums rage gestures across all users', () => {
    const result = analyseDropoffCohort(['u1', 'u2'], events, sessions, users);
    // u1: 2 + 0 = 2, u2: 1, total = 3
    expect(result.totalRageGestures).toBe(3);
  });

  it('builds geography breakdown', () => {
    const result = analyseDropoffCohort(['u1', 'u2'], events, sessions, users);
    expect(result.geoBreakdown['United Kingdom']).toBe(2);
  });

  it('includes per-user detail with session IDs and screens visited', () => {
    const result = analyseDropoffCohort(['u1'], events, sessions, users);
    expect(result.userDetails).toHaveLength(1);

    const u1 = result.userDetails[0];
    expect(u1.userId).toBe('u1');
    expect(u1.sessionIds).toContain('s1');
    expect(u1.sessionIds).toContain('s2');
    expect(u1.screensVisited).toContain('get_started');
    expect(u1.screensVisited).toContain('user_onboarding');
    expect(u1.eventsTriggered).toContain('get_started_click');
    expect(u1.subscriptionStatus).toBe('');
  });

  it('handles users not found in session/user files gracefully', () => {
    const result = analyseDropoffCohort(['unknown_user'], events, sessions, users);
    expect(result.userCount).toBe(1);
    expect(result.userDetails[0].sessionCount).toBe(0);
    expect(result.userDetails[0].country).toBe('unknown');
  });

  it('handles empty user IDs list', () => {
    const result = analyseDropoffCohort([], events, sessions, users);
    expect(result.userCount).toBe(0);
    expect(result.userDetails).toEqual([]);
  });
});

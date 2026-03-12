import { describe, it, expect } from 'vitest';
import { buildOnboardingFunnel } from '../../pipelines/onboarding-funnel.js';
import type { UxcamEvent } from '../../types.js';

function makeEvent(userId: string, eventName: string, screen?: string): UxcamEvent {
  return {
    sessionid: `sess_${userId}_${eventName}`,
    eventname: eventName,
    property: screen ? `{'screen_name': '${screen}'}` : '{}',
    trackedon: '2026-03-05T10:00:00Z',
    uxcamuserid: userId,
    screen_name: 'CAPBridgeViewController',
    real_screen: screen ?? 'unknown',
    parsed_property: { screen_name: screen },
  };
}

describe('Onboarding Funnel Builder (Pipeline A)', () => {
  // AC-PIPE-2: Funnel user counts are monotonically decreasing

  it('builds correct funnel for users completing all steps', () => {
    const events: UxcamEvent[] = [
      makeEvent('u1', 'get_started_click', 'get_started'),
      makeEvent('u1', 'onboarding_user_step_name', 'user_onboarding'),
      makeEvent('u1', 'onboarding_user_step_challenges', 'user_onboarding'),
      makeEvent('u1', 'signup_sms_auth_viewed', 'login'),
      makeEvent('u1', 'signup_sms_pin_entered', 'login'),
      makeEvent('u1', 'signup_complete', 'login'),
      makeEvent('u1', 'trial_start', 'trial_start'),
    ];

    const result = buildOnboardingFunnel(events);

    expect(result.funnelTable).toHaveLength(8); // total_tracked + 7 steps
    expect(result.funnelTable[0].step).toBe('total_tracked');
    expect(result.funnelTable[0].usersReached).toBe(1);
    expect(result.funnelTable[7].step).toBe('trial_start');
    expect(result.funnelTable[7].usersReached).toBe(1);
  });

  it('correctly identifies drop-offs at each step', () => {
    const events: UxcamEvent[] = [
      // User 1: completes all steps
      makeEvent('u1', 'get_started_click'),
      makeEvent('u1', 'onboarding_user_step_name'),
      makeEvent('u1', 'onboarding_user_step_challenges'),
      makeEvent('u1', 'signup_sms_auth_viewed'),
      makeEvent('u1', 'signup_sms_pin_entered'),
      makeEvent('u1', 'signup_complete'),
      makeEvent('u1', 'trial_start'),
      // User 2: drops after challenges (deepest = step 3)
      makeEvent('u2', 'get_started_click'),
      makeEvent('u2', 'onboarding_user_step_name'),
      makeEvent('u2', 'onboarding_user_step_challenges'),
      // User 3: drops after get_started (deepest = step 1)
      makeEvent('u3', 'get_started_click'),
      // User 4: no engagement (no funnel events)
      makeEvent('u4', 'rageTap'),
    ];

    const result = buildOnboardingFunnel(events);

    // 4 users tracked total
    expect(result.funnelTable[0].usersReached).toBe(4);
    // 3 reached get_started_click
    expect(result.funnelTable[1].usersReached).toBe(3);
    // 2 reached challenges
    expect(result.funnelTable[3].usersReached).toBe(2);
    // 1 reached trial_start
    expect(result.funnelTable[7].usersReached).toBe(1);

    // Drop-offs
    const noEngagement = result.dropoffs.find(d => d.stepNum === 0);
    expect(noEngagement?.count).toBe(1); // u4
    expect(noEngagement?.userIds).toContain('u4');

    const droppedAtGetStarted = result.dropoffs.find(d => d.stepNum === 1);
    expect(droppedAtGetStarted?.count).toBe(1); // u3

    const droppedAtChallenges = result.dropoffs.find(d => d.stepNum === 3);
    expect(droppedAtChallenges?.count).toBe(1); // u2
  });

  it('handles users who bypass steps (reach later step without earlier)', () => {
    // Some users bypass steps — count them based on deepest step regardless
    const events: UxcamEvent[] = [
      // User 1: has challenges but NOT get_started_click or name
      makeEvent('u1', 'onboarding_user_step_challenges'),
      makeEvent('u1', 'signup_sms_auth_viewed'),
      makeEvent('u1', 'signup_sms_pin_entered'),
      makeEvent('u1', 'signup_complete'),
      makeEvent('u1', 'trial_start'),
    ];

    const result = buildOnboardingFunnel(events);

    // User's deepest step is trial_start (7)
    expect(result.userDeepestStep.get('u1')).toBe(7);
    expect(result.funnelTable[7].usersReached).toBe(1);
  });

  it('funnel counts are monotonically decreasing', () => {
    const events: UxcamEvent[] = [];
    // Generate 100 users with random funnel depths
    for (let i = 0; i < 100; i++) {
      const steps = [
        'get_started_click', 'onboarding_user_step_name',
        'onboarding_user_step_challenges', 'signup_sms_auth_viewed',
        'signup_sms_pin_entered', 'signup_complete', 'trial_start',
      ];
      const depth = Math.floor(Math.random() * (steps.length + 1));
      for (let s = 0; s < depth; s++) {
        events.push(makeEvent(`u${i}`, steps[s]));
      }
      if (depth === 0) {
        // Add a non-funnel event so user appears
        events.push(makeEvent(`u${i}`, 'rageTap'));
      }
    }

    const result = buildOnboardingFunnel(events);

    // AC-PIPE-2: Monotonically decreasing
    for (let i = 1; i < result.funnelTable.length; i++) {
      expect(result.funnelTable[i].usersReached).toBeLessThanOrEqual(
        result.funnelTable[i - 1].usersReached
      );
    }
  });

  it('drop-off counts sum to total tracked users', () => {
    const events: UxcamEvent[] = [
      makeEvent('u1', 'get_started_click'),
      makeEvent('u1', 'trial_start'),
      makeEvent('u2', 'get_started_click'),
      makeEvent('u2', 'onboarding_user_step_challenges'),
      makeEvent('u3', 'rageTap'), // no engagement
    ];

    const result = buildOnboardingFunnel(events);

    const totalDropoffs = result.dropoffs.reduce((sum, d) => sum + d.count, 0);
    const trialStarts = result.funnelTable[result.funnelTable.length - 1].usersReached;
    const totalTracked = result.funnelTable[0].usersReached;

    // Dropoffs + completions = total (allowing for step-bypassing users)
    expect(totalDropoffs + trialStarts).toBe(totalTracked);
  });

  it('handles empty events array', () => {
    const result = buildOnboardingFunnel([]);
    expect(result.funnelTable[0].usersReached).toBe(0);
    expect(result.dropoffs).toEqual([]);
  });

  it('tracks user IDs in dropoff cohorts', () => {
    const events: UxcamEvent[] = [
      makeEvent('user_abc', 'get_started_click'),
      makeEvent('user_abc', 'onboarding_user_step_challenges'),
      // Drops at challenges → SMS auth
    ];

    const result = buildOnboardingFunnel(events);
    const dropAtChallenges = result.dropoffs.find(d => d.stepNum === 3);
    expect(dropAtChallenges?.userIds).toContain('user_abc');
  });

  it('calculates correct conversion percentages', () => {
    const events: UxcamEvent[] = [
      makeEvent('u1', 'get_started_click'),
      makeEvent('u1', 'trial_start'),
      makeEvent('u2', 'get_started_click'),
      makeEvent('u2', 'trial_start'),
      makeEvent('u3', 'get_started_click'),
      // u3 drops at get_started
      makeEvent('u4', 'rageTap'), // no engagement
    ];

    const result = buildOnboardingFunnel(events);

    // get_started: 3/4 = 75%
    expect(result.funnelTable[1].conversionFromPrev).toBeCloseTo(75, 0);
  });
});

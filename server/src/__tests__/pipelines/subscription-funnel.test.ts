import { describe, it, expect } from 'vitest';
import { buildSubscriptionFunnel } from '../../pipelines/subscription-funnel.js';
import type { UxcamEvent } from '../../types.js';

function makeEvent(userId: string, eventName: string, props: Record<string, string> = {}): UxcamEvent {
  const propStr = Object.entries(props).map(([k, v]) => `'${k}': '${v}'`).join(', ');
  return {
    sessionid: `sess_${userId}`,
    eventname: eventName,
    property: `{${propStr}}`,
    trackedon: '2026-03-05T10:00:00Z',
    uxcamuserid: userId,
    screen_name: 'CAPBridgeViewController',
    real_screen: props.screen_name ?? 'unknown',
    parsed_property: props,
  };
}

describe('Subscription Sub-Funnel Builder', () => {
  it('builds correct funnel from subscription events', () => {
    const events: UxcamEvent[] = [
      // User 1: full path
      makeEvent('u1', 'trial_start'),
      makeEvent('u1', 'subscription_pricing_viewed', { from_page: 'chat' }),
      makeEvent('u1', 'subscription_plan_selected', { plan: 'monthly' }),
      makeEvent('u1', 'subscription_purchase_started', { package: 'monthly', price: '9.99' }),
      makeEvent('u1', 'subscription_payment_viewed'),
      makeEvent('u1', 'subscription_completed'),
      // User 2: stops at pricing
      makeEvent('u2', 'trial_start'),
      makeEvent('u2', 'subscription_pricing_viewed', { from_page: 'settings' }),
      // User 3: only trial start
      makeEvent('u3', 'trial_start'),
      // User 4: non-subscription events
      makeEvent('u4', 'get_started_click'),
    ];

    const result = buildSubscriptionFunnel(events);

    expect(result.funnel).toHaveLength(7); // 7 subscription funnel steps
    expect(result.funnel[0].step).toBe('trial_start');
    expect(result.funnel[0].uniqueUsers).toBe(3);
    expect(result.funnel[1].step).toBe('subscription_pricing_viewed');
    expect(result.funnel[1].uniqueUsers).toBe(2);
    expect(result.funnel[5].step).toBe('subscription_completed');
    expect(result.funnel[5].uniqueUsers).toBe(1);
  });

  it('tracks from_page breakdown for pricing events', () => {
    const events: UxcamEvent[] = [
      makeEvent('u1', 'subscription_pricing_viewed', { from_page: 'chat' }),
      makeEvent('u2', 'subscription_pricing_viewed', { from_page: 'chat' }),
      makeEvent('u3', 'subscription_pricing_viewed', { from_page: 'settings' }),
    ];

    const result = buildSubscriptionFunnel(events);
    expect(result.fromPageBreakdown['chat']).toBe(2);
    expect(result.fromPageBreakdown['settings']).toBe(1);
  });

  it('counts trial limit modal users', () => {
    const events: UxcamEvent[] = [
      makeEvent('u1', 'chat_trial_start_modal_visible', { chatbot: 'Hazel', modal_type: 'trial_limit' }),
      makeEvent('u2', 'chat_trial_start_modal_visible', { chatbot: 'Frankie', modal_type: 'trial_limit' }),
      makeEvent('u1', 'chat_trial_start_modal_visible', { chatbot: 'Hazel', modal_type: 'trial_limit' }), // duplicate user
    ];

    const result = buildSubscriptionFunnel(events);
    expect(result.modalUserCount).toBe(2); // unique users
  });

  it('funnel is monotonically decreasing', () => {
    const events: UxcamEvent[] = [
      makeEvent('u1', 'trial_start'),
      makeEvent('u1', 'subscription_pricing_viewed'),
      makeEvent('u1', 'subscription_completed'),
      makeEvent('u2', 'trial_start'),
      makeEvent('u2', 'subscription_pricing_viewed'),
      makeEvent('u3', 'trial_start'),
    ];

    const result = buildSubscriptionFunnel(events);
    for (let i = 1; i < result.funnel.length; i++) {
      expect(result.funnel[i].uniqueUsers).toBeLessThanOrEqual(result.funnel[i - 1].uniqueUsers);
    }
  });

  it('tracks user IDs at each step', () => {
    const events: UxcamEvent[] = [
      makeEvent('user_abc', 'trial_start'),
      makeEvent('user_abc', 'subscription_pricing_viewed'),
    ];

    const result = buildSubscriptionFunnel(events);
    expect(result.funnel[0].userIds).toContain('user_abc');
    expect(result.funnel[1].userIds).toContain('user_abc');
  });

  it('counts total events (including duplicates from same user)', () => {
    const events: UxcamEvent[] = [
      makeEvent('u1', 'subscription_pricing_viewed'),
      makeEvent('u1', 'subscription_pricing_viewed'), // same user, second view
      makeEvent('u2', 'subscription_pricing_viewed'),
    ];

    const result = buildSubscriptionFunnel(events);
    const pricingStep = result.funnel.find(f => f.step === 'subscription_pricing_viewed');
    expect(pricingStep?.uniqueUsers).toBe(2);
    expect(pricingStep?.totalEvents).toBe(3);
  });

  it('handles empty events', () => {
    const result = buildSubscriptionFunnel([]);
    expect(result.funnel.every(f => f.uniqueUsers === 0)).toBe(true);
    expect(result.modalUserCount).toBe(0);
  });
});

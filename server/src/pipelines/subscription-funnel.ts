import type { SubFunnelStep, UxcamEvent } from '../types.js';
import { SUBSCRIPTION_FUNNEL_STEPS } from '../types.js';

export interface SubscriptionFunnelResult {
  funnel: SubFunnelStep[];
  fromPageBreakdown: Record<string, number>;
  modalUserCount: number;
}

export function buildSubscriptionFunnel(events: UxcamEvent[]): SubscriptionFunnelResult {
  // Build per-step tracking
  const stepUsers = new Map<string, Set<string>>();
  const stepTotalEvents = new Map<string, number>();

  for (const step of SUBSCRIPTION_FUNNEL_STEPS) {
    stepUsers.set(step, new Set());
    stepTotalEvents.set(step, 0);
  }

  const fromPageBreakdown: Record<string, number> = {};
  const modalUsers = new Set<string>();

  for (const e of events) {
    // Check subscription funnel steps
    if (SUBSCRIPTION_FUNNEL_STEPS.includes(e.eventname as any)) {
      stepUsers.get(e.eventname)!.add(e.uxcamuserid);
      stepTotalEvents.set(e.eventname, (stepTotalEvents.get(e.eventname) ?? 0) + 1);

      // Track from_page for pricing views
      if (e.eventname === 'subscription_pricing_viewed') {
        const fromPage = e.parsed_property?.from_page as string;
        if (fromPage) {
          fromPageBreakdown[fromPage] = (fromPageBreakdown[fromPage] ?? 0) + 1;
        }
      }
    }

    // Track trial limit modal
    if (e.eventname === 'chat_trial_start_modal_visible') {
      modalUsers.add(e.uxcamuserid);
    }
  }

  // Build funnel with monotonic user counts (users at step N = those who reached at least step N)
  // First, compute per-user deepest subscription step
  const userDeepest = new Map<string, number>();
  for (const e of events) {
    const idx = SUBSCRIPTION_FUNNEL_STEPS.indexOf(e.eventname as any);
    if (idx >= 0) {
      const current = userDeepest.get(e.uxcamuserid) ?? -1;
      if (idx > current) {
        userDeepest.set(e.uxcamuserid, idx);
      }
    }
  }

  const funnel: SubFunnelStep[] = SUBSCRIPTION_FUNNEL_STEPS.map((step, i) => {
    // Users who reached at least this step
    const usersAtLeast = [...userDeepest.entries()].filter(([, d]) => d >= i).map(([uid]) => uid);
    return {
      step,
      uniqueUsers: usersAtLeast.length,
      userIds: usersAtLeast,
      totalEvents: stepTotalEvents.get(step) ?? 0,
    };
  });

  return { funnel, fromPageBreakdown, modalUserCount: modalUsers.size };
}

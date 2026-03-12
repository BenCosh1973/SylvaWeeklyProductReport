import type { SubFunnelStep, UxcamEvent } from '../types.js';

export interface SubscriptionFunnelResult {
  funnel: SubFunnelStep[];
  fromPageBreakdown: Record<string, number>;
  modalUserCount: number;
}

export function buildSubscriptionFunnel(events: UxcamEvent[]): SubscriptionFunnelResult {
  throw new Error('Not implemented');
}

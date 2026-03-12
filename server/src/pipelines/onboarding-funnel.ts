import type { FunnelStep, DropoffCohort, UxcamEvent } from '../types.js';

export interface OnboardingFunnelResult {
  funnelTable: FunnelStep[];
  dropoffs: DropoffCohort[];
  userDeepestStep: Map<string, number>;
}

export function buildOnboardingFunnel(events: UxcamEvent[]): OnboardingFunnelResult {
  throw new Error('Not implemented');
}

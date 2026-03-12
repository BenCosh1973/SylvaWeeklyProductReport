import type {
  ConversionBlocker,
  TrialSegmentation,
  TrialUserProfile,
  PaidUserProfile,
  SubFunnelStep,
  ScreenMetrics,
  EngagementComparison,
} from '../types.js';

export function classifyConversionBlockers(
  trialSegments: TrialSegmentation,
  trialProfiles: Map<string, TrialUserProfile>,
  paidProfiles: Map<string, PaidUserProfile>,
  subFunnel: SubFunnelStep[],
  screenMetrics: ScreenMetrics[],
  comparison: EngagementComparison[],
  strongestPredictor: string,
  strongestGap: number
): ConversionBlocker[] {
  throw new Error('Not implemented');
}

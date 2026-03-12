import type { PaidUserProfile, EngagementComparison, TrialUserProfile } from '../types.js';
import type { ChatDigestRow } from './chat-digest-segmentation.js';

export function buildPaidProfile(
  userId: string,
  userChats: ChatDigestRow[],
  todayDate: Date
): PaidUserProfile {
  throw new Error('Not implemented');
}

export function compareTrialVsPaid(
  trialProfiles: Map<string, TrialUserProfile>,
  paidProfiles: Map<string, PaidUserProfile>
): {
  comparison: EngagementComparison[];
  strongestPredictor: string;
  strongestGap: number;
} {
  throw new Error('Not implemented');
}

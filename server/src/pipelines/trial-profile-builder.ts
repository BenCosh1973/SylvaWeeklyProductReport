import type { TrialUserProfile, TrialSegmentation } from '../types.js';
import type { ChatDigestRow } from './chat-digest-segmentation.js';

export function buildTrialProfile(
  userId: string,
  userChats: ChatDigestRow[],
  todayDate: Date,
  trialLengthDays: number
): TrialUserProfile {
  throw new Error('Not implemented');
}

export function segmentTrialUsers(
  profiles: Map<string, TrialUserProfile>,
  todayDate: Date
): TrialSegmentation {
  throw new Error('Not implemented');
}

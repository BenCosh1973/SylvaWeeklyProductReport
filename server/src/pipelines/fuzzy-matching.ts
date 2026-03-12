import type { FuzzyMatch } from '../types.js';

export interface ChatUser {
  userId: string;
  subscriptionStatus: string;
  trialStartDate: string | null;
  sessionCount: number;
}

export interface UxcamUser {
  uxcamuserid: string;
  subscriptionStatus: string;
  totalSessions: number;
  firstSeen: string | null;
}

export function fuzzyMatchUsers(
  chatUsers: ChatUser[],
  uxcamUsers: UxcamUser[]
): FuzzyMatch[] {
  throw new Error('Not implemented');
}

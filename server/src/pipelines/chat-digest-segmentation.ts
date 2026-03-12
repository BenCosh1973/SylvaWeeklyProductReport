import type { SubscriptionStatus } from '../types.js';

export interface ChatDigestRow {
  userId: string;
  timestamp: string;
  subscriptionStatus: string;
  csat: number | null;
  messageCount: number;
  durationMin: number;
  topic: string;
  emotionsBefore: string;
  emotionsAfter: string;
  pss10Before: number | null;
  pss10After: number | null;
  reliefVelocity: string;
  testsCompletedCount: number;
  testsCompletedNames: string;
  strategies: string;
  sessionCount: number;
  trialStartDate: string;
  subscriptionStartDate: string;
  model: string;
  totalCost: number;
  kidscreen27Score: number | null;
}

export interface UserSegments {
  trial: string[];
  active: string[];
  free: string[];
  cancelled: string[];
  unknown: string[];
}

export function segmentChatUsers(rows: ChatDigestRow[]): UserSegments {
  throw new Error('Not implemented');
}

export function normalizeSubscriptionStatus(raw: string | null | undefined): SubscriptionStatus {
  throw new Error('Not implemented');
}

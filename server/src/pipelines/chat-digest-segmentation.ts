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

const STATUS_PRIORITY: Record<SubscriptionStatus, number> = {
  active: 5,
  cancelled: 4,
  trial: 3,
  free: 2,
  unknown: 1,
};

export function normalizeSubscriptionStatus(raw: string | null | undefined): SubscriptionStatus {
  if (raw === null || raw === undefined) return 'unknown';
  const s = raw.trim().toLowerCase();
  if (!s || s === 'nan') return 'unknown';
  if (s === 'active') return 'active';
  if (s === 'trial') return 'trial';
  if (s === 'free') return 'free';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  return 'unknown';
}

export function segmentChatUsers(rows: ChatDigestRow[]): UserSegments {
  const segments: UserSegments = { trial: [], active: [], free: [], cancelled: [], unknown: [] };
  if (rows.length === 0) return segments;

  // For each user, determine their most advanced status
  const userBestStatus = new Map<string, SubscriptionStatus>();

  for (const row of rows) {
    const status = normalizeSubscriptionStatus(row.subscriptionStatus);
    const current = userBestStatus.get(row.userId);
    if (!current || STATUS_PRIORITY[status] > STATUS_PRIORITY[current]) {
      userBestStatus.set(row.userId, status);
    }
  }

  for (const [userId, status] of userBestStatus) {
    segments[status].push(userId);
  }

  return segments;
}

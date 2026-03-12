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

// Maps chat digest statuses to UXCam equivalents
const STATUS_MAP: Record<string, string[]> = {
  active: ['paid', 'active', 'subscribed'],
  trial: ['trial_started', 'trial', 'trialing'],
  free: ['free', 'none', ''],
  cancelled: ['cancelled', 'canceled', 'churned'],
};

function statusScore(chatStatus: string, uxcamStatus: string): number {
  const normChat = chatStatus.toLowerCase();
  const normUxcam = uxcamStatus.toLowerCase();
  const equivalents = STATUS_MAP[normChat] ?? [];
  if (equivalents.includes(normUxcam) || normChat === normUxcam) return 1.0;
  // Partial match: both are in non-free categories
  if (normChat !== 'free' && normUxcam !== 'free' && normUxcam !== '' && normUxcam !== 'none') return 0.3;
  return 0;
}

function dateProximityScore(date1: string | null, date2: string | null): number {
  if (!date1 || !date2) return 0;
  const d1 = new Date(date1).getTime();
  const d2 = new Date(date2).getTime();
  if (isNaN(d1) || isNaN(d2)) return 0;
  const diffDays = Math.abs(d1 - d2) / (24 * 60 * 60 * 1000);
  if (diffDays <= 1) return 1.0;
  if (diffDays <= 3) return 0.8;
  if (diffDays <= 7) return 0.5;
  if (diffDays <= 14) return 0.2;
  return 0;
}

function sessionCountScore(count1: number, count2: number): number {
  if (count1 === 0 && count2 === 0) return 0.5;
  const max = Math.max(count1, count2);
  if (max === 0) return 0;
  const ratio = Math.min(count1, count2) / max;
  return ratio;
}

export function fuzzyMatchUsers(
  chatUsers: ChatUser[],
  uxcamUsers: UxcamUser[]
): FuzzyMatch[] {
  if (chatUsers.length === 0 || uxcamUsers.length === 0) return [];

  // Score all possible pairs
  const scoredPairs: {
    chatIdx: number;
    uxcamIdx: number;
    score: number;
    matchedOn: string[];
  }[] = [];

  for (let ci = 0; ci < chatUsers.length; ci++) {
    for (let ui = 0; ui < uxcamUsers.length; ui++) {
      const cu = chatUsers[ci];
      const uu = uxcamUsers[ui];
      const matchedOn: string[] = [];

      const ss = statusScore(cu.subscriptionStatus, uu.subscriptionStatus);
      if (ss > 0) matchedOn.push('subscription_status');

      const ds = dateProximityScore(cu.trialStartDate, uu.firstSeen);
      if (ds > 0) matchedOn.push('timing');

      const cs = sessionCountScore(cu.sessionCount, uu.totalSessions);
      if (cs > 0.5) matchedOn.push('session_count');

      // Weighted score
      const score = ss * 0.4 + ds * 0.35 + cs * 0.25;

      scoredPairs.push({ chatIdx: ci, uxcamIdx: ui, score, matchedOn });
    }
  }

  // Greedy 1:1 matching — pick highest scoring pairs
  scoredPairs.sort((a, b) => b.score - a.score);

  const usedChat = new Set<number>();
  const usedUxcam = new Set<number>();
  const matches: FuzzyMatch[] = [];

  for (const pair of scoredPairs) {
    if (usedChat.has(pair.chatIdx) || usedUxcam.has(pair.uxcamIdx)) continue;
    if (pair.score < 0.1) continue; // minimum threshold

    usedChat.add(pair.chatIdx);
    usedUxcam.add(pair.uxcamIdx);

    matches.push({
      chatDigestUserId: chatUsers[pair.chatIdx].userId,
      uxcamUserId: uxcamUsers[pair.uxcamIdx].uxcamuserid,
      confidence: Math.min(1, pair.score),
      matchedOn: pair.matchedOn,
    });
  }

  return matches;
}

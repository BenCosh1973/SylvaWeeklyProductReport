import type { TrialUserProfile, TrialSegmentation } from '../types.js';
import type { ChatDigestRow } from './chat-digest-segmentation.js';
import { firstNonNull, lastNonNull } from '../utils/stats.js';

export function buildTrialProfile(
  userId: string,
  userChats: ChatDigestRow[],
  todayDate: Date,
  trialLengthDays: number
): TrialUserProfile {
  // Sort by timestamp
  const sorted = [...userChats].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const totalSessions = sorted.length;
  const firstChat = sorted[0]?.timestamp ?? '';
  const lastChat = sorted[sorted.length - 1]?.timestamp ?? '';

  const firstDate = new Date(firstChat);
  const lastDate = new Date(lastChat);
  const daysActive = totalSessions > 0
    ? Math.round((lastDate.getTime() - firstDate.getTime()) / (24 * 60 * 60 * 1000))
    : 0;

  // Trial start date - take first non-empty
  const trialStartDate = firstNonNull(sorted.map(r => r.trialStartDate || null));
  let daysSinceTrialStart: number | null = null;
  if (trialStartDate) {
    daysSinceTrialStart = Math.floor(
      (todayDate.getTime() - new Date(trialStartDate).getTime()) / (24 * 60 * 60 * 1000)
    );
  }

  // CSAT: exclude 0 and null
  const csatValues = sorted.map(r => r.csat).filter((c): c is number => c !== null && c > 0);
  const meanCsat = csatValues.length > 0
    ? csatValues.reduce((a, b) => a + b, 0) / csatValues.length
    : null;

  const meanMsgCount = totalSessions > 0
    ? sorted.reduce((sum, r) => sum + r.messageCount, 0) / totalSessions
    : 0;

  const meanDurationMin = totalSessions > 0
    ? sorted.reduce((sum, r) => sum + r.durationMin, 0) / totalSessions
    : 0;

  const totalMessages = sorted.reduce((sum, r) => sum + r.messageCount, 0);

  // Topics - unique
  const topics = [...new Set(sorted.map(r => r.topic).filter(Boolean))];

  // Tests - take max (cumulative field)
  const testsCompleted = Math.max(0, ...sorted.map(r => r.testsCompletedCount));
  const testsNames = lastNonNull(sorted.map(r => r.testsCompletedNames || null));

  // PSS10: first before, last after
  const pss10Before = firstNonNull(sorted.map(r => r.pss10Before));
  const pss10After = lastNonNull(sorted.map(r => r.pss10After));
  const pss10Change = (pss10Before !== null && pss10After !== null)
    ? pss10After - pss10Before
    : null;

  const emotionsBefore = firstNonNull(sorted.map(r => r.emotionsBefore || null));
  const emotionsAfter = lastNonNull(sorted.map(r => r.emotionsAfter || null));
  const reliefVelocity = lastNonNull(sorted.map(r => r.reliefVelocity || null));

  return {
    userId,
    totalSessions,
    firstChat,
    lastChat,
    daysActive,
    trialStartDate,
    daysSinceTrialStart,
    trialLengthDays,
    meanCsat,
    meanMsgCount,
    meanDurationMin,
    totalMessages,
    topics,
    testsCompleted,
    testsNames,
    pss10Before,
    pss10After,
    pss10Change,
    emotionsBefore,
    emotionsAfter,
    reliefVelocity,
  };
}

export function segmentTrialUsers(
  profiles: Map<string, TrialUserProfile>,
  todayDate: Date
): TrialSegmentation {
  const segments: TrialSegmentation = {
    high_engagement_no_convert: [],
    moderate_fading: [],
    single_session: [],
    active_trial: [],
    expired_lapsed: [],
  };

  for (const [userId, p] of profiles) {
    const trialExpired = p.daysSinceTrialStart !== null && p.daysSinceTrialStart > p.trialLengthDays;

    // 1. Expired/lapsed: trial has expired
    if (trialExpired) {
      segments.expired_lapsed.push(userId);
      continue;
    }

    // 2. Single session
    if (p.totalSessions === 1) {
      segments.single_session.push(userId);
      continue;
    }

    // Days since last chat
    const lastChatDate = new Date(p.lastChat);
    const daysSinceLastChat = (todayDate.getTime() - lastChatDate.getTime()) / (24 * 60 * 60 * 1000);

    // 3. High engagement still in trial: 5+ sessions, 3+ days active
    if (p.totalSessions >= 5 && p.daysActive >= 3) {
      segments.high_engagement_no_convert.push(userId);
      continue;
    }

    // 4. Active trial: chatted within last 48h
    if (daysSinceLastChat <= 2) {
      segments.active_trial.push(userId);
      continue;
    }

    // 5. Moderate fading: everything else (2+ sessions but fading)
    segments.moderate_fading.push(userId);
  }

  return segments;
}

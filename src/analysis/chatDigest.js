/**
 * Chat Digest Analysis — Steps 2, 3, 4 of the prompt.
 * Segments users by subscription status, builds per-user profiles,
 * and compares trial vs paid user behaviour.
 */
import { readCSV, num, median, mean, mode, round } from './csvReader.js';

/**
 * Build a per-user profile from chat digest rows.
 */
function buildUserProfile(userId, rows, today) {
  const timestamps = rows
    .map(r => new Date(r['Timestamp']))
    .filter(d => !isNaN(d))
    .sort((a, b) => a - b);

  const firstChat = timestamps[0] || null;
  const lastChat = timestamps[timestamps.length - 1] || null;
  const daysActive = firstChat && lastChat
    ? Math.max(1, Math.round((lastChat - firstChat) / (1000 * 60 * 60 * 24)))
    : 0;

  const trialStartRaw = rows.find(r => r['Trial Start Date'])?.['Trial Start Date'];
  const trialStartDate = trialStartRaw ? new Date(trialStartRaw) : null;
  const daysSinceTrialStart = trialStartDate
    ? Math.round((today - trialStartDate) / (1000 * 60 * 60 * 24))
    : null;

  const subStartRaw = rows.find(r => r['Subscription Start Date'])?.['Subscription Start Date'];
  const subscriptionStartDate = subStartRaw ? new Date(subStartRaw) : null;

  const daysTrialToSubscription = trialStartDate && subscriptionStartDate
    ? Math.round((subscriptionStartDate - trialStartDate) / (1000 * 60 * 60 * 24))
    : null;

  const csatValues = rows.map(r => num(r['CSAT'])).filter(v => v !== null);
  const msgCounts = rows.map(r => num(r['Message Count'])).filter(v => v !== null);
  const durations = rows.map(r => num(r['Duration (min)'])).filter(v => v !== null);
  const testsCompleted = rows.map(r => num(r['Tests Completed Count'])).filter(v => v !== null);

  const topics = [...new Set(rows.map(r => r['Topic']).filter(t => t && t !== 'NaN'))];
  const strategies = [...new Set(rows.map(r => r['Strategies']).filter(s => s && s !== 'NaN' && s !== 'Insufficient conversation data'))];

  const pss10Before = rows.map(r => num(r['PSS10 Before'])).filter(v => v !== null);
  const pss10After = rows.map(r => num(r['PSS10 After'])).filter(v => v !== null);

  const pss10BaselineBefore = pss10Before.length > 0 ? pss10Before[0] : null;
  const pss10Current = pss10After.length > 0 ? pss10After[pss10After.length - 1] : null;
  const pss10Change = pss10BaselineBefore !== null && pss10Current !== null
    ? round(pss10Current - pss10BaselineBefore, 1)
    : null;

  const emotionsBefore = rows.map(r => r['Emotions Before']).filter(e => e && e !== 'NaN');
  const emotionsAfter = rows.map(r => r['Emotions After']).filter(e => e && e !== 'NaN');
  const reliefVelocity = rows.map(r => r['Relief Velocity']).filter(v => v && v !== 'NaN');

  // Tests Completed Names — last non-empty value
  const testNames = rows
    .map(r => r['Tests Completed Names'])
    .filter(t => t && t !== 'NaN')
    .pop() || null;

  return {
    userId,
    subscriptionStatus: rows[0]['Subscription status'] || 'NaN',
    totalSessions: rows.length,
    firstChat,
    lastChat,
    daysActive,
    trialStartDate,
    daysSinceTrialStart,
    subscriptionStartDate,
    daysTrialToSubscription,
    meanCSAT: round(mean(csatValues), 1),
    meanMessageCount: round(mean(msgCounts), 1),
    meanDuration: round(mean(durations), 1),
    totalMessages: msgCounts.reduce((s, v) => s + v, 0),
    topics,
    testsCompletedCount: testsCompleted.length > 0 ? Math.max(...testsCompleted) : 0,
    testsCompletedNames: testNames,
    pss10Before: pss10BaselineBefore,
    pss10After: pss10Current,
    pss10Change,
    emotionsBeforeMostCommon: mode(emotionsBefore),
    emotionsAfterMostCommon: mode(emotionsAfter),
    reliefVelocityMostCommon: mode(reliefVelocity),
    strategies,
  };
}

/**
 * Segment trial users based on their engagement profile.
 */
function segmentTrialUser(profile, today) {
  const hoursSinceLastChat = profile.lastChat
    ? (today - profile.lastChat) / (1000 * 60 * 60)
    : Infinity;

  const trialExpired = profile.daysSinceTrialStart !== null && profile.daysSinceTrialStart > 7;

  if (trialExpired) {
    return 'expired_lapsed';
  }
  if (hoursSinceLastChat <= 48) {
    return 'active_trial';
  }
  if (profile.totalSessions >= 5 && profile.daysActive >= 3) {
    return 'high_engagement_no_convert';
  }
  if (profile.totalSessions >= 2 && profile.totalSessions <= 4) {
    return 'moderate_fading';
  }
  if (profile.totalSessions === 1) {
    return 'single_session';
  }
  return 'other';
}

/**
 * Main analysis function for Chat Digest data.
 */
export async function analyzeChatDigest(filePath, today = new Date()) {
  const rows = await readCSV(filePath);
  if (rows.length === 0) {
    return { error: 'No data in chat digest file', rows: 0 };
  }

  // Group rows by User ID
  const userRows = {};
  for (const row of rows) {
    const uid = row['User ID'];
    if (!uid) continue;
    if (!userRows[uid]) userRows[uid] = [];
    userRows[uid].push(row);
  }

  // Build profiles for all users
  const allProfiles = {};
  for (const [uid, uRows] of Object.entries(userRows)) {
    allProfiles[uid] = buildUserProfile(uid, uRows, today);
  }

  // Group by subscription status
  const byStatus = { trial: [], active: [], free: [], cancelled: [], unknown: [] };
  for (const profile of Object.values(allProfiles)) {
    const status = (profile.subscriptionStatus || '').toLowerCase().trim();
    if (status === 'trial') byStatus.trial.push(profile);
    else if (status === 'active') byStatus.active.push(profile);
    else if (status === 'free') byStatus.free.push(profile);
    else if (status === 'cancelled') byStatus.cancelled.push(profile);
    else byStatus.unknown.push(profile);
  }

  // Segment trial users
  const trialSegments = {
    high_engagement_no_convert: [],
    moderate_fading: [],
    single_session: [],
    active_trial: [],
    expired_lapsed: [],
    other: [],
  };
  for (const profile of byStatus.trial) {
    const segment = segmentTrialUser(profile, today);
    profile.segment = segment;
    trialSegments[segment].push(profile);
  }

  // Compute aggregate metrics for trial vs paid
  const computeGroupMetrics = (profiles) => ({
    count: profiles.length,
    medianSessions: median(profiles.map(p => p.totalSessions)),
    medianMessagesPerSession: median(profiles.map(p => p.meanMessageCount)),
    medianDuration: median(profiles.map(p => p.meanDuration)),
    medianCSAT: median(profiles.map(p => p.meanCSAT).filter(v => v !== null)),
    medianTestsCompleted: median(profiles.map(p => p.testsCompletedCount)),
    medianPSS10Change: median(profiles.map(p => p.pss10Change).filter(v => v !== null)),
    meanPSS10Before: round(mean(profiles.map(p => p.pss10Before).filter(v => v !== null)), 1),
    meanPSS10After: round(mean(profiles.map(p => p.pss10After).filter(v => v !== null)), 1),
    medianDaysActive: median(profiles.map(p => p.daysActive)),
    topTopics: getTopN(profiles.flatMap(p => p.topics), 10),
    topStrategies: getTopN(profiles.flatMap(p => p.strategies), 5),
    emotionsBeforeDistribution: getDistribution(profiles.map(p => p.emotionsBeforeMostCommon)),
    emotionsAfterDistribution: getDistribution(profiles.map(p => p.emotionsAfterMostCommon)),
    reliefVelocityDistribution: getDistribution(profiles.map(p => p.reliefVelocityMostCommon)),
  });

  const trialMetrics = computeGroupMetrics(byStatus.trial);
  const paidMetrics = computeGroupMetrics(byStatus.active);
  const cancelledMetrics = computeGroupMetrics(byStatus.cancelled);

  // Days from trial start to subscription (paid users only)
  const daysToConvert = byStatus.active
    .map(p => p.daysTrialToSubscription)
    .filter(v => v !== null);

  // Engagement gaps
  const engagementGaps = {
    messagesPerSession: {
      trial: trialMetrics.medianMessagesPerSession,
      paid: paidMetrics.medianMessagesPerSession,
      ratio: paidMetrics.medianMessagesPerSession && trialMetrics.medianMessagesPerSession
        ? round(paidMetrics.medianMessagesPerSession / trialMetrics.medianMessagesPerSession, 1)
        : null,
    },
    duration: {
      trial: trialMetrics.medianDuration,
      paid: paidMetrics.medianDuration,
      ratio: paidMetrics.medianDuration && trialMetrics.medianDuration
        ? round(paidMetrics.medianDuration / trialMetrics.medianDuration, 1)
        : null,
    },
    testsCompleted: {
      trial: trialMetrics.medianTestsCompleted,
      paid: paidMetrics.medianTestsCompleted,
      ratio: paidMetrics.medianTestsCompleted && trialMetrics.medianTestsCompleted
        ? round(paidMetrics.medianTestsCompleted / trialMetrics.medianTestsCompleted, 1)
        : null,
    },
    csat: {
      trial: trialMetrics.medianCSAT,
      paid: paidMetrics.medianCSAT,
    },
    sessions: {
      trial: trialMetrics.medianSessions,
      paid: paidMetrics.medianSessions,
    },
    pss10Change: {
      trial: trialMetrics.medianPSS10Change,
      paid: paidMetrics.medianPSS10Change,
    },
  };

  // Find strongest predictor
  const gaps = [
    { metric: 'Tests Completed', ratio: engagementGaps.testsCompleted.ratio },
    { metric: 'Session Duration', ratio: engagementGaps.duration.ratio },
    { metric: 'Messages/Session', ratio: engagementGaps.messagesPerSession.ratio },
    { metric: 'Total Sessions', ratio: engagementGaps.sessions.paid && engagementGaps.sessions.trial
        ? round(engagementGaps.sessions.paid / engagementGaps.sessions.trial, 1) : null },
  ].filter(g => g.ratio !== null).sort((a, b) => (b.ratio || 0) - (a.ratio || 0));

  return {
    totalRows: rows.length,
    totalUsers: Object.keys(allProfiles).length,
    statusCounts: {
      trial: byStatus.trial.length,
      active: byStatus.active.length,
      free: byStatus.free.length,
      cancelled: byStatus.cancelled.length,
      unknown: byStatus.unknown.length,
    },
    trialProfiles: byStatus.trial,
    paidProfiles: byStatus.active,
    cancelledProfiles: byStatus.cancelled,
    trialSegments: {
      high_engagement_no_convert: trialSegments.high_engagement_no_convert.length,
      moderate_fading: trialSegments.moderate_fading.length,
      single_session: trialSegments.single_session.length,
      active_trial: trialSegments.active_trial.length,
      expired_lapsed: trialSegments.expired_lapsed.length,
    },
    trialMetrics,
    paidMetrics,
    cancelledMetrics,
    engagementGaps,
    strongestPredictor: gaps[0] || null,
    medianDaysToConvert: median(daysToConvert),
    daysToConvertDistribution: daysToConvert,
  };
}

function getTopN(arr, n) {
  const counts = {};
  for (const v of arr) {
    if (v && v !== 'NaN') counts[v] = (counts[v] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([value, count]) => ({ value, count }));
}

function getDistribution(arr) {
  const counts = {};
  for (const v of arr) {
    if (v && v !== 'NaN') counts[v] = (counts[v] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }));
}

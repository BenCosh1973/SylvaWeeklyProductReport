import type {
  UxcamEvent,
  FunnelStep,
  DropoffCohort,
  TrialUserProfile,
  PaidUserProfile,
  TrialSegmentation,
  EngagementComparison,
  ConversionBlocker,
  SanityCheckResult,
  BaselineMetrics,
  SubFunnelStep,
  ScreenMetrics,
  FuzzyMatch,
  RevenueCatConversion,
  RevenueCatRetentionCohort,
} from './types.js';

import type { ParsedCsvFile } from './csv-reader.js';
import type { ChatDigestRow } from './pipelines/chat-digest-segmentation.js';
import type { SessionRecord, UserRecord, DropoffCohortAnalysis } from './pipelines/dropoff-analysis.js';
import type { ScreenRow } from './pipelines/screen-analysis.js';
import type { OnboardingFunnelResult } from './pipelines/onboarding-funnel.js';
import type { SubscriptionFunnelResult } from './pipelines/subscription-funnel.js';

import { parsePythonDict, extractScreen } from './parsers/uxcam-property-parser.js';
import { parseConversionCsv, parseRetentionCsv, parseSimpleCsv } from './parsers/revenuecat-parser.js';

import { segmentChatUsers, normalizeSubscriptionStatus } from './pipelines/chat-digest-segmentation.js';
import { buildTrialProfile, segmentTrialUsers } from './pipelines/trial-profile-builder.js';
import { buildPaidProfile, compareTrialVsPaid } from './pipelines/paid-profile-builder.js';
import { buildOnboardingFunnel } from './pipelines/onboarding-funnel.js';
import { buildSubscriptionFunnel } from './pipelines/subscription-funnel.js';
import { analyseDropoffCohort } from './pipelines/dropoff-analysis.js';
import { analyseSubscriptionScreens } from './pipelines/screen-analysis.js';
import { fuzzyMatchUsers } from './pipelines/fuzzy-matching.js';
import { classifyConversionBlockers } from './pipelines/blocker-classification.js';
import { runSanityChecks } from './pipelines/sanity-checks.js';
import { calculateBaselineMetrics } from './pipelines/baseline-metrics.js';

import type { DataSourceType } from './types.js';

// === Report Output Shape ===

export interface AnalysisReport {
  weekLabel: string;
  analyzedAt: string;

  // Chat Digest
  chatSegments: { trial: string[]; active: string[]; free: string[]; cancelled: string[]; unknown: string[] } | null;
  trialProfiles: Map<string, TrialUserProfile>;
  paidProfiles: Map<string, PaidUserProfile>;
  trialSegmentation: TrialSegmentation | null;
  engagementComparison: EngagementComparison[];
  strongestPredictor: string;
  strongestGap: number;

  // UXCam
  onboardingFunnel: OnboardingFunnelResult | null;
  subscriptionFunnel: SubscriptionFunnelResult | null;
  dropoffAnalyses: Map<string, DropoffCohortAnalysis>;
  screenMetrics: ScreenMetrics[];
  fuzzyMatches: FuzzyMatch[];

  // RevenueCat
  conversionData: RevenueCatConversion[];
  retentionCohorts: RevenueCatRetentionCohort[];
  rcActiveSubs: number;
  rcMrr: number;
  rcNewCustomers: number;
  rcNewPaying: number;
  adjustW1Retention: number;

  // Analysis
  conversionBlockers: ConversionBlocker[];
  sanityChecks: SanityCheckResult[];
  baselineMetrics: BaselineMetrics;
}

// === Helpers to parse rows ===

function parseChatDigestRows(rows: Record<string, string>[]): ChatDigestRow[] {
  return rows.map(r => ({
    userId: r['user id'] ?? r['user_id'] ?? '',
    timestamp: r['timestamp'] ?? '',
    subscriptionStatus: r['subscription status'] ?? r['subscription_status'] ?? '',
    csat: r['csat'] ? parseFloat(r['csat']) || null : null,
    messageCount: parseInt(r['message count'] ?? r['message_count'] ?? '0', 10) || 0,
    durationMin: parseFloat(r['duration (min)'] ?? r['duration_min'] ?? '0') || 0,
    topic: r['topic'] ?? '',
    emotionsBefore: r['emotions before'] ?? r['emotions_before'] ?? '',
    emotionsAfter: r['emotions after'] ?? r['emotions_after'] ?? '',
    pss10Before: r['pss10 before'] ? parseFloat(r['pss10 before']) : (r['pss10_before'] ? parseFloat(r['pss10_before']) : null),
    pss10After: r['pss10 after'] ? parseFloat(r['pss10 after']) : (r['pss10_after'] ? parseFloat(r['pss10_after']) : null),
    reliefVelocity: r['relief velocity'] ?? r['relief_velocity'] ?? '',
    testsCompletedCount: parseInt(r['tests completed count'] ?? r['tests_completed_count'] ?? '0', 10) || 0,
    testsCompletedNames: r['tests completed names'] ?? r['tests_completed_names'] ?? '',
    strategies: r['strategies'] ?? '',
    sessionCount: parseInt(r['session count'] ?? r['session_count'] ?? '0', 10) || 0,
    trialStartDate: r['trial start date'] ?? r['trial_start_date'] ?? '',
    subscriptionStartDate: r['subscription start date'] ?? r['subscription_start_date'] ?? '',
    model: r['model'] ?? '',
    totalCost: parseFloat(r['total cost'] ?? r['total_cost'] ?? '0') || 0,
    kidscreen27Score: r['kidscreen27 score'] ? parseFloat(r['kidscreen27 score']) : (r['kidscreen27_score'] ? parseFloat(r['kidscreen27_score']) : null),
  }));
}

function parseUxcamEvents(rows: Record<string, string>[]): UxcamEvent[] {
  return rows.map(r => {
    const parsed = parsePythonDict(r['property'] ?? '');
    const screenFromProp = extractScreen(r['property'] ?? '');
    return {
      sessionid: r['sessionid'] ?? '',
      eventname: r['eventname'] ?? '',
      property: r['property'] ?? '',
      trackedon: r['trackedon'] ?? '',
      uxcamuserid: r['uxcamuserid'] ?? '',
      screen_name: screenFromProp || '',
      real_screen: screenFromProp || '',
      parsed_property: parsed,
    };
  });
}

function parseUxcamSessions(rows: Record<string, string>[]): SessionRecord[] {
  return rows.map(r => ({
    sessionid: r['sessionid'] ?? '',
    uxcamuserid: r['uxcamuserid'] ?? '',
    totalsessiontime: parseFloat(r['totalsessiontime'] ?? '0') || 0,
    ragegesturecount: parseInt(r['ragegesturecount'] ?? '0', 10) || 0,
    locationcountry: r['locationcountry'] ?? '',
    locationcity: r['locationcity'] ?? '',
  }));
}

function parseUxcamUsers(rows: Record<string, string>[]): UserRecord[] {
  return rows.map(r => ({
    uxcamuserid: r['uxcamuserid'] ?? '',
    country: r['country'] ?? '',
    totalsession: parseInt(r['totalsession'] ?? '0', 10) || 0,
    totalsessiontime: parseFloat(r['totalsessiontime'] ?? '0') || 0,
    subscriptionstatus: r['u__subscriptionstatus'] ?? r['u__subscription_status'] ?? '',
    signupsource: r['u__signupsource'] ?? '',
    flow: r['u__flow'] ?? '',
  }));
}

function parseUxcamScreens(rows: Record<string, string>[]): ScreenRow[] {
  return rows.map(r => ({
    screen_name: r['screen_name'] ?? '',
    totalsession: parseInt(r['totalsession'] ?? '0', 10) || 0,
    totalbounce: parseInt(r['totalbounce'] ?? '0', 10) || 0,
    totalengagementtimemedian: parseFloat(r['totalengagementtimemedian'] ?? '0') || 0,
    totalrage: parseInt(r['totalrage'] ?? '0', 10) || 0,
    totalexit: parseInt(r['totalexit'] ?? '0', 10) || 0,
    totalopen: parseInt(r['totalopen'] ?? '0', 10) || 0,
  }));
}

// === Main Orchestrator ===

export function runAnalysis(
  filesByType: Map<DataSourceType, ParsedCsvFile>,
  weekLabel: string,
  todayDate: Date = new Date(),
  trialLengthDays: number = 7,
  filterProject: string = 'Sylva'
): AnalysisReport {
  // --- Parse raw data ---
  const chatDigestFile = filesByType.get('chat_digests');
  const chatDigestRows = chatDigestFile ? parseChatDigestRows(chatDigestFile.rows) : [];

  const uxcamEventFile = filesByType.get('uxcam_events');
  const uxcamEvents = uxcamEventFile ? parseUxcamEvents(uxcamEventFile.rows) : [];

  const uxcamSessionFile = filesByType.get('uxcam_sessions');
  const uxcamSessions = uxcamSessionFile ? parseUxcamSessions(uxcamSessionFile.rows) : [];

  const uxcamUserFile = filesByType.get('uxcam_users');
  const uxcamUsers = uxcamUserFile ? parseUxcamUsers(uxcamUserFile.rows) : [];

  const uxcamScreenFile = filesByType.get('uxcam_screens');
  const screenRows = uxcamScreenFile ? parseUxcamScreens(uxcamScreenFile.rows) : [];

  const rcConversionFile = filesByType.get('revenuecat_conversion');
  const conversionData = rcConversionFile
    ? parseConversionCsv(rcConversionFile.rawRows, filterProject)
    : [];

  const rcRetentionFile = filesByType.get('revenuecat_retention');
  const retentionCohorts = rcRetentionFile
    ? parseRetentionCsv(rcRetentionFile.rawRows.slice(1))
    : [];

  const rcActiveSubsFile = filesByType.get('revenuecat_active_subs');
  const rcActiveSubsData = rcActiveSubsFile
    ? parseSimpleCsv(rcActiveSubsFile.rawRows.slice(1), filterProject)
    : [];
  const rcActiveSubs = rcActiveSubsData.length > 0
    ? rcActiveSubsData[rcActiveSubsData.length - 1].value
    : 0;

  const rcMrrFile = filesByType.get('revenuecat_mrr');
  const rcMrrData = rcMrrFile
    ? parseSimpleCsv(rcMrrFile.rawRows.slice(1), filterProject)
    : [];
  const rcMrr = rcMrrData.length > 0
    ? rcMrrData[rcMrrData.length - 1].value
    : 0;

  const rcNewCustFile = filesByType.get('revenuecat_new_customers');
  const rcNewCustData = rcNewCustFile
    ? parseSimpleCsv(rcNewCustFile.rawRows.slice(1), filterProject)
    : [];
  const rcNewCustomers = rcNewCustData.length > 0
    ? rcNewCustData[rcNewCustData.length - 1].value
    : 0;

  // New paying from conversion data
  const rcNewPaying = conversionData.length > 0
    ? conversionData[conversionData.length - 1].paying
    : 0;

  // Adjust W1 retention from adjust_weekly if available
  const adjustFile = filesByType.get('adjust_weekly');
  let adjustW1Retention = 0;
  if (adjustFile && adjustFile.rows.length > 0) {
    const lastRow = adjustFile.rows[adjustFile.rows.length - 1];
    adjustW1Retention = parseFloat(lastRow['retention_rate_w1'] ?? '0') || 0;
  }

  // --- Chat Digest Pipelines ---
  const chatSegments = chatDigestRows.length > 0 ? segmentChatUsers(chatDigestRows) : null;

  // Group chat rows by user
  const chatByUser = new Map<string, ChatDigestRow[]>();
  for (const r of chatDigestRows) {
    const arr = chatByUser.get(r.userId) ?? [];
    arr.push(r);
    chatByUser.set(r.userId, arr);
  }

  // Build trial profiles (trial + free + unknown users)
  const trialProfiles = new Map<string, TrialUserProfile>();
  if (chatSegments) {
    const trialUserIds = [...chatSegments.trial, ...chatSegments.free, ...chatSegments.unknown];
    for (const uid of trialUserIds) {
      const userChats = chatByUser.get(uid) ?? [];
      if (userChats.length > 0) {
        trialProfiles.set(uid, buildTrialProfile(uid, userChats, todayDate, trialLengthDays));
      }
    }
  }

  // Build paid profiles
  const paidProfiles = new Map<string, PaidUserProfile>();
  if (chatSegments) {
    for (const uid of chatSegments.active) {
      const userChats = chatByUser.get(uid) ?? [];
      if (userChats.length > 0) {
        paidProfiles.set(uid, buildPaidProfile(uid, userChats, todayDate));
      }
    }
  }

  // Segment trial users
  const trialSegmentation = trialProfiles.size > 0
    ? segmentTrialUsers(trialProfiles, todayDate)
    : null;

  // Engagement comparison
  const { comparison: engagementComparison, strongestPredictor, strongestGap } =
    trialProfiles.size > 0 && paidProfiles.size > 0
      ? compareTrialVsPaid(trialProfiles, paidProfiles)
      : { comparison: [], strongestPredictor: 'none', strongestGap: 0 };

  // --- UXCam Pipelines ---
  const onboardingFunnel = uxcamEvents.length > 0
    ? buildOnboardingFunnel(uxcamEvents)
    : null;

  const subscriptionFunnel = uxcamEvents.length > 0
    ? buildSubscriptionFunnel(uxcamEvents)
    : null;

  // Dropoff analysis per cohort
  const dropoffAnalyses = new Map<string, DropoffCohortAnalysis>();
  if (onboardingFunnel) {
    const eventData = uxcamEvents.map(e => ({
      uxcamuserid: e.uxcamuserid,
      sessionid: e.sessionid,
      real_screen: e.real_screen,
      eventname: e.eventname,
    }));
    for (const cohort of onboardingFunnel.dropoffs) {
      dropoffAnalyses.set(
        cohort.stepLabel,
        analyseDropoffCohort(cohort.userIds, eventData, uxcamSessions, uxcamUsers)
      );
    }
  }

  // Screen analysis
  const screenMetrics = analyseSubscriptionScreens(screenRows);

  // Fuzzy matching
  const chatUsersForMatch = chatSegments
    ? [...new Set([...chatSegments.trial, ...chatSegments.active])].map(uid => {
        const chats = chatByUser.get(uid) ?? [];
        const status = normalizeSubscriptionStatus(chats[0]?.subscriptionStatus);
        return {
          userId: uid,
          subscriptionStatus: status,
          trialStartDate: chats[0]?.trialStartDate || null,
          sessionCount: chats.length,
        };
      })
    : [];

  const uxcamUsersForMatch = uxcamUsers.map(u => ({
    uxcamuserid: u.uxcamuserid,
    subscriptionStatus: u.subscriptionstatus,
    totalSessions: u.totalsession,
    firstSeen: null as string | null,
  }));

  const fuzzyMatches = fuzzyMatchUsers(chatUsersForMatch, uxcamUsersForMatch);

  // --- Blocker Classification ---
  const conversionBlockers = trialSegmentation && subscriptionFunnel
    ? classifyConversionBlockers(
        trialSegmentation,
        trialProfiles,
        paidProfiles,
        subscriptionFunnel.funnel,
        screenMetrics,
        engagementComparison,
        strongestPredictor,
        strongestGap
      )
    : [];

  // --- Sanity Checks ---
  const funnelTable = onboardingFunnel?.funnelTable ?? [];
  const subFunnel = subscriptionFunnel?.funnel ?? [];
  const sanityChecks = runSanityChecks({
    funnelTable,
    subFunnel,
    trialProfiles,
    paidProfiles,
    rcActiveSubs,
    events: uxcamEvents.map(e => ({ uxcamuserid: e.uxcamuserid })),
    userFileUserIds: uxcamUsers.map(u => u.uxcamuserid),
    sessions: uxcamSessions.map(s => ({ totalsessiontime: s.totalsessiontime, locationcountry: s.locationcountry })),
    chatDigestPss10: chatDigestRows.map(r => ({ before: r.pss10Before, after: r.pss10After })),
    chatDigestTests: chatDigestRows.map(r => ({
      userId: r.userId,
      testsCompleted: r.testsCompletedCount,
      timestamp: r.timestamp,
    })),
  });

  // --- Baseline Metrics ---
  const chatSessions = chatDigestRows.length;
  const chatUniqueUsers = new Set(chatDigestRows.map(r => r.userId)).size;

  const baselineMetrics = calculateBaselineMetrics({
    weekEnding: weekLabel,
    funnelTable,
    dropoffs: onboardingFunnel?.dropoffs ?? [],
    rcActiveSubs,
    rcMrr,
    rcNewCustomers,
    rcNewPaying,
    adjustW1Retention,
    chatSessions,
    chatUniqueUsers,
    trialProfiles,
    paidProfiles,
  });

  return {
    weekLabel,
    analyzedAt: todayDate.toISOString(),
    chatSegments,
    trialProfiles,
    paidProfiles,
    trialSegmentation,
    engagementComparison,
    strongestPredictor,
    strongestGap,
    onboardingFunnel,
    subscriptionFunnel,
    dropoffAnalyses,
    screenMetrics,
    fuzzyMatches,
    conversionData,
    retentionCohorts,
    rcActiveSubs,
    rcMrr,
    rcNewCustomers,
    rcNewPaying,
    adjustW1Retention,
    conversionBlockers,
    sanityChecks,
    baselineMetrics,
  };
}

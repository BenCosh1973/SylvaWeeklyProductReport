// === Data Source Types ===

export type DataSourceType =
  | 'uxcam_events'
  | 'uxcam_users'
  | 'uxcam_sessions'
  | 'uxcam_screens'
  | 'revenuecat_conversion'
  | 'revenuecat_retention'
  | 'revenuecat_active_subs'
  | 'revenuecat_mrr'
  | 'revenuecat_new_customers'
  | 'adjust_daily'
  | 'adjust_weekly'
  | 'adjust_monthly'
  | 'adjust_country'
  | 'chat_digests'
  | 'icp_challenges'
  | 'trial_durations'
  | 'uxcam_session_list'
  | 'unknown';

export interface ClassifiedFile {
  filename: string;
  sourceType: DataSourceType;
  rowCount: number;
  dateRange: { start: string; end: string } | null;
  headers: string[];
}

// === UXCam Event Types ===

export interface ParsedProperty {
  screen_name?: string;
  screen_class?: string;
  from_page?: string;
  flow_type?: string;
  plan?: string;
  price?: string;
  [key: string]: unknown;
}

export interface UxcamEvent {
  sessionid: string;
  eventname: string;
  property: string;
  trackedon: string;
  uxcamuserid: string;
  screen_name: string;
  real_screen: string;
  parsed_property: ParsedProperty;
}

// === Funnel Types ===

export const ONBOARDING_FUNNEL_STEPS = [
  { step: 1, event: 'get_started_click' },
  { step: 2, event: 'onboarding_user_step_name' },
  { step: 3, event: 'onboarding_user_step_challenges' },
  { step: 4, event: 'signup_sms_auth_viewed' },
  { step: 5, event: 'signup_sms_pin_entered' },
  { step: 6, event: 'signup_complete' },
  { step: 7, event: 'trial_start' },
] as const;

export const SUBSCRIPTION_FUNNEL_STEPS = [
  'trial_start',
  'subscription_pricing_viewed',
  'subscription_plan_selected',
  'subscription_purchase_started',
  'subscription_payment_viewed',
  'subscription_completed',
  'subscription_started',
] as const;

export interface FunnelStep {
  step: string;
  usersReached: number;
  droppedHere: number;
  dropPct: number;
  conversionFromPrev: number;
}

export interface DropoffCohort {
  stepNum: number;
  stepLabel: string;
  count: number;
  pctOfTotal: number;
  userIds: string[];
}

// === User Profile Types ===

export type SubscriptionStatus = 'trial' | 'active' | 'free' | 'cancelled' | 'unknown';

export interface TrialUserProfile {
  userId: string;
  totalSessions: number;
  firstChat: string;
  lastChat: string;
  daysActive: number;
  trialStartDate: string | null;
  daysSinceTrialStart: number | null;
  trialLengthDays: number;
  meanCsat: number | null;
  meanMsgCount: number;
  meanDurationMin: number;
  totalMessages: number;
  topics: string[];
  testsCompleted: number;
  testsNames: string | null;
  pss10Before: number | null;
  pss10After: number | null;
  pss10Change: number | null;
  emotionsBefore: string | null;
  emotionsAfter: string | null;
  reliefVelocity: string | null;
}

export type TrialSegment =
  | 'high_engagement_no_convert'
  | 'moderate_fading'
  | 'single_session'
  | 'active_trial'
  | 'expired_lapsed';

export interface TrialSegmentation {
  high_engagement_no_convert: string[];
  moderate_fading: string[];
  single_session: string[];
  active_trial: string[];
  expired_lapsed: string[];
}

export interface PaidUserProfile extends TrialUserProfile {
  subscriptionStartDate: string | null;
  daysTrialToPaid: number | null;
}

export interface EngagementComparison {
  metric: string;
  trialMedian: number | null;
  paidMedian: number | null;
  gapRatio: number | null;
}

// === Subscription Funnel Types ===

export interface SubFunnelStep {
  step: string;
  uniqueUsers: number;
  userIds: string[];
  totalEvents: number;
}

export interface ScreenMetrics {
  screenName: string;
  totalSessions: number;
  bounceRate: number;
  medianEngagementTime: number;
  totalRage: number;
  totalExits: number;
}

// === Fuzzy Matching Types ===

export interface FuzzyMatch {
  chatDigestUserId: string;
  uxcamUserId: string;
  confidence: number;
  matchedOn: string[];
}

// === RevenueCat Types ===

export interface RevenueCatConversion {
  date: string;
  newCustomers: number;
  paying: number;
  conversionRate: number;
}

export interface RevenueCatRetentionCohort {
  cohort: string;
  subscriptions: number;
  months: (number | null)[];
}

// === Blocker Types ===

export type BlockerCategory =
  | 'value_delivery'
  | 'value_awareness'
  | 'pricing_timing'
  | 'trial_expiration';

export type BlockerSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ConversionBlocker {
  category: BlockerCategory;
  title: string;
  evidence: string;
  severity: BlockerSeverity;
}

// === Action Types ===

export type Priority = 'P0' | 'P1' | 'P2';

export interface PriorityAction {
  priority: Priority;
  what: string;
  why: string;
  who: string;
  when: string;
  expectedImpact: string;
}

// === Sanity Check Types ===

export type CheckLevel = 'PASS' | 'WARN' | 'FAIL';

export interface SanityCheckResult {
  check: string;
  level: CheckLevel;
  message: string;
}

// === Week / Date Types ===

export interface WeekRange {
  start: Date; // Saturday midnight UK
  end: Date;   // Saturday midnight UK
}

// === Baseline Metrics ===

export interface BaselineMetrics {
  weekEnding: string;
  activeSubs: number;
  mrr: number;
  newCustomers: number;
  newPaying: number;
  w1Retention: number;
  uxcamUsersTracked: number;
  funnelCounts: number[];
  topDropoff: { label: string; count: number };
  chatSessions: number;
  chatUniqueUsers: number;
  trialMedianSessions: number;
  trialMedianMsgPerSession: number;
  trialMedianDuration: number;
  trialMedianTests: number;
  paidMedianSessions: number;
  paidMedianMsgPerSession: number;
  paidMedianDuration: number;
  paidMedianTests: number;
}

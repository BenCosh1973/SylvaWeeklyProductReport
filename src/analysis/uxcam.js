/**
 * UXCam Analysis — Steps 5, 6 of the prompt.
 * Analyses subscription funnel events, screen metrics, and user sessions.
 */
import { readCSV, num, median, mean, round } from './csvReader.js';

/**
 * Parse the property column (Python dict string) to extract details.
 */
function parseProperty(propStr) {
  if (!propStr || propStr === 'NaN' || propStr === '{}') return {};
  try {
    // Convert Python-style dict to JSON: True→true, False→false, None→null, single→double quotes
    let json = propStr
      .replace(/'/g, '"')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null');
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/**
 * Analyse UXCam event-level data for subscription funnel.
 */
export async function analyzeUXCamEvents(filePath) {
  const rows = await readCSV(filePath);
  if (rows.length === 0) return { error: 'No UXCam event data', rows: 0 };

  // Subscription-related event names
  const FUNNEL_EVENTS = [
    'trial_start',
    'subscription_pricing_viewed',
    'subscription_plan_selected',
    'subscription_purchase_started',
    'subscription_payment_viewed',
    'subscription_completed',
    'subscription_started',
    'chat_trial_start_modal_visible',
  ];

  // Parse all events and group by event name
  const eventsByName = {};
  const eventsByUser = {};
  for (const row of rows) {
    const eventName = row['eventname'] || row['event_name'];
    const userId = row['uxcamuserid'];
    const props = parseProperty(row['property']);
    const trackedOn = row['trackedon'];
    const screenName = row['screen_name'];

    const event = { eventName, userId, props, trackedOn, screenName, raw: row };

    if (!eventsByName[eventName]) eventsByName[eventName] = [];
    eventsByName[eventName].push(event);

    if (!eventsByUser[userId]) eventsByUser[userId] = [];
    eventsByUser[userId].push(event);
  }

  // Build subscription funnel
  const funnel = {};
  for (const eventName of FUNNEL_EVENTS) {
    const events = eventsByName[eventName] || [];
    const uniqueUsers = new Set(events.map(e => e.userId));
    funnel[eventName] = {
      totalEvents: events.length,
      uniqueUsers: uniqueUsers.size,
      userIds: [...uniqueUsers],
    };
  }

  // Calculate drop rates between funnel steps
  const funnelSteps = [
    'trial_start',
    'subscription_pricing_viewed',
    'subscription_plan_selected',
    'subscription_purchase_started',
    'subscription_payment_viewed',
    'subscription_completed',
  ];

  const funnelWithDropRates = [];
  for (let i = 0; i < funnelSteps.length; i++) {
    const step = funnelSteps[i];
    const data = funnel[step] || { totalEvents: 0, uniqueUsers: 0, userIds: [] };
    const prevUsers = i > 0 ? (funnel[funnelSteps[i - 1]]?.uniqueUsers || 0) : data.uniqueUsers;
    const dropRate = prevUsers > 0
      ? round((1 - data.uniqueUsers / prevUsers) * 100, 1)
      : null;

    funnelWithDropRates.push({
      step,
      ...data,
      dropRate,
      dropFromPrevious: prevUsers > 0 ? prevUsers - data.uniqueUsers : 0,
    });
  }

  // Analyse from_page on subscription events
  const fromPageAnalysis = {};
  for (const eventName of ['subscription_pricing_viewed', 'subscription_plan_selected', 'subscription_purchase_started']) {
    const events = eventsByName[eventName] || [];
    const fromPages = {};
    for (const e of events) {
      const fromPage = e.props.from_page || e.props.fromPage || 'unknown';
      fromPages[fromPage] = (fromPages[fromPage] || 0) + 1;
    }
    fromPageAnalysis[eventName] = fromPages;
  }

  // Trial start modal analysis
  const trialModals = eventsByName['chat_trial_start_modal_visible'] || [];
  const modalContexts = {};
  for (const e of trialModals) {
    const chatbot = e.props.chatbot || 'unknown';
    const modalType = e.props.modal_type || 'unknown';
    const key = `${chatbot}/${modalType}`;
    modalContexts[key] = (modalContexts[key] || 0) + 1;
  }

  return {
    totalEvents: rows.length,
    uniqueEventNames: Object.keys(eventsByName),
    subscriptionFunnel: funnelWithDropRates,
    funnelRaw: funnel,
    fromPageAnalysis,
    trialModalContexts: modalContexts,
    chatTrialStartModalCount: trialModals.length,
  };
}

/**
 * Analyse UXCam user-level data.
 */
export async function analyzeUXCamUsers(filePath) {
  const rows = await readCSV(filePath);
  if (rows.length === 0) return { error: 'No UXCam user data', rows: 0 };

  const byStatus = { paid: [], trial_started: [], cancelled: [], none: [] };
  for (const row of rows) {
    const status = (row['u__subscriptionstatus'] || row['u__subscription_status'] || '').toLowerCase().trim();
    if (status === 'paid') byStatus.paid.push(row);
    else if (status === 'trial_started') byStatus.trial_started.push(row);
    else if (status === 'cancelled') byStatus.cancelled.push(row);
    else byStatus.none.push(row);
  }

  const summarizeGroup = (group) => ({
    count: group.length,
    medianTotalSessions: median(group.map(r => num(r['totalsession']))),
    medianTotalSessionTime: median(group.map(r => num(r['totalsessiontime']))),
    userIds: group.map(r => r['uxcamuserid']),
  });

  return {
    totalUsers: rows.length,
    statusCounts: {
      paid: byStatus.paid.length,
      trial_started: byStatus.trial_started.length,
      cancelled: byStatus.cancelled.length,
      none: byStatus.none.length,
    },
    paidUsers: summarizeGroup(byStatus.paid),
    trialUsers: summarizeGroup(byStatus.trial_started),
    cancelledUsers: summarizeGroup(byStatus.cancelled),
  };
}

/**
 * Analyse UXCam session-level data.
 */
export async function analyzeUXCamSessions(filePath) {
  const rows = await readCSV(filePath);
  if (rows.length === 0) return { error: 'No UXCam session data', rows: 0 };

  return {
    totalSessions: rows.length,
    medianSessionTime: median(rows.map(r => num(r['totalsessiontime']))),
    sessionsWithRageGestures: rows.filter(r => num(r['ragegesturecount']) > 0).length,
    totalRageGestures: rows.reduce((sum, r) => sum + (num(r['ragegesturecount']) || 0), 0),
  };
}

/**
 * Analyse UXCam screen-level data.
 */
export async function analyzeUXCamScreens(filePath) {
  const rows = await readCSV(filePath);
  if (rows.length === 0) return { error: 'No UXCam screen data', rows: 0 };

  const TARGET_SCREENS = ['/subscribe', '/trial-start', '/chat', '/settings'];
  const screenMetrics = {};

  for (const row of rows) {
    const screenName = (row['screen_name'] || '').trim();
    // Match target screens (partial match)
    for (const target of TARGET_SCREENS) {
      if (screenName.toLowerCase().includes(target.replace('/', ''))) {
        screenMetrics[target] = {
          screenName,
          totalSessions: num(row['totalsession']),
          totalBounce: num(row['totalbounce']),
          medianEngagementTime: num(row['totalengagementtimemedian']),
          bounceRate: num(row['totalsession']) > 0
            ? round((num(row['totalbounce']) || 0) / num(row['totalsession']) * 100, 1)
            : null,
        };
      }
    }
  }

  return {
    totalScreens: rows.length,
    targetScreens: screenMetrics,
    allScreens: rows.map(r => ({
      screenName: r['screen_name'],
      sessions: num(r['totalsession']),
      bounceRate: num(r['totalsession']) > 0
        ? round((num(r['totalbounce']) || 0) / num(r['totalsession']) * 100, 1)
        : null,
      engagementTime: num(r['totalengagementtimemedian']),
    })),
  };
}

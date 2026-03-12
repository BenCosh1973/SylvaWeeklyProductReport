import { median } from '../utils/stats.js';

export interface SessionRecord {
  sessionid: string;
  uxcamuserid: string;
  totalsessiontime: number;
  ragegesturecount: number;
  locationcountry: string;
  locationcity?: string;
}

export interface UserRecord {
  uxcamuserid: string;
  country: string;
  totalsession: number;
  totalsessiontime: number;
  subscriptionstatus: string;
  signupsource?: string;
  flow?: string;
}

export interface DropoffUserDetail {
  userId: string;
  sessionIds: string[];
  sessionCount: number;
  totalSessionTimeSec: number;
  rageGestures: number;
  country: string;
  city: string;
  screensVisited: string[];
  eventsTriggered: string[];
  subscriptionStatus: string;
}

export interface DropoffCohortAnalysis {
  userCount: number;
  medianSessionTime: number | null;
  medianSessionCount: number | null;
  totalRageGestures: number;
  geoBreakdown: Record<string, number>;
  userDetails: DropoffUserDetail[];
}

export function analyseDropoffCohort(
  userIds: string[],
  events: { uxcamuserid: string; sessionid: string; real_screen: string; eventname: string }[],
  sessions: SessionRecord[],
  users: UserRecord[]
): DropoffCohortAnalysis {
  if (userIds.length === 0) {
    return { userCount: 0, medianSessionTime: null, medianSessionCount: null, totalRageGestures: 0, geoBreakdown: {}, userDetails: [] };
  }

  const sessionsByUser = new Map<string, SessionRecord[]>();
  for (const s of sessions) {
    const arr = sessionsByUser.get(s.uxcamuserid) ?? [];
    arr.push(s);
    sessionsByUser.set(s.uxcamuserid, arr);
  }

  const userMap = new Map<string, UserRecord>();
  for (const u of users) {
    userMap.set(u.uxcamuserid, u);
  }

  const eventsByUser = new Map<string, typeof events>();
  for (const e of events) {
    const arr = eventsByUser.get(e.uxcamuserid) ?? [];
    arr.push(e);
    eventsByUser.set(e.uxcamuserid, arr);
  }

  const userDetails: DropoffUserDetail[] = [];
  const perUserTotalTime: number[] = [];
  const perUserSessionCount: number[] = [];
  let totalRageGestures = 0;
  const geoBreakdown: Record<string, number> = {};

  for (const uid of userIds) {
    const userSessions = sessionsByUser.get(uid) ?? [];
    const userEvents = eventsByUser.get(uid) ?? [];
    const userRec = userMap.get(uid);

    const sessionIds = [...new Set(userSessions.map(s => s.sessionid))];
    // Also include session IDs from events
    for (const e of userEvents) {
      if (!sessionIds.includes(e.sessionid)) sessionIds.push(e.sessionid);
    }

    const totalTime = userSessions.reduce((sum, s) => sum + s.totalsessiontime, 0);
    const rage = userSessions.reduce((sum, s) => sum + s.ragegesturecount, 0);
    const country = userRec?.country ?? (userSessions[0]?.locationcountry ?? 'unknown');
    const city = userSessions[0]?.locationcity ?? '';
    const screens = [...new Set(userEvents.map(e => e.real_screen).filter(Boolean))];
    const eventNames = [...new Set(userEvents.map(e => e.eventname))];
    const subStatus = userRec?.subscriptionstatus ?? '';

    perUserTotalTime.push(totalTime);
    perUserSessionCount.push(userSessions.length);
    totalRageGestures += rage;

    geoBreakdown[country] = (geoBreakdown[country] ?? 0) + 1;

    userDetails.push({
      userId: uid,
      sessionIds,
      sessionCount: userSessions.length,
      totalSessionTimeSec: totalTime,
      rageGestures: rage,
      country,
      city,
      screensVisited: screens,
      eventsTriggered: eventNames,
      subscriptionStatus: subStatus,
    });
  }

  return {
    userCount: userIds.length,
    medianSessionTime: median(perUserTotalTime),
    medianSessionCount: median(perUserSessionCount),
    totalRageGestures,
    geoBreakdown,
    userDetails,
  };
}

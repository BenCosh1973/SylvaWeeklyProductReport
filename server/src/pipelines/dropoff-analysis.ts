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
  throw new Error('Not implemented');
}

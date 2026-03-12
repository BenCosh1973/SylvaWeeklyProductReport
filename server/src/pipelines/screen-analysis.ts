import type { ScreenMetrics } from '../types.js';

export interface ScreenRow {
  screen_name: string;
  totalsession: number;
  totalbounce: number;
  totalengagementtimemedian: number;
  totalrage: number;
  totalexit: number;
  totalopen: number;
}

export function analyseSubscriptionScreens(rows: ScreenRow[]): ScreenMetrics[] {
  if (rows.length === 0) return [];

  return rows.map(r => ({
    screenName: r.screen_name,
    totalSessions: r.totalsession,
    bounceRate: r.totalsession > 0 ? (r.totalbounce / r.totalsession) * 100 : 0,
    medianEngagementTime: r.totalengagementtimemedian,
    totalRage: r.totalrage,
    totalExits: r.totalexit,
  }));
}

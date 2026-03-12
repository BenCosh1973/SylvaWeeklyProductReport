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
  throw new Error('Not implemented');
}

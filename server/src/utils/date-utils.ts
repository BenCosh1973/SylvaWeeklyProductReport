import type { WeekRange } from '../types.js';

export function getWeekRange(date: Date): WeekRange {
  throw new Error('Not implemented');
}

export function getPreviousWeekRange(weekRange: WeekRange): WeekRange {
  throw new Error('Not implemented');
}

export function isWithinRange(date: Date, range: WeekRange): boolean {
  throw new Error('Not implemented');
}

export function toUKMidnight(date: Date): Date {
  throw new Error('Not implemented');
}

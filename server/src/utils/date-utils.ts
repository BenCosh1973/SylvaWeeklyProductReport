import type { WeekRange } from '../types.js';

/**
 * Get the UK timezone offset in milliseconds for a given UTC date.
 * BST (UTC+1) runs from last Sunday of March 01:00 UTC to last Sunday of October 01:00 UTC.
 */
function getUKOffsetMs(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-indexed

  // Find last Sunday of March
  const mar31 = new Date(Date.UTC(year, 2, 31));
  const lastSunMar = 31 - ((mar31.getUTCDay()) % 7);
  const bstStart = Date.UTC(year, 2, lastSunMar, 1, 0, 0); // 01:00 UTC

  // Find last Sunday of October
  const oct31 = new Date(Date.UTC(year, 9, 31));
  const lastSunOct = 31 - ((oct31.getUTCDay()) % 7);
  const bstEnd = Date.UTC(year, 9, lastSunOct, 1, 0, 0); // 01:00 UTC

  const ts = date.getTime();
  if (ts >= bstStart && ts < bstEnd) {
    return 60 * 60 * 1000; // BST = UTC+1
  }
  return 0; // GMT = UTC+0
}

/**
 * Convert a date to UK midnight (start of that date in UK time), returned as a UTC Date.
 */
export function toUKMidnight(date: Date): Date {
  const offset = getUKOffsetMs(date);
  // Get the UK local date parts
  const ukTime = new Date(date.getTime() + offset);
  const y = ukTime.getUTCFullYear();
  const m = ukTime.getUTCMonth();
  const d = ukTime.getUTCDate();
  // Midnight UK time = that date minus offset
  return new Date(Date.UTC(y, m, d) - offset);
}

/**
 * Get the Saturday-to-Saturday week range containing the given date.
 * Week starts on Saturday midnight UK time (inclusive) and ends on the following Saturday midnight (exclusive).
 */
export function getWeekRange(date: Date): WeekRange {
  const offset = getUKOffsetMs(date);
  const ukTime = new Date(date.getTime() + offset);
  const ukDay = ukTime.getUTCDay(); // 0=Sun..6=Sat

  // If it's Saturday (6), this date IS the start of a new week
  // Otherwise, go back to the most recent Saturday
  const daysSinceSat = ukDay === 6 ? 0 : ((ukDay + 1) % 7);
  // Actually: Sun=0 → 1 day after Sat, Mon=1 → 2, ... Fri=5 → 6, Sat=6 → 0
  // daysSinceSat for day d: (d - 6 + 7) % 7 = (d + 1) % 7
  // Sun(0) → 1, Mon(1) → 2, Tue(2) → 3, Wed(3) → 4, Thu(4) → 5, Fri(5) → 6, Sat(6) → 0 ✓

  const startUkDate = new Date(Date.UTC(
    ukTime.getUTCFullYear(),
    ukTime.getUTCMonth(),
    ukTime.getUTCDate() - daysSinceSat
  ));
  const endUkDate = new Date(Date.UTC(
    startUkDate.getUTCFullYear(),
    startUkDate.getUTCMonth(),
    startUkDate.getUTCDate() + 7
  ));

  // Convert UK dates back to UTC by subtracting the offset at each boundary
  const startUtc = new Date(startUkDate.getTime() - getUKOffsetMs(new Date(startUkDate.getTime() - getUKOffsetMs(startUkDate))));
  const endUtc = new Date(endUkDate.getTime() - getUKOffsetMs(new Date(endUkDate.getTime() - getUKOffsetMs(endUkDate))));

  return { start: startUtc, end: endUtc };
}

/**
 * Get the week range immediately before the given week.
 */
export function getPreviousWeekRange(weekRange: WeekRange): WeekRange {
  const prevEnd = new Date(weekRange.start.getTime());
  const prevStart = new Date(prevEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { start: prevStart, end: prevEnd };
}

/**
 * Check if a date falls within a range [start, end).
 */
export function isWithinRange(date: Date, range: WeekRange): boolean {
  const ts = date.getTime();
  return ts >= range.start.getTime() && ts < range.end.getTime();
}

import { describe, it, expect } from 'vitest';
import { getWeekRange, getPreviousWeekRange, isWithinRange, toUKMidnight } from '../../utils/date-utils.js';

describe('Date Utilities', () => {
  // AC-WK-1: All date filtering uses UK timezone (Europe/London), accounting for BST/GMT transitions
  // AC-WK-2: Week runs Saturday midnight to Saturday midnight UK time

  describe('getWeekRange', () => {
    it('returns Sat-to-Sat range for a date in the middle of the week', () => {
      // Wednesday 2026-03-04 should give Sat Feb 28 → Sat Mar 7
      const date = new Date('2026-03-04T12:00:00Z');
      const range = getWeekRange(date);

      // Start should be Saturday 2026-02-28 00:00:00 UK time
      expect(range.start.toISOString()).toContain('2026-02-28');
      // End should be Saturday 2026-03-07 00:00:00 UK time
      expect(range.end.toISOString()).toContain('2026-03-07');
    });

    it('returns correct range when date is exactly on Saturday', () => {
      // Saturday 2026-03-07 should start a NEW week: Mar 7 → Mar 14
      const date = new Date('2026-03-07T00:00:00Z');
      const range = getWeekRange(date);
      expect(range.start.toISOString()).toContain('2026-03-07');
      expect(range.end.toISOString()).toContain('2026-03-14');
    });

    it('returns correct range for Friday (end of revenue cat week)', () => {
      // Friday 2026-03-06 → should be in the Sat Feb 28 – Sat Mar 7 week
      const date = new Date('2026-03-06T23:59:00Z');
      const range = getWeekRange(date);
      expect(range.start.toISOString()).toContain('2026-02-28');
      expect(range.end.toISOString()).toContain('2026-03-07');
    });

    it('handles BST transition correctly (last Sunday of March)', () => {
      // UK clocks go forward on last Sunday of March
      // 2026-03-29 is a Sunday, clocks go forward
      // A date on 2026-03-30 (Monday BST) should still compute Sat-Sat correctly
      const date = new Date('2026-03-30T12:00:00Z');
      const range = getWeekRange(date);

      // Should be Sat Mar 28 → Sat Apr 4
      expect(range.start.toISOString()).toContain('2026-03-28');
      expect(range.end.toISOString()).toContain('2026-04-04');
    });

    it('handles GMT transition correctly (last Sunday of October)', () => {
      // UK clocks go back on last Sunday of October
      // 2025-10-26 is the transition day
      const date = new Date('2025-10-27T12:00:00Z');
      const range = getWeekRange(date);

      // Should be Sat Oct 25 → Sat Nov 1
      expect(range.start.toISOString()).toContain('2025-10-25');
      expect(range.end.toISOString()).toContain('2025-11-01');
    });
  });

  describe('getPreviousWeekRange', () => {
    // AC-WK-3: WoW comparison auto-calculates the prior period of equal length

    it('returns the week immediately before the given week', () => {
      const currentWeek = {
        start: new Date('2026-03-07T00:00:00Z'),
        end: new Date('2026-03-14T00:00:00Z'),
      };
      const prevWeek = getPreviousWeekRange(currentWeek);
      expect(prevWeek.start.toISOString()).toContain('2026-02-28');
      expect(prevWeek.end.toISOString()).toContain('2026-03-07');
    });

    it('previous week end matches current week start', () => {
      const currentWeek = {
        start: new Date('2026-03-07T00:00:00Z'),
        end: new Date('2026-03-14T00:00:00Z'),
      };
      const prevWeek = getPreviousWeekRange(currentWeek);
      expect(prevWeek.end.getTime()).toBe(currentWeek.start.getTime());
    });
  });

  describe('isWithinRange', () => {
    const range = {
      start: new Date('2026-03-07T00:00:00Z'),
      end: new Date('2026-03-14T00:00:00Z'),
    };

    it('returns true for a date within the range', () => {
      expect(isWithinRange(new Date('2026-03-10T12:00:00Z'), range)).toBe(true);
    });

    it('returns true for the start boundary (inclusive)', () => {
      expect(isWithinRange(new Date('2026-03-07T00:00:00Z'), range)).toBe(true);
    });

    it('returns false for the end boundary (exclusive)', () => {
      expect(isWithinRange(new Date('2026-03-14T00:00:00Z'), range)).toBe(false);
    });

    it('returns false for a date before the range', () => {
      expect(isWithinRange(new Date('2026-03-06T23:59:59Z'), range)).toBe(false);
    });

    it('returns false for a date after the range', () => {
      expect(isWithinRange(new Date('2026-03-15T00:00:00Z'), range)).toBe(false);
    });
  });

  describe('toUKMidnight', () => {
    it('converts a UTC date to UK midnight', () => {
      // During GMT (winter), UK midnight = 00:00 UTC
      const result = toUKMidnight(new Date('2026-01-15T14:30:00Z'));
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it('accounts for BST offset (UK midnight = 23:00 UTC previous day)', () => {
      // During BST (summer), UK midnight = 23:00 UTC previous day
      const result = toUKMidnight(new Date('2026-07-15T14:30:00Z'));
      // The result should represent midnight UK time, which is 23:00 UTC
      // The date should still be July 15 in UK time
      expect(result.getUTCHours()).toBe(23);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { median, mostCommon, firstNonNull, lastNonNull } from '../../utils/stats.js';

describe('Statistics Utilities', () => {
  describe('median', () => {
    it('returns median of odd-length array', () => {
      expect(median([1, 3, 5])).toBe(3);
    });

    it('returns median of even-length array (average of middle two)', () => {
      expect(median([1, 3, 5, 7])).toBe(4);
    });

    it('returns the value for single-element array', () => {
      expect(median([42])).toBe(42);
    });

    it('returns null for empty array', () => {
      expect(median([])).toBeNull();
    });

    it('handles unsorted input', () => {
      expect(median([5, 1, 3])).toBe(3);
    });

    it('handles decimal values', () => {
      expect(median([1.5, 2.5, 3.5])).toBe(2.5);
    });
  });

  describe('mostCommon', () => {
    it('returns the most frequent value', () => {
      expect(mostCommon(['a', 'b', 'a', 'c', 'a'])).toBe('a');
    });

    it('returns first winner on ties', () => {
      const result = mostCommon(['a', 'b', 'a', 'b']);
      expect(['a', 'b']).toContain(result);
    });

    it('returns null for empty array', () => {
      expect(mostCommon([])).toBeNull();
    });

    it('works with numbers', () => {
      expect(mostCommon([1, 2, 2, 3])).toBe(2);
    });
  });

  describe('firstNonNull', () => {
    it('returns the first non-null value', () => {
      expect(firstNonNull([null, undefined, 42, 99])).toBe(42);
    });

    it('returns null when all values are null/undefined', () => {
      expect(firstNonNull([null, undefined, null])).toBeNull();
    });

    it('returns null for empty array', () => {
      expect(firstNonNull([])).toBeNull();
    });

    it('returns first element if not null', () => {
      expect(firstNonNull([1, 2, 3])).toBe(1);
    });
  });

  describe('lastNonNull', () => {
    it('returns the last non-null value', () => {
      expect(lastNonNull([42, null, 99, null])).toBe(99);
    });

    it('returns null when all values are null/undefined', () => {
      expect(lastNonNull([null, null])).toBeNull();
    });

    it('returns null for empty array', () => {
      expect(lastNonNull([])).toBeNull();
    });
  });
});

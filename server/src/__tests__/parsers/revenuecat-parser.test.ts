import { describe, it, expect } from 'vitest';
import { parseConversionCsv, parseRetentionCsv, parseSimpleCsv } from '../../parsers/revenuecat-parser.js';

describe('RevenueCat CSV Parser', () => {
  describe('parseConversionCsv', () => {
    // Triple-column format: Project | Total | Total | Total | Sylva | Sylva | Sylva | ...
    // Sub-headers: Report Date | New Customers | Paying Customers | Conversion Rate | ...

    it('parses triple-column conversion data and filters to Sylva', () => {
      const rows = [
        // Row 0 = sub-headers
        ['Report Date', 'New Customers', 'Paying Customers', 'Conversion Rate',
         'New Customers', 'Paying Customers', 'Conversion Rate',
         'New Customers', 'Paying Customers', 'Conversion Rate',
         'New Customers', 'Paying Customers', 'Conversion Rate'],
        // Row 1+ = data (Total, Sylva, Rowan, Hazel triples)
        ['2026-03-01', '20', '1', '5.0%', '18', '1', '5.6%', '1', '0', '0.0%', '1', '0', '0.0%'],
        ['2026-03-08', '25', '0', '0.0%', '22', '0', '0.0%', '2', '0', '0.0%', '1', '0', '0.0%'],
      ];

      const result = parseConversionCsv(rows, 'Sylva');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '2026-03-01',
        newCustomers: 18,
        paying: 1,
        conversionRate: 5.6,
      });
      expect(result[1]).toEqual({
        date: '2026-03-08',
        newCustomers: 22,
        paying: 0,
        conversionRate: 0,
      });
    });

    it('handles percentage values with and without % sign', () => {
      const rows = [
        ['Report Date', 'New Customers', 'Paying Customers', 'Conversion Rate',
         'New Customers', 'Paying Customers', 'Conversion Rate'],
        ['2026-03-01', '20', '1', '5.0', '18', '1', '5.6'],
      ];

      const result = parseConversionCsv(rows, 'Sylva');
      expect(result[0].conversionRate).toBe(5.6);
    });

    it('returns empty array for empty data', () => {
      const rows = [
        ['Report Date', 'New Customers', 'Paying Customers', 'Conversion Rate'],
      ];
      expect(parseConversionCsv(rows, 'Sylva')).toEqual([]);
    });
  });

  describe('parseRetentionCsv', () => {
    it('parses cohort retention with Month 1 through Month 12', () => {
      const rows = [
        // Data rows (header already stripped by caller)
        ['Total', '31', '16', '12', '9', '7', '5', '3', '3', '3', '3', '3', '3'],
        ["Mar '25", '2', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1', '1'],
        ["Apr '25", '3', '2', '2', '1', '1', '0', '', '', '', '', '', ''],
        ["Feb '26", '3', '3', '', '', '', '', '', '', '', '', '', ''],
      ];

      const result = parseRetentionCsv(rows);
      expect(result).toHaveLength(4);

      // Total row
      expect(result[0].cohort).toBe('Total');
      expect(result[0].subscriptions).toBe(31);
      expect(result[0].months[0]).toBe(16); // Month 1
      expect(result[0].months[5]).toBe(3);  // Month 6

      // Feb '26 cohort — has Month 1 data only
      expect(result[3].cohort).toBe("Feb '26");
      expect(result[3].subscriptions).toBe(3);
      expect(result[3].months[0]).toBe(3);  // Month 1
      expect(result[3].months[1]).toBeNull(); // Month 2 not available yet
    });

    it('handles empty/missing month values as null', () => {
      const rows = [
        ["Jan '26", '5', '4', '', '', '', '', '', '', '', '', '', ''],
      ];
      const result = parseRetentionCsv(rows);
      expect(result[0].months[0]).toBe(4);
      expect(result[0].months[1]).toBeNull();
    });
  });

  describe('parseSimpleCsv (MRR, Active Subs, New Customers)', () => {
    it('parses simple Project/Total/Sylva format and filters to Sylva', () => {
      const rows = [
        // Sub-header row already stripped
        ['2026-03-07', '92.00', '82.00', '5.00', '5.00'],
        ['2026-03-08', '90.24', '80.24', '5.00', '5.00'],
        ['2026-03-09', '90.24', '80.24', '5.00', '5.00'],
      ];

      // Column index 2 = Sylva (after date column, after Total)
      const result = parseSimpleCsv(rows, 'Sylva');
      expect(result).toHaveLength(3);
      expect(result[2]).toEqual({ date: '2026-03-09', value: 80.24 });
    });

    it('handles integer values (active subs)', () => {
      const rows = [
        ['2026-03-09', '10', '8', '1', '1'],
      ];
      const result = parseSimpleCsv(rows, 'Sylva');
      expect(result[0].value).toBe(8);
    });

    it('returns empty array for empty data', () => {
      expect(parseSimpleCsv([], 'Sylva')).toEqual([]);
    });
  });
});

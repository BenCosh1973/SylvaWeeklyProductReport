import type { RevenueCatConversion, RevenueCatRetentionCohort } from '../types.js';

/**
 * Parse triple-column conversion CSV.
 * Row 0 = sub-headers: Report Date | New Customers | Paying Customers | Conversion Rate (repeated per project)
 * Row 1+ = data. Columns are grouped in triples: Total(3), Sylva(3), Rowan(3), Hazel(3)
 * filterProject determines which triple to extract (1-indexed after date col).
 */
export function parseConversionCsv(rows: string[][], filterProject: string): RevenueCatConversion[] {
  if (rows.length < 2) return [];

  // Determine project column offset. Projects are in groups of 3 after date column.
  // Layout: [date, Total*3, Sylva*3, Rowan*3, Hazel*3]
  const projectOrder = ['Total', 'Sylva', 'Rowan', 'Hazel'];
  const projectIdx = projectOrder.findIndex(p => p.toLowerCase() === filterProject.toLowerCase());
  if (projectIdx < 0) return [];

  // Each project block is 3 columns: New Customers, Paying, Conversion Rate
  const offset = 1 + projectIdx * 3; // skip date column

  const results: RevenueCatConversion[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    const date = row[0].trim();
    const newCustomers = parseInt(row[offset] ?? '0', 10) || 0;
    const paying = parseInt(row[offset + 1] ?? '0', 10) || 0;
    const rateStr = (row[offset + 2] ?? '0').replace('%', '').trim();
    const conversionRate = parseFloat(rateStr) || 0;

    results.push({ date, newCustomers, paying, conversionRate });
  }
  return results;
}

/**
 * Parse retention cohort CSV.
 * Each row: Cohort | Subscriptions | Month 1 | Month 2 | ... | Month 12
 */
export function parseRetentionCsv(rows: string[][]): RevenueCatRetentionCohort[] {
  return rows.map(row => {
    const cohort = row[0]?.trim() ?? '';
    const subscriptions = parseInt(row[1] ?? '0', 10) || 0;
    const months: (number | null)[] = [];
    for (let i = 2; i < row.length; i++) {
      const v = row[i]?.trim();
      if (v === '' || v === undefined) {
        months.push(null);
      } else {
        const n = parseInt(v, 10);
        months.push(isNaN(n) ? null : n);
      }
    }
    return { cohort, subscriptions, months };
  });
}

/**
 * Parse simple RevenueCat CSV (MRR, Active Subs, New Customers).
 * Layout: date | Total | Sylva | Rowan | Hazel
 */
export function parseSimpleCsv(rows: string[][], filterProject: string): { date: string; value: number }[] {
  if (rows.length === 0) return [];

  // Column 0 = date, 1 = Total, 2 = Sylva, 3 = Rowan, 4 = Hazel
  const projectOrder = ['Total', 'Sylva', 'Rowan', 'Hazel'];
  const colIdx = 1 + projectOrder.findIndex(p => p.toLowerCase() === filterProject.toLowerCase());
  if (colIdx < 1) return [];

  return rows.map(row => ({
    date: row[0]?.trim() ?? '',
    value: parseFloat(row[colIdx] ?? '0') || 0,
  }));
}

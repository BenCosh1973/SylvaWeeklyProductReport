/**
 * RevenueCat Analysis — Step 7 of the prompt.
 * Analyses conversion rates, retention cohorts, active subscriptions, and MRR.
 */
import { readCSV, num, round } from './csvReader.js';

/**
 * Analyse RevenueCat Conversion to Paying data.
 * Columns: Project, Total, Total.1, Total.2, Sylva, Sylva.1, Sylva.2
 * Triples: new customers, paying, conversion rate.
 */
export async function analyzeConversion(filePath) {
  const rows = await readCSV(filePath);
  if (rows.length === 0) return { error: 'No conversion data', rows: 0 };

  const result = [];
  for (const row of rows) {
    const entry = { period: row['Project'] || row[Object.keys(row)[0]] };

    // Find column triples for each project
    const keys = Object.keys(row);
    for (const prefix of ['Total', 'Sylva', 'Rowan', 'Hazel']) {
      const cols = keys.filter(k => k === prefix || k.startsWith(prefix + '.'));
      if (cols.length >= 3) {
        entry[prefix.toLowerCase()] = {
          newCustomers: num(row[cols[0]]),
          paying: num(row[cols[1]]),
          conversionRate: row[cols[2]]?.replace('%', ''),
        };
        // Parse conversion rate
        const rateStr = row[cols[2]];
        if (rateStr) {
          entry[prefix.toLowerCase()].conversionRateNum = num(rateStr.replace('%', ''));
        }
      }
    }
    result.push(entry);
  }

  // Get the most recent period's Sylva data
  const latestSylva = result.length > 0
    ? result[result.length - 1].sylva || result[result.length - 1].total
    : null;

  return {
    periods: result,
    latestConversionRate: latestSylva?.conversionRateNum || null,
    latestNewCustomers: latestSylva?.newCustomers || null,
    latestPaying: latestSylva?.paying || null,
  };
}

/**
 * Analyse RevenueCat Subscription Retention data.
 * Columns: Cohort, Subscriptions, Month 1, Month 2...Month 12
 */
export async function analyzeRetention(filePath) {
  const rows = await readCSV(filePath);
  if (rows.length === 0) return { error: 'No retention data', rows: 0 };

  const cohorts = [];
  let totalSubscriptions = 0;
  const monthSurvival = {};

  for (const row of rows) {
    const cohort = {
      name: row['Cohort'],
      subscriptions: num(row['Subscriptions']),
      months: {},
    };

    // Parse Month 1 through Month 12
    for (let m = 1; m <= 12; m++) {
      const key = `Month ${m}`;
      const val = row[key];
      if (val !== undefined && val !== '' && val !== 'NaN') {
        const numVal = num(val);
        cohort.months[m] = numVal;
        if (!monthSurvival[m]) monthSurvival[m] = { surviving: 0, total: 0 };
        monthSurvival[m].surviving += numVal || 0;
        monthSurvival[m].total += cohort.subscriptions || 0;
      }
    }

    totalSubscriptions += cohort.subscriptions || 0;
    cohorts.push(cohort);
  }

  // Calculate overall survival rates
  const survivalCurve = {};
  for (const [month, data] of Object.entries(monthSurvival)) {
    survivalCurve[month] = {
      surviving: data.surviving,
      total: data.total,
      rate: data.total > 0 ? round(data.surviving / data.total * 100, 1) : null,
    };
  }

  return {
    totalCohorts: cohorts.length,
    totalSubscriptions,
    cohorts,
    survivalCurve,
    month1Retention: survivalCurve[1]?.rate || null,
    month3Retention: survivalCurve[3]?.rate || null,
    month6Retention: survivalCurve[6]?.rate || null,
    month12Retention: survivalCurve[12]?.rate || null,
  };
}

/**
 * Analyse RevenueCat Active Subscriptions data.
 */
export async function analyzeActiveSubscriptions(filePath) {
  const rows = await readCSV(filePath);
  if (rows.length === 0) return { error: 'No active subscriptions data', rows: 0 };

  const latest = rows[rows.length - 1];
  const trend = rows.map(r => ({
    date: r['Project'] || r[Object.keys(r)[0]],
    total: num(r['Total']),
    sylva: num(r['Sylva']),
    rowan: num(r['Rowan']),
    hazel: num(r['Hazel']),
  }));

  return {
    latest: {
      total: num(latest['Total']),
      sylva: num(latest['Sylva']),
      rowan: num(latest['Rowan']),
      hazel: num(latest['Hazel']),
    },
    trend,
    dataPoints: rows.length,
  };
}

/**
 * Analyse RevenueCat MRR data.
 */
export async function analyzeMRR(filePath) {
  const rows = await readCSV(filePath);
  if (rows.length === 0) return { error: 'No MRR data', rows: 0 };

  const latest = rows[rows.length - 1];
  const trend = rows.map(r => ({
    date: r['Project'] || r[Object.keys(r)[0]],
    total: num(r['Total']),
    sylva: num(r['Sylva']),
  }));

  return {
    latest: {
      total: num(latest['Total']),
      sylva: num(latest['Sylva']),
    },
    trend,
    dataPoints: rows.length,
  };
}

/**
 * Analyse RevenueCat New Customers data.
 */
export async function analyzeNewCustomers(filePath) {
  const rows = await readCSV(filePath);
  if (rows.length === 0) return { error: 'No new customers data', rows: 0 };

  const latest = rows[rows.length - 1];
  const trend = rows.map(r => ({
    date: r['Project'] || r[Object.keys(r)[0]],
    total: num(r['Total']),
    sylva: num(r['Sylva']),
  }));

  return {
    latest: {
      total: num(latest['Total']),
      sylva: num(latest['Sylva']),
    },
    trend,
    dataPoints: rows.length,
    totalAllTime: trend.reduce((sum, t) => sum + (t.sylva || 0), 0),
  };
}

/**
 * Reference benchmarks from RevenueCat State of Subscription Apps 2025.
 */
export const BENCHMARKS = {
  trialToPaid: {
    sylva: 2.5,
    hfMedian: 39.9,
    hfTop10: 68.3,
  },
  month1Retention: {
    sylva: 52,
  },
  trialLengthBenchmark: {
    optimal: '17-32 days',
    conversionRate: 45.7,
  },
};

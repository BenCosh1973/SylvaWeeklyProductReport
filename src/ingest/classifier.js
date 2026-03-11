/**
 * CSV Classifier — identifies data file types by column structure.
 * Column names can change weekly, so we match by known column patterns.
 */
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';

// Signature columns for each data category
const SIGNATURES = {
  chatDigest: {
    required: ['User ID', 'Timestamp', 'Subscription status'],
    optional: ['CSAT', 'Message Count', 'Duration (min)', 'Topic', 'Emotions Before',
      'Emotions After', 'PSS10 Before', 'PSS10 After', 'Relief Velocity',
      'Tests Completed Count', 'Tests Completed Names', 'Strategies',
      'Session Count', 'Trial Start Date', 'Subscription Start Date'],
  },
  uxcamEvent: {
    required: ['sessionid', 'eventname', 'trackedon', 'uxcamuserid'],
    optional: ['property', 'screen_name'],
  },
  uxcamUser: {
    required: ['uxcamuserid', 'totalsession', 'totalsessiontime'],
    optional: ['u__subscriptionstatus', 'u__subscription_status'],
  },
  uxcamSession: {
    required: ['sessionid', 'uxcamuserid', 'totalsessiontime', 'recordedon'],
    optional: ['ragegesturecount'],
  },
  uxcamScreen: {
    required: ['totalsession', 'screen_name'],
    optional: ['totalbounce', 'totalengagementtimemedian'],
  },
  revenuecatConversion: {
    // Has Project + Total/Total.1/Total.2 pattern for conversion rates
    required: ['Project'],
    pattern: /Total\.\d/,
    heuristic: 'conversion',
  },
  revenuecatRetention: {
    required: ['Cohort', 'Subscriptions'],
    optional: ['Month 1', 'Month 2'],
  },
  revenuecatActiveSubscriptions: {
    required: ['Project'],
    optional: ['Total', 'Sylva', 'Rowan', 'Hazel'],
    heuristic: 'activeSubs',
  },
  revenuecatMRR: {
    required: ['Project'],
    heuristic: 'mrr',
  },
  revenuecatNewCustomers: {
    required: ['Project'],
    heuristic: 'newCustomers',
  },
};

/**
 * Read the header row of a CSV file.
 */
export async function readHeaders(filePath) {
  return new Promise((resolve, reject) => {
    const headers = [];
    const stream = createReadStream(filePath);
    const parser = parse({ columns: false, to_line: 1 });
    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        headers.push(...record);
      }
    });
    parser.on('end', () => resolve(headers));
    parser.on('error', reject);
    stream.pipe(parser);
  });
}

/**
 * Count rows in a CSV file.
 */
export async function countRows(filePath) {
  return new Promise((resolve, reject) => {
    let count = 0;
    const stream = createReadStream(filePath);
    const parser = parse({ columns: true });
    parser.on('readable', () => {
      while (parser.read() !== null) count++;
    });
    parser.on('end', () => resolve(count));
    parser.on('error', reject);
    stream.pipe(parser);
  });
}

/**
 * Normalize a column name for fuzzy matching.
 */
function normalize(col) {
  return col.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

/**
 * Check if headers contain all required columns (case-insensitive, whitespace-tolerant).
 */
function matchesRequired(headers, required) {
  const normHeaders = headers.map(normalize);
  return required.every(req => normHeaders.includes(normalize(req)));
}

/**
 * Classify a single CSV file. Returns { type, confidence, headers, rowCount }.
 */
export async function classifyFile(filePath) {
  const headers = await readHeaders(filePath);
  const normHeaders = headers.map(normalize);

  // Try each signature in priority order
  // Chat Digest first (most specific)
  if (matchesRequired(headers, SIGNATURES.chatDigest.required)) {
    const rowCount = await countRows(filePath);
    return { type: 'chatDigest', confidence: 'high', headers, rowCount };
  }

  // UXCam Event-level
  if (matchesRequired(headers, SIGNATURES.uxcamEvent.required)) {
    return { type: 'uxcamEvent', confidence: 'high', headers };
  }

  // UXCam Session-level
  if (matchesRequired(headers, SIGNATURES.uxcamSession.required)) {
    return { type: 'uxcamSession', confidence: 'high', headers };
  }

  // UXCam User-level (check before screen since both have totalsession)
  if (matchesRequired(headers, SIGNATURES.uxcamUser.required)) {
    return { type: 'uxcamUser', confidence: 'high', headers };
  }

  // UXCam Screen-level
  if (matchesRequired(headers, SIGNATURES.uxcamScreen.required)) {
    return { type: 'uxcamScreen', confidence: 'high', headers };
  }

  // RevenueCat Retention
  if (matchesRequired(headers, SIGNATURES.revenuecatRetention.required)) {
    return { type: 'revenuecatRetention', confidence: 'high', headers };
  }

  // RevenueCat files with Project column — disambiguate by content
  if (matchesRequired(headers, ['Project'])) {
    const hasTriples = headers.filter(h => /^Total(\.\d)?$/.test(h)).length >= 3;
    const hasSylvaTriples = headers.filter(h => /^Sylva(\.\d)?$/.test(h)).length >= 3;
    const hasCohort = normHeaders.includes('cohort');

    if (hasTriples || hasSylvaTriples) {
      // Could be Conversion, MRR, or New Customers — need to read a row
      const firstRow = await readFirstDataRow(filePath);
      if (firstRow) {
        const vals = Object.values(firstRow);
        const hasPercent = vals.some(v => typeof v === 'string' && v.includes('%'));
        const hasCurrency = vals.some(v => typeof v === 'string' && (v.includes('$') || v.includes('£') || v.includes('€') || /^\d+\.\d{2}$/.test(v)));

        if (hasPercent) {
          return { type: 'revenuecatConversion', confidence: 'medium', headers };
        }
        if (hasCurrency) {
          return { type: 'revenuecatMRR', confidence: 'medium', headers };
        }
        return { type: 'revenuecatNewCustomers', confidence: 'medium', headers };
      }
    }

    // Simple Project + Total + Sylva structure (daily counts)
    if (normHeaders.includes('total') && normHeaders.includes('sylva')) {
      const firstRow = await readFirstDataRow(filePath);
      if (firstRow) {
        const vals = Object.values(firstRow);
        const hasCurrency = vals.some(v => typeof v === 'string' && (v.includes('$') || v.includes('£') || v.includes('€')));
        if (hasCurrency) {
          return { type: 'revenuecatMRR', confidence: 'medium', headers };
        }
        return { type: 'revenuecatActiveSubscriptions', confidence: 'medium', headers };
      }
    }
  }

  return { type: 'unknown', confidence: 'none', headers };
}

/**
 * Read the first data row of a CSV.
 */
async function readFirstDataRow(filePath) {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    const parser = parse({ columns: true, to_line: 2 });
    let row = null;
    parser.on('readable', () => {
      const r = parser.read();
      if (r && !row) row = r;
    });
    parser.on('end', () => resolve(row));
    parser.on('error', reject);
    stream.pipe(parser);
  });
}

/**
 * Given multiple Chat Digest files, return the one with the most rows (most recent cumulative export).
 */
export function selectBestChatDigest(classifiedFiles) {
  const chatDigests = classifiedFiles.filter(f => f.type === 'chatDigest');
  if (chatDigests.length === 0) return null;
  if (chatDigests.length === 1) return chatDigests[0];

  // Sort by row count descending, then by filename suffix (_2 > _1)
  chatDigests.sort((a, b) => (b.rowCount || 0) - (a.rowCount || 0));
  return chatDigests[0];
}

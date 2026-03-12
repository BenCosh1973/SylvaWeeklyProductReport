import type { ClassifiedFile, DataSourceType } from '../types.js';

const SIGNATURES: { type: DataSourceType; required: string[]; any?: string[] }[] = [
  {
    type: 'uxcam_events',
    required: ['sessionid', 'eventname', 'property', 'trackedon', 'uxcamuserid'],
  },
  {
    type: 'uxcam_sessions',
    required: ['sessionid', 'uxcamuserid', 'totalsessiontime', 'ragegesturecount'],
  },
  {
    type: 'uxcam_screens',
    required: ['totalbounce', 'totalengagementtimemedian', 'totalsession', 'screen_name', 'totalrage'],
  },
  {
    type: 'uxcam_users',
    required: ['uxcamuserid', 'country', 'totalsession', 'totalsessiontime'],
    any: ['u__subscriptionstatus', 'u__subscription_status'],
  },
  {
    type: 'chat_digests',
    required: ['user id', 'timestamp', 'subscription status', 'message count'],
  },
  {
    type: 'icp_challenges',
    required: ['id', 'platform', 'timestamp', 'multiple choice', 'free text'],
  },
  {
    type: 'revenuecat_retention',
    required: ['cohort', 'subscriptions', 'month 1'],
  },
  {
    type: 'trial_durations',
    required: ['user_id', 'trial_length_days'],
  },
  {
    type: 'uxcam_session_list',
    required: ['user', 'session #', 'session duration', 'ai summary'],
  },
  {
    type: 'adjust_daily',
    required: ['day', 'installs', 'retention_rate_d0'],
  },
  {
    type: 'adjust_weekly',
    required: ['week', 'installs', 'retention_rate_w1'],
  },
  {
    type: 'adjust_monthly',
    required: ['month', 'installs', 'retention_rate_m1'],
  },
  {
    type: 'adjust_country',
    required: ['month', 'country', 'installs'],
  },
];

function normalize(h: string): string {
  return h.trim().toLowerCase();
}

export function classifyByHeaders(headers: string[]): DataSourceType {
  const norm = headers.map(normalize);

  // Check for RevenueCat triple-column pattern first
  if (norm.length >= 7) {
    const counts = new Map<string, number>();
    for (const h of norm) {
      counts.set(h, (counts.get(h) ?? 0) + 1);
    }
    const hasTriples = [...counts.entries()].some(([k, v]) => v >= 3 && k !== 'project');
    if (hasTriples) {
      return 'revenuecat_conversion';
    }
  }

  // Check known signatures
  for (const sig of SIGNATURES) {
    const allRequired = sig.required.every(r => norm.includes(r));
    const anyMatch = sig.any ? sig.any.some(a => norm.includes(a)) : true;
    if (allRequired && anyMatch) {
      return sig.type;
    }
  }

  // RevenueCat simple format: has total + sylva columns
  if ((norm.includes('total') && norm.includes('sylva')) || (norm.includes('project') && norm.includes('total'))) {
    return 'revenuecat_active_subs';
  }

  return 'unknown';
}

export function classifyFile(
  filename: string,
  headers: string[],
  rowCount: number,
  sampleRows?: string[][]
): ClassifiedFile {
  let sourceType = classifyByHeaders(headers);

  // Refine RevenueCat simple types using sample rows
  if (sourceType === 'revenuecat_active_subs' && sampleRows && sampleRows.length > 0) {
    const firstRow = sampleRows[0];
    const valueCol = firstRow[1]; // Total column
    if (valueCol && valueCol.includes('.')) {
      sourceType = 'revenuecat_mrr';
    }
  }

  return { filename, sourceType, rowCount, dateRange: null, headers };
}

export function selectBestFile(files: ClassifiedFile[]): ClassifiedFile {
  if (files.length <= 1) return files[0];
  return files.reduce((best, f) => (f.rowCount > best.rowCount ? f : best), files[0]);
}

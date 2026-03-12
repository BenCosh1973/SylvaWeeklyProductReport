import type { FunnelStep, SubFunnelStep, SanityCheckResult, TrialUserProfile, PaidUserProfile } from '../types.js';

export interface SanityCheckInput {
  funnelTable: FunnelStep[];
  subFunnel: SubFunnelStep[];
  trialProfiles: Map<string, TrialUserProfile>;
  paidProfiles: Map<string, PaidUserProfile>;
  rcActiveSubs: number;
  events: { uxcamuserid: string }[];
  userFileUserIds: string[];
  sessions: { totalsessiontime: number; locationcountry?: string }[];
  chatDigestPss10: { before: number | null; after: number | null }[];
  chatDigestTests: { userId: string; testsCompleted: number; timestamp: string }[];
}

type CheckLevel = 'PASS' | 'WARN' | 'FAIL';

function check(name: string, level: CheckLevel, message: string): SanityCheckResult {
  return { check: name, level, message };
}

export function runSanityChecks(input: SanityCheckInput): SanityCheckResult[] {
  const results: SanityCheckResult[] = [];

  // 1. Funnel monotonicity
  {
    let mono = true;
    for (let i = 1; i < input.funnelTable.length; i++) {
      if (input.funnelTable[i].usersReached > input.funnelTable[i - 1].usersReached) {
        mono = false;
        break;
      }
    }
    results.push(check('funnel_monotonicity', mono ? 'PASS' : 'FAIL',
      mono ? 'Funnel user counts are monotonically decreasing.' : 'Funnel user counts are NOT monotonically decreasing — data error.'));
  }

  // 2. Sub-funnel monotonicity
  {
    let mono = true;
    for (let i = 1; i < input.subFunnel.length; i++) {
      if (input.subFunnel[i].uniqueUsers > input.subFunnel[i - 1].uniqueUsers) {
        mono = false;
        break;
      }
    }
    results.push(check('sub_funnel_monotonicity', mono ? 'PASS' : 'FAIL',
      mono ? 'Subscription funnel counts are monotonically decreasing.' : 'Subscription funnel counts are NOT monotonically decreasing — data error.'));
  }

  // 3. User ID coverage: event users present in user file
  {
    const eventUserIds = new Set(input.events.map(e => e.uxcamuserid));
    const userFileSet = new Set(input.userFileUserIds);
    let missing = 0;
    for (const uid of eventUserIds) {
      if (!userFileSet.has(uid)) missing++;
    }
    const pct = eventUserIds.size > 0 ? (missing / eventUserIds.size) * 100 : 0;
    const level: CheckLevel = pct > 20 ? 'WARN' : 'PASS';
    results.push(check('user_id_coverage', level,
      `${missing}/${eventUserIds.size} event users (${pct.toFixed(0)}%) missing from user file.`));
  }

  // 4. Session time plausibility
  {
    let hasNegative = false;
    let hasExtreme = false;
    for (const s of input.sessions) {
      if (s.totalsessiontime < 0) hasNegative = true;
      if (s.totalsessiontime > 86400) hasExtreme = true;
    }
    const level: CheckLevel = hasNegative ? 'FAIL' : hasExtreme ? 'WARN' : 'PASS';
    results.push(check('session_time_plausibility', level,
      hasNegative ? 'Negative session times detected.' :
      hasExtreme ? 'Sessions longer than 24 hours detected.' :
      'All session times are plausible.'));
  }

  // 5. Geography check: UK traffic >= 80%
  {
    const total = input.sessions.length;
    const uk = input.sessions.filter(s => (s.locationcountry ?? '').toLowerCase().includes('united kingdom')).length;
    const pct = total > 0 ? (uk / total) * 100 : 100;
    const level: CheckLevel = pct < 80 ? 'WARN' : 'PASS';
    results.push(check('geography', level,
      `UK traffic: ${pct.toFixed(0)}% (${uk}/${total} sessions).`));
  }

  // 6. RC active subs vs chat digest active users
  {
    const chatActive = input.paidProfiles.size;
    const rc = input.rcActiveSubs;
    const maxVal = Math.max(chatActive, rc);
    const diff = Math.abs(chatActive - rc);
    const pct = maxVal > 0 ? (diff / maxVal) * 100 : 0;
    const level: CheckLevel = pct > 50 ? 'WARN' : 'PASS';
    results.push(check('rc_active_subs_crosscheck', level,
      `RC active subs: ${rc}, Chat Digest active users: ${chatActive} (${pct.toFixed(0)}% discrepancy).`));
  }

  // 7. PSS10 range (0–40)
  {
    let outOfRange = false;
    for (const p of input.chatDigestPss10) {
      if (p.before !== null && (p.before < 0 || p.before > 40)) outOfRange = true;
      if (p.after !== null && (p.after < 0 || p.after > 40)) outOfRange = true;
    }
    const level: CheckLevel = outOfRange ? 'WARN' : 'PASS';
    results.push(check('pss10_range', level,
      outOfRange ? 'PSS10 scores outside 0-40 range detected.' : 'All PSS10 scores within 0-40 range.'));
  }

  // 8. Tests monotonic per user
  {
    const byUser = new Map<string, { ts: string; count: number }[]>();
    for (const t of input.chatDigestTests) {
      const arr = byUser.get(t.userId) ?? [];
      arr.push({ ts: t.timestamp, count: t.testsCompleted });
      byUser.set(t.userId, arr);
    }
    let nonMono = false;
    for (const [, entries] of byUser) {
      entries.sort((a, b) => a.ts.localeCompare(b.ts));
      for (let i = 1; i < entries.length; i++) {
        if (entries[i].count < entries[i - 1].count) {
          nonMono = true;
          break;
        }
      }
      if (nonMono) break;
    }
    const level: CheckLevel = nonMono ? 'WARN' : 'PASS';
    results.push(check('tests_monotonic', level,
      nonMono ? 'Test completion count decreased for some users — data may be inconsistent.' :
      'Test completion counts are monotonically increasing per user.'));
  }

  // 9. No fabrication reminder
  results.push(check('no_fabrication', 'PASS',
    'Reminder: All numbers must come from source data. Never fabricate or interpolate missing values.'));

  return results;
}

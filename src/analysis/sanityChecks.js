/**
 * Sanity Checks — Step 12 of the prompt.
 * Validates analysis results for consistency and plausibility.
 */
import { round } from './csvReader.js';

export function runSanityChecks(chatAnalysis, uxcamEvents, uxcamUsers, retention, conversion, activeSubs) {
  const checks = [];

  // 1. Trial user count in Chat Digests ≈ trial_start count in UXCam events
  if (chatAnalysis && uxcamEvents && !uxcamEvents.error) {
    const chatTrialUsers = chatAnalysis.statusCounts?.trial || 0;
    const uxcamTrialStarts = uxcamEvents.funnelRaw?.trial_start?.uniqueUsers || 0;
    const match = chatTrialUsers > 0 && uxcamTrialStarts > 0;
    checks.push({
      name: 'Trial user count match (Chat Digests vs UXCam)',
      passed: match ? Math.abs(chatTrialUsers - uxcamTrialStarts) / Math.max(chatTrialUsers, uxcamTrialStarts) < 0.5 : null,
      detail: `Chat Digests: ${chatTrialUsers} trial users, UXCam: ${uxcamTrialStarts} trial_start events`,
      note: match ? null : 'Data sources may cover different date ranges',
    });
  }

  // 2. Paid user count matches RevenueCat Active Subscriptions
  if (chatAnalysis && activeSubs && !activeSubs.error) {
    const chatPaidUsers = chatAnalysis.statusCounts?.active || 0;
    const rcActiveSylva = activeSubs.latest?.sylva || 0;
    checks.push({
      name: 'Paid user count match (Chat Digests vs RevenueCat)',
      passed: Math.abs(chatPaidUsers - rcActiveSylva) <= 5,
      detail: `Chat Digests: ${chatPaidUsers} active users, RevenueCat: ${rcActiveSylva} Sylva subscriptions`,
    });
  }

  // 3. Subscription sub-funnel is internally consistent
  if (uxcamEvents && !uxcamEvents.error && uxcamEvents.subscriptionFunnel) {
    let consistent = true;
    for (let i = 1; i < uxcamEvents.subscriptionFunnel.length; i++) {
      if (uxcamEvents.subscriptionFunnel[i].uniqueUsers > uxcamEvents.subscriptionFunnel[i - 1].uniqueUsers) {
        consistent = false;
        break;
      }
    }
    checks.push({
      name: 'Subscription funnel consistency (each step ≤ previous)',
      passed: consistent,
      detail: uxcamEvents.subscriptionFunnel.map(s => `${s.step}: ${s.uniqueUsers}`).join(' → '),
    });
  }

  // 4. PSS10 scores are plausible (0-40 scale)
  if (chatAnalysis) {
    const allPSS = [
      chatAnalysis.trialMetrics?.meanPSS10Before,
      chatAnalysis.trialMetrics?.meanPSS10After,
      chatAnalysis.paidMetrics?.meanPSS10Before,
      chatAnalysis.paidMetrics?.meanPSS10After,
    ].filter(v => v !== null && v !== undefined);

    const plausible = allPSS.every(v => v >= 0 && v <= 40);
    checks.push({
      name: 'PSS10 scores plausible (0-40 scale)',
      passed: plausible,
      detail: `Values: ${allPSS.map(v => round(v, 1)).join(', ')}`,
    });
  }

  // 5. RevenueCat conversion rates match manual calculation
  if (conversion && !conversion.error && conversion.latestNewCustomers && conversion.latestPaying) {
    const manualRate = round(conversion.latestPaying / conversion.latestNewCustomers * 100, 1);
    const reportedRate = conversion.latestConversionRate;
    const match = reportedRate !== null
      ? Math.abs(manualRate - reportedRate) < 2
      : null;
    checks.push({
      name: 'RevenueCat conversion rate matches manual calculation',
      passed: match,
      detail: `Reported: ${reportedRate}%, Manual: ${manualRate}% (${conversion.latestPaying}/${conversion.latestNewCustomers})`,
    });
  }

  return checks;
}

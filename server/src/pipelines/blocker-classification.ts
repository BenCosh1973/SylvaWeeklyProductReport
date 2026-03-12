import type {
  ConversionBlocker,
  TrialSegmentation,
  TrialUserProfile,
  PaidUserProfile,
  SubFunnelStep,
  ScreenMetrics,
  EngagementComparison,
  BlockerSeverity,
} from '../types.js';

export function classifyConversionBlockers(
  trialSegments: TrialSegmentation,
  trialProfiles: Map<string, TrialUserProfile>,
  paidProfiles: Map<string, PaidUserProfile>,
  subFunnel: SubFunnelStep[],
  screenMetrics: ScreenMetrics[],
  comparison: EngagementComparison[],
  strongestPredictor: string,
  strongestGap: number
): ConversionBlocker[] {
  const blockers: ConversionBlocker[] = [];

  const totalTrialUsers =
    trialSegments.high_engagement_no_convert.length +
    trialSegments.moderate_fading.length +
    trialSegments.single_session.length +
    trialSegments.active_trial.length +
    trialSegments.expired_lapsed.length;

  // === VALUE DELIVERY ===

  // Single session users > 20% of total
  if (totalTrialUsers > 0) {
    const singlePct = (trialSegments.single_session.length / totalTrialUsers) * 100;
    if (singlePct > 20) {
      blockers.push({
        category: 'value_delivery',
        title: 'High single-session drop-off',
        evidence: `${trialSegments.single_session.length} users (${singlePct.toFixed(0)}%) had only one session — value not delivered in first experience.`,
        severity: 'HIGH',
      });
    }
  }

  // Test completion gap
  const testsRow = comparison.find(c => c.metric.toLowerCase().includes('test'));
  if (testsRow && testsRow.gapRatio !== null && testsRow.gapRatio >= 3) {
    blockers.push({
      category: 'value_delivery',
      title: 'Test completion gap blocks conversion',
      evidence: `Trial users complete median ${testsRow.trialMedian} tests vs paid ${testsRow.paidMedian} (${testsRow.gapRatio.toFixed(1)}x gap). "${strongestPredictor}" is the strongest conversion predictor.`,
      severity: 'HIGH',
    });
  }

  // Duration gap
  const durationRow = comparison.find(c => c.metric.toLowerCase().includes('duration'));
  if (durationRow && durationRow.gapRatio !== null && durationRow.gapRatio >= 4) {
    blockers.push({
      category: 'value_delivery',
      title: 'Session duration gap',
      evidence: `Trial sessions average ${durationRow.trialMedian}min vs paid ${durationRow.paidMedian}min — trial users disengage before receiving value.`,
      severity: 'MEDIUM',
    });
  }

  // === VALUE AWARENESS ===

  // Few users see pricing page
  const trialStartStep = subFunnel.find(s => s.step === 'trial_start');
  const pricingStep = subFunnel.find(s => s.step === 'subscription_pricing_viewed');
  if (trialStartStep && pricingStep && trialStartStep.uniqueUsers > 0) {
    const pricingPct = (pricingStep.uniqueUsers / trialStartStep.uniqueUsers) * 100;
    if (pricingPct < 15) {
      blockers.push({
        category: 'value_awareness',
        title: 'Most trial users never see pricing',
        evidence: `Only ${pricingStep.uniqueUsers}/${trialStartStep.uniqueUsers} trial users (${pricingPct.toFixed(0)}%) viewed the pricing screen.`,
        severity: 'HIGH',
      });
    }
  }

  // === PRICING / TIMING ===

  // High expired/lapsed rate
  if (totalTrialUsers > 0) {
    const expiredPct = (trialSegments.expired_lapsed.length / totalTrialUsers) * 100;
    if (expiredPct > 30) {
      blockers.push({
        category: 'pricing_timing',
        title: 'Trial expires before conversion readiness',
        evidence: `${trialSegments.expired_lapsed.length} users (${expiredPct.toFixed(0)}%) expired without converting — trial length may be too short.`,
        severity: 'HIGH',
      });
    }
  }

  // === TRIAL EXPIRATION ===

  // Expired users with low engagement
  if (trialSegments.expired_lapsed.length > 0) {
    const expiredProfiles = trialSegments.expired_lapsed
      .map(uid => trialProfiles.get(uid))
      .filter((p): p is TrialUserProfile => p !== undefined);

    if (expiredProfiles.length > 0) {
      const avgDaysActive =
        expiredProfiles.reduce((sum, p) => sum + p.daysActive, 0) / expiredProfiles.length;

      blockers.push({
        category: 'trial_expiration',
        title: 'Expired trial users under-engaged',
        evidence: `${expiredProfiles.length} expired users averaged ${avgDaysActive.toFixed(1)} days active — they never reached engagement threshold for conversion.`,
        severity: avgDaysActive < 3 ? 'HIGH' : 'MEDIUM',
      });
    }
  }

  // Sort by severity
  const severityOrder: Record<BlockerSeverity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  blockers.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return blockers;
}

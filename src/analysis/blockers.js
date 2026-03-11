/**
 * Conversion Blocker Identification — Step 9 of the prompt.
 * Classifies blockers based on analysis results and generates prioritised actions.
 */
import { round } from './csvReader.js';

/**
 * Identify conversion blockers from the combined analysis.
 */
export function identifyBlockers(chatAnalysis, uxcamEvents, uxcamScreens) {
  const blockers = {
    valueDelivery: [],
    valueAwareness: [],
    pricingTiming: [],
    trialExpiration: [],
  };

  // 1. Value delivery blockers
  const singleSessionUsers = chatAnalysis.trialSegments?.single_session || 0;
  const totalTrialUsers = chatAnalysis.statusCounts?.trial || 0;
  if (singleSessionUsers > 0) {
    blockers.valueDelivery.push({
      finding: `${singleSessionUsers} trial users (${round(singleSessionUsers / totalTrialUsers * 100, 0)}%) had only 1 chat session`,
      implication: 'First session didn\'t deliver enough value to bring them back',
      severity: 'high',
    });
  }

  const trialMsgPerSession = chatAnalysis.engagementGaps?.messagesPerSession?.trial;
  const paidMsgPerSession = chatAnalysis.engagementGaps?.messagesPerSession?.paid;
  if (trialMsgPerSession && paidMsgPerSession && trialMsgPerSession < paidMsgPerSession) {
    blockers.valueDelivery.push({
      finding: `Trial users send ${trialMsgPerSession} messages/session vs ${paidMsgPerSession} for paid (${round(paidMsgPerSession / trialMsgPerSession, 1)}x gap)`,
      implication: 'Shallow engagement — trial users aren\'t going deep enough in conversations',
      severity: 'medium',
    });
  }

  const trialTests = chatAnalysis.engagementGaps?.testsCompleted?.trial;
  const paidTests = chatAnalysis.engagementGaps?.testsCompleted?.paid;
  if (trialTests !== null && paidTests !== null && trialTests < paidTests) {
    const ratio = paidTests / (trialTests || 1);
    blockers.valueDelivery.push({
      finding: `Trial users complete ${trialTests} tests vs ${paidTests} for paid (${round(ratio, 0)}x gap)`,
      implication: 'Test completion appears to be the strongest conversion predictor',
      severity: 'critical',
    });
  }

  const trialPSS = chatAnalysis.trialMetrics?.medianPSS10Change;
  if (trialPSS !== null && trialPSS >= 0) {
    blockers.valueDelivery.push({
      finding: `Trial users show no median PSS10 improvement (change: ${trialPSS})`,
      implication: 'Users aren\'t experiencing measurable stress relief',
      severity: 'high',
    });
  }

  // 2. Value awareness blockers
  if (uxcamEvents && !uxcamEvents.error) {
    const trialStarts = uxcamEvents.funnelRaw?.trial_start?.uniqueUsers || 0;
    const pricingViewed = uxcamEvents.funnelRaw?.subscription_pricing_viewed?.uniqueUsers || 0;
    if (trialStarts > 0 && pricingViewed < trialStarts * 0.2) {
      blockers.valueAwareness.push({
        finding: `Only ${pricingViewed} of ${trialStarts} trial users viewed pricing (${round(pricingViewed / trialStarts * 100, 1)}%)`,
        implication: 'Most trial users never see the subscription offer',
        severity: 'critical',
      });
    }

    // Check from_page analysis
    const fromPages = uxcamEvents.fromPageAnalysis?.subscription_pricing_viewed || {};
    const totalFromPages = Object.values(fromPages).reduce((s, v) => s + v, 0);
    if (totalFromPages > 0) {
      const dominantSource = Object.entries(fromPages).sort((a, b) => b[1] - a[1])[0];
      if (dominantSource && dominantSource[1] / totalFromPages > 0.7) {
        blockers.valueAwareness.push({
          finding: `${round(dominantSource[1] / totalFromPages * 100, 0)}% of pricing views come from '${dominantSource[0]}'`,
          implication: 'Paywall is triggered from only one context — needs more touchpoints',
          severity: 'medium',
        });
      }
    }
  }

  if (uxcamScreens && !uxcamScreens.error) {
    const subscribeScreen = uxcamScreens.targetScreens?.['/subscribe'];
    if (subscribeScreen && subscribeScreen.totalSessions < 20) {
      blockers.valueAwareness.push({
        finding: `Only ${subscribeScreen.totalSessions} sessions on /subscribe screen`,
        implication: 'Users rarely reach the subscription page',
        severity: 'high',
      });
    }
  }

  // 3. Pricing/timing blockers
  if (uxcamEvents && !uxcamEvents.error) {
    const pricingViewed = uxcamEvents.funnelRaw?.subscription_pricing_viewed?.uniqueUsers || 0;
    const planSelected = uxcamEvents.funnelRaw?.subscription_plan_selected?.uniqueUsers || 0;
    if (pricingViewed > 0 && planSelected < pricingViewed * 0.5) {
      blockers.pricingTiming.push({
        finding: `${pricingViewed} users viewed pricing but only ${planSelected} selected a plan (${round(planSelected / pricingViewed * 100, 1)}% conversion)`,
        implication: 'Pricing or plan options may be a barrier',
        severity: 'high',
      });
    }

    if (uxcamEvents.chatTrialStartModalCount > 0) {
      blockers.pricingTiming.push({
        finding: `${uxcamEvents.chatTrialStartModalCount} trial limit modal displays during active chats`,
        implication: 'Users hit the paywall during engagement — timing may feel punitive',
        severity: 'medium',
      });
    }
  }

  // Trial length blocker (always relevant)
  blockers.pricingTiming.push({
    finding: '7-day trial may be too short for parenting crisis cycle',
    implication: 'Benchmark: 17-32 day trials convert at 45.7% (RevenueCat 2025)',
    severity: 'medium',
  });

  // 4. Trial expiration blockers
  const expiredUsers = chatAnalysis.trialSegments?.expired_lapsed || 0;
  if (expiredUsers > 0) {
    blockers.trialExpiration.push({
      finding: `${expiredUsers} users have expired/lapsed trials`,
      implication: 'Trial ended before these users were ready to decide',
      severity: 'high',
    });
  }

  const fadingUsers = chatAnalysis.trialSegments?.moderate_fading || 0;
  if (fadingUsers > 0) {
    blockers.trialExpiration.push({
      finding: `${fadingUsers} trial users are fading (2-4 sessions, inactive >3 days)`,
      implication: 'Re-engagement opportunity — these users showed initial interest',
      severity: 'medium',
    });
  }

  return blockers;
}

/**
 * Generate prioritised actions based on blockers.
 */
export function generateActions(blockers, chatAnalysis, uxcamEvents) {
  const actions = [];

  // Find all critical/high blockers to prioritize
  const allBlockers = [
    ...blockers.valueDelivery,
    ...blockers.valueAwareness,
    ...blockers.pricingTiming,
    ...blockers.trialExpiration,
  ];

  const criticalBlockers = allBlockers.filter(b => b.severity === 'critical');
  const highBlockers = allBlockers.filter(b => b.severity === 'high');

  // Action 1: Usually test completion (strongest predictor)
  const testGap = chatAnalysis.engagementGaps?.testsCompleted;
  if (testGap && testGap.ratio && testGap.ratio > 2) {
    const trialUsers = chatAnalysis.statusCounts?.trial || 0;
    const paidRate = chatAnalysis.statusCounts?.active
      ? chatAnalysis.statusCounts.active / (chatAnalysis.statusCounts.active + trialUsers)
      : 0.025;
    const additionalConversions = Math.round(trialUsers * 0.1 * paidRate * 10);

    actions.push({
      priority: 'P0',
      what: `Drive test completion during trial: guide users to complete 3+ tests in first 3 sessions`,
      why: `Test completion is the strongest conversion predictor (${testGap.trial} vs ${testGap.paid} for paid, ${testGap.ratio}x gap). ${criticalBlockers.length > 0 ? criticalBlockers[0].finding : ''}`,
      who: 'Joe (product/engineering)',
      when: 'This sprint',
      expectedImpact: `If 10% of trial users complete 3+ tests, expect ~${Math.max(additionalConversions, 1)} additional conversions based on paid user patterns`,
    });
  }

  // Action 2: Subscription visibility
  const pricingBlocker = blockers.valueAwareness.find(b => b.severity === 'critical');
  if (pricingBlocker || blockers.valueAwareness.length > 0) {
    actions.push({
      priority: 'P0',
      what: 'Add subscription prompts after value moments (post-test results, PSS10 improvement, high-CSAT sessions)',
      why: blockers.valueAwareness.map(b => b.finding).join('. '),
      who: 'Joe (product/engineering)',
      when: 'This sprint',
      expectedImpact: 'Increasing pricing view rate from current level to 30%+ of trial users could double conversion opportunities',
    });
  }

  // Action 3: Trial engagement / re-engagement
  const fadingCount = chatAnalysis.trialSegments?.moderate_fading || 0;
  const singleCount = chatAnalysis.trialSegments?.single_session || 0;
  if (fadingCount > 0 || singleCount > 0) {
    actions.push({
      priority: 'P1',
      what: 'Implement re-engagement nudges: push notifications on days 2, 4, 6 of trial with personalised prompts based on previous chat topics',
      why: `${fadingCount} fading users and ${singleCount} single-session users represent lost conversion opportunities`,
      who: 'Joe (product/engineering) + Ronan (marketing)',
      when: 'Next 2-4 sprints',
      expectedImpact: `Re-engaging ${Math.round((fadingCount + singleCount) * 0.2)} of ${fadingCount + singleCount} disengaged trial users could yield 1-3 additional conversions`,
    });
  }

  // Action 4: Trial length extension
  actions.push({
    priority: 'P1',
    what: 'Test extended trial length (14 or 21 days) for new cohorts',
    why: '7-day trial may not match parenting crisis cycles. RevenueCat 2025 benchmark: 17-32 day trials convert at 45.7%',
    who: 'Joe (product/engineering)',
    when: 'Next sprint (A/B test)',
    expectedImpact: 'Extended trials in H&F category convert at 45.7% vs current ~2.5%',
  });

  // Action 5: Trial-end nurture
  actions.push({
    priority: 'P2',
    what: 'Build trial-end nurture sequence: contextual prompts at days 5, 6, 7 showing value received (tests taken, PSS10 change, sessions)',
    why: `${chatAnalysis.trialSegments?.expired_lapsed || 0} expired trials suggest users aren't receiving timely conversion prompts`,
    who: 'Ronan (marketing) + Joe (product/engineering)',
    when: 'Next 2-4 sprints',
    expectedImpact: 'Industry standard: well-timed trial-end sequences increase conversion by 15-25%',
  });

  return actions.slice(0, 5); // Top 5 actions
}

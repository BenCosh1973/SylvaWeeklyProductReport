/**
 * Word Document Report Generator — Step 10, Output 2.
 * Produces a .docx report with full analysis results.
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType,
} from 'docx';
import { writeFile } from 'fs/promises';

const COLORS = {
  primary: '1e40af',
  secondary: '475569',
  accent: '7c3aed',
  success: '059669',
  warning: 'd97706',
  danger: 'dc2626',
  light: 'f8fafc',
  dark: '0f172a',
};

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ text, heading: level, spacing: { before: 400, after: 200 } });
}

function para(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, ...opts })],
    spacing: { after: 120 },
  });
}

function boldPara(label, value) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 22 }),
      new TextRun({ text: String(value ?? '—'), size: 22 }),
    ],
    spacing: { after: 80 },
  });
}

function bulletPoint(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    bullet: { level: 0 },
    spacing: { after: 60 },
  });
}

function makeTable(headers, rows) {
  const borderStyle = { style: BorderStyle.SINGLE, size: 1, color: 'cbd5e1' };
  const borders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };

  const headerRow = new TableRow({
    children: headers.map(h => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: 'ffffff' })], alignment: AlignmentType.CENTER })],
      shading: { type: ShadingType.SOLID, color: COLORS.primary },
      borders,
      width: { size: Math.floor(9000 / headers.length), type: WidthType.DXA },
    })),
  });

  const dataRows = rows.map((row, ri) => new TableRow({
    children: row.map(cell => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: String(cell ?? '—'), size: 20 })], alignment: AlignmentType.CENTER })],
      shading: ri % 2 === 0 ? {} : { type: ShadingType.SOLID, color: 'f1f5f9' },
      borders,
    })),
  }));

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 9000, type: WidthType.DXA },
  });
}

/**
 * Generate the full report document.
 */
export async function generateDocxReport(analysis, outputPath) {
  const chat = analysis.chatDigest || {};
  const uxEvents = analysis.uxcamEvents || {};
  const uxScreens = analysis.uxcamScreens || {};
  const retention = analysis.retention || {};
  const activeSubs = analysis.activeSubscriptions || {};
  const mrr = analysis.mrr || {};
  const actions = analysis.actions || [];
  const blockers = analysis.blockers || {};
  const sanityChecks = analysis.sanityChecks || [];
  const weekLabel = analysis.weekLabel;

  const sections = [];

  // ── Executive Summary ──
  sections.push(
    heading('Executive Summary'),
    para(`This report analyses Sylva's trial-to-subscription conversion funnel for the week ending ${weekLabel}. ` +
      `The analysis covers ${chat.statusCounts?.trial || 0} trial users and ${chat.statusCounts?.active || 0} paid users ` +
      `across Chat Digest, UXCam, and RevenueCat data sources.`),
    new Paragraph({ spacing: { after: 80 } }),
    boldPara('Active Subscriptions (Sylva)', activeSubs.latest?.sylva),
    boldPara('MRR', mrr.latest?.sylva ? `£${mrr.latest.sylva.toFixed(2)}` : '—'),
    boldPara('Trial-to-Paid Conversion', `~${chat.statusCounts?.active && chat.statusCounts?.trial ? ((chat.statusCounts.active / (chat.statusCounts.active + chat.statusCounts.trial)) * 100).toFixed(1) : '—'}%`),
    boldPara('Strongest Conversion Predictor', chat.strongestPredictor ? `${chat.strongestPredictor.metric} (${chat.strongestPredictor.ratio}x gap)` : '—'),
  );

  // ── Trial User Engagement Profile ──
  sections.push(
    heading('Trial User Engagement Profile'),
    para(`${chat.statusCounts?.trial || 0} unique trial users identified in Chat Digest data.`),
    new Paragraph({ spacing: { after: 80 } }),
    heading('Trial User Segments', HeadingLevel.HEADING_2),
    makeTable(
      ['Segment', 'Count', 'Description'],
      [
        ['High-engagement, no convert', chat.trialSegments?.high_engagement_no_convert ?? 0, '5+ sessions, 3+ days active'],
        ['Moderate, fading', chat.trialSegments?.moderate_fading ?? 0, '2-4 sessions, inactive >3 days'],
        ['Single session', chat.trialSegments?.single_session ?? 0, 'Only 1 chat session'],
        ['Active trial', chat.trialSegments?.active_trial ?? 0, 'Chat within last 48h'],
        ['Expired/lapsed', chat.trialSegments?.expired_lapsed ?? 0, 'Trial ended, no subscription'],
      ],
    ),
    new Paragraph({ spacing: { after: 200 } }),
    heading('Trial User Metrics', HeadingLevel.HEADING_2),
    boldPara('Median Sessions', chat.trialMetrics?.medianSessions),
    boldPara('Median Messages/Session', chat.trialMetrics?.medianMessagesPerSession),
    boldPara('Median Duration/Session', `${chat.trialMetrics?.medianDuration ?? '—'} min`),
    boldPara('Median CSAT', chat.trialMetrics?.medianCSAT),
    boldPara('Median Tests Completed', chat.trialMetrics?.medianTestsCompleted),
    boldPara('Mean PSS10 Before', chat.trialMetrics?.meanPSS10Before),
    boldPara('Mean PSS10 After', chat.trialMetrics?.meanPSS10After),
  );

  // ── Paid User Success Pattern ──
  sections.push(
    heading('Paid User Success Pattern'),
    para(`${chat.statusCounts?.active || 0} paid users analysed as the conversion benchmark.`),
    new Paragraph({ spacing: { after: 80 } }),
    boldPara('Median Sessions', chat.paidMetrics?.medianSessions),
    boldPara('Median Messages/Session', chat.paidMetrics?.medianMessagesPerSession),
    boldPara('Median Duration/Session', `${chat.paidMetrics?.medianDuration ?? '—'} min`),
    boldPara('Median CSAT', chat.paidMetrics?.medianCSAT),
    boldPara('Median Tests Completed', chat.paidMetrics?.medianTestsCompleted),
    boldPara('Mean PSS10 Before', chat.paidMetrics?.meanPSS10Before),
    boldPara('Mean PSS10 After', chat.paidMetrics?.meanPSS10After),
    boldPara('Median Days to Convert', chat.medianDaysToConvert),
  );

  // ── Engagement Gap Analysis ──
  sections.push(
    heading('Engagement Gap Analysis'),
    para('Side-by-side comparison of trial vs paid user behaviour metrics.'),
    new Paragraph({ spacing: { after: 80 } }),
  );

  const gapRows = [];
  const gaps = chat.engagementGaps || {};
  if (gaps.messagesPerSession) gapRows.push(['Messages/Session', gaps.messagesPerSession.trial, gaps.messagesPerSession.paid, gaps.messagesPerSession.ratio ? `${gaps.messagesPerSession.ratio}x` : '—']);
  if (gaps.duration) gapRows.push(['Duration (min)', gaps.duration.trial, gaps.duration.paid, gaps.duration.ratio ? `${gaps.duration.ratio}x` : '—']);
  if (gaps.testsCompleted) gapRows.push(['Tests Completed', gaps.testsCompleted.trial, gaps.testsCompleted.paid, gaps.testsCompleted.ratio ? `${gaps.testsCompleted.ratio}x` : '—']);
  if (gaps.csat) gapRows.push(['CSAT', gaps.csat.trial, gaps.csat.paid, '—']);
  if (gaps.sessions) gapRows.push(['Total Sessions', gaps.sessions.trial, gaps.sessions.paid, '—']);
  if (gaps.pss10Change) gapRows.push(['PSS10 Change', gaps.pss10Change.trial, gaps.pss10Change.paid, '—']);

  if (gapRows.length > 0) {
    sections.push(makeTable(['Metric', 'Trial', 'Paid', 'Gap'], gapRows));
  }

  if (chat.strongestPredictor) {
    sections.push(
      new Paragraph({ spacing: { after: 100 } }),
      para(`KEY FINDING: ${chat.strongestPredictor.metric} shows the largest gap between trial and paid users (${chat.strongestPredictor.ratio}x). ` +
        `This metric appears to be the strongest predictor of conversion.`, { bold: true, color: COLORS.primary }),
    );
  }

  // ── Subscription Sub-Funnel ──
  if (uxEvents.subscriptionFunnel) {
    sections.push(
      heading('Subscription Sub-Funnel'),
      para('Analysis of the subscription purchase flow from UXCam event data.'),
      new Paragraph({ spacing: { after: 80 } }),
      makeTable(
        ['Step', 'Unique Users', 'Drop Rate', 'Total Events'],
        uxEvents.subscriptionFunnel.map(s => [
          s.step.replace(/_/g, ' '),
          s.uniqueUsers,
          s.dropRate !== null ? `${s.dropRate}%` : '—',
          s.totalEvents,
        ]),
      ),
    );

    if (uxEvents.fromPageAnalysis) {
      sections.push(
        new Paragraph({ spacing: { after: 100 } }),
        heading('Pricing View Sources', HeadingLevel.HEADING_3),
      );
      for (const [event, sources] of Object.entries(uxEvents.fromPageAnalysis)) {
        sections.push(para(`${event}: ${Object.entries(sources).map(([k, v]) => `${k} (${v})`).join(', ')}`));
      }
    }
  }

  // ── Retention Cohort Analysis ──
  if (retention.cohorts && retention.cohorts.length > 0) {
    sections.push(
      heading('Retention Cohort Analysis'),
      boldPara('Total Historical Subscriptions', retention.totalSubscriptions),
      boldPara('Month 1 Retention', retention.month1Retention ? `${retention.month1Retention}%` : '—'),
      boldPara('Month 3 Retention', retention.month3Retention ? `${retention.month3Retention}%` : '—'),
      boldPara('Month 6 Retention', retention.month6Retention ? `${retention.month6Retention}%` : '—'),
      new Paragraph({ spacing: { after: 100 } }),
      heading('Benchmark Comparison', HeadingLevel.HEADING_3),
      makeTable(
        ['Metric', 'Sylva', 'H&F Median', 'H&F Top 10%'],
        [
          ['Trial → Paid', '~2.5%', '39.9%', '68.3%'],
          ['Month 1 Retention', `${retention.month1Retention ?? '—'}%`, '—', '—'],
        ],
      ),
    );
  }

  // ── Conversion Blockers ──
  sections.push(heading('Conversion Blockers'));

  const blockerCategories = [
    { key: 'valueDelivery', label: 'Value Delivery Blockers' },
    { key: 'valueAwareness', label: 'Value Awareness Blockers' },
    { key: 'pricingTiming', label: 'Pricing/Timing Blockers' },
    { key: 'trialExpiration', label: 'Trial Expiration Blockers' },
  ];

  for (const cat of blockerCategories) {
    const items = blockers[cat.key] || [];
    if (items.length > 0) {
      sections.push(heading(cat.label, HeadingLevel.HEADING_2));
      for (const b of items) {
        sections.push(
          bulletPoint(`[${b.severity.toUpperCase()}] ${b.finding}`),
          para(`  → ${b.implication}`, { italics: true, color: COLORS.secondary }),
        );
      }
    }
  }

  // ── Top Priority Actions ──
  sections.push(heading('Top Priority Actions'));

  for (const [i, action] of actions.entries()) {
    sections.push(
      heading(`${action.priority}: ${action.what}`, HeadingLevel.HEADING_2),
      boldPara('Why', action.why),
      boldPara('Who', action.who),
      boldPara('When', action.when),
      boldPara('Expected Impact', action.expectedImpact),
      new Paragraph({ spacing: { after: 200 } }),
    );
  }

  // ── Appendix ──
  sections.push(
    heading('Appendix'),
    heading('Trial User IDs for UXCam Review', HeadingLevel.HEADING_2),
  );

  const trialProfiles = chat.trialProfiles || [];
  const highEngagement = trialProfiles.filter(p => p.segment === 'high_engagement_no_convert');
  if (highEngagement.length > 0) {
    sections.push(para('High-engagement non-converting users:'));
    for (const p of highEngagement.slice(0, 20)) {
      sections.push(bulletPoint(`${p.userId} — ${p.totalSessions} sessions, ${p.testsCompletedCount} tests, CSAT ${p.meanCSAT ?? '—'}`));
    }
  }

  // ── Sanity Checks ──
  sections.push(
    heading('Sanity Checks', HeadingLevel.HEADING_2),
  );
  for (const check of sanityChecks) {
    const icon = check.passed ? 'PASS' : check.passed === false ? 'FAIL' : 'INFO';
    sections.push(para(`[${icon}] ${check.name}: ${check.detail}${check.note ? ` (${check.note})` : ''}`));
  }

  // Build document
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
        },
      },
    },
    sections: [{
      properties: {},
      children: sections,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  await writeFile(outputPath, buffer);
  console.log(`Report written to ${outputPath}`);
  return outputPath;
}

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ShadingType,
} from 'docx';
import type { AnalysisReport } from './orchestrator.js';
import type { NarrativeResult } from './claude-narrative.js';
import type { BaselineMetrics, ConversionBlocker, SanityCheckResult } from './types.js';

// === Helpers ===

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1): Paragraph {
  return new Paragraph({ text, heading: level, spacing: { before: 200, after: 100 } });
}

function para(text: string, bold = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold, size: 22 })],
    spacing: { after: 60 },
  });
}

function metricLine(label: string, value: string | number, prevValue?: string | number | null): Paragraph {
  const parts: TextRun[] = [
    new TextRun({ text: `${label}: `, bold: true, size: 22 }),
    new TextRun({ text: String(value), size: 22 }),
  ];
  if (prevValue !== undefined && prevValue !== null) {
    const numVal = typeof value === 'number' ? value : parseFloat(String(value));
    const numPrev = typeof prevValue === 'number' ? prevValue : parseFloat(String(prevValue));
    if (!isNaN(numVal) && !isNaN(numPrev) && numPrev !== 0) {
      const change = ((numVal - numPrev) / numPrev * 100).toFixed(1);
      const arrow = numVal >= numPrev ? '↑' : '↓';
      parts.push(new TextRun({ text: ` (${arrow}${change}% WoW)`, size: 20, color: numVal >= numPrev ? '228B22' : 'CC0000' }));
    }
  }
  return new Paragraph({ children: parts, spacing: { after: 40 } });
}

const CELL_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
} as const;

function tableCell(text: string, isHeader = false): TableCell {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, bold: isHeader, size: 20 })],
      alignment: AlignmentType.LEFT,
    })],
    borders: CELL_BORDER,
    shading: isHeader ? { type: ShadingType.SOLID, color: 'E8E8E8' } : undefined,
    width: { size: 0, type: WidthType.AUTO },
  });
}

function makeTable(headers: string[], rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headers.map(h => tableCell(h, true)) }),
      ...rows.map(row => new TableRow({ children: row.map(cell => tableCell(cell)) })),
    ],
  });
}

// === Report Builder ===

export async function generateDocxReport(
  report: AnalysisReport,
  narrative: NarrativeResult | null,
  prevBaseline: BaselineMetrics | null
): Promise<Buffer> {
  const sections: (Paragraph | Table)[] = [];
  const prev = prevBaseline;

  // Title
  sections.push(heading(`Sylva Weekly Product Report — ${report.weekLabel}`));
  sections.push(para(`Generated: ${new Date(report.analyzedAt).toLocaleDateString('en-GB')}`));

  // === Narrative (if available) ===
  if (narrative) {
    sections.push(heading('Executive Summary', HeadingLevel.HEADING_2));
    for (const line of narrative.executiveSummary.split('\n').filter(Boolean)) {
      sections.push(para(line));
    }
    if (narrative.weekOverWeekChanges) {
      sections.push(heading('Week-over-Week Changes', HeadingLevel.HEADING_2));
      for (const line of narrative.weekOverWeekChanges.split('\n').filter(Boolean)) {
        sections.push(para(line));
      }
    }
    if (narrative.topInsights) {
      sections.push(heading('Top Insights', HeadingLevel.HEADING_2));
      for (const line of narrative.topInsights.split('\n').filter(Boolean)) {
        sections.push(para(line));
      }
    }
    if (narrative.recommendations) {
      sections.push(heading('Recommendations', HeadingLevel.HEADING_2));
      for (const line of narrative.recommendations.split('\n').filter(Boolean)) {
        sections.push(para(line));
      }
    }
  }

  // === Baseline Metrics ===
  sections.push(heading('Key Metrics', HeadingLevel.HEADING_2));
  const b = report.baselineMetrics;
  sections.push(metricLine('Active Subscriptions', b.activeSubs, prev?.activeSubs));
  sections.push(metricLine('MRR', `£${b.mrr.toFixed(2)}`, prev?.mrr));
  sections.push(metricLine('New Customers', b.newCustomers, prev?.newCustomers));
  sections.push(metricLine('New Paying', b.newPaying, prev?.newPaying));
  sections.push(metricLine('W1 Retention', `${b.w1Retention}%`, prev?.w1Retention));
  sections.push(metricLine('Chat Sessions', b.chatSessions, prev?.chatSessions));
  sections.push(metricLine('Chat Unique Users', b.chatUniqueUsers, prev?.chatUniqueUsers));

  // === Onboarding Funnel ===
  if (report.onboardingFunnel) {
    sections.push(heading('Onboarding Funnel', HeadingLevel.HEADING_2));
    const funnelRows = report.onboardingFunnel.funnelTable.map(s => [
      s.step,
      String(s.usersReached),
      `${s.conversionFromPrev.toFixed(1)}%`,
      String(s.droppedHere),
    ]);
    sections.push(makeTable(['Step', 'Users Reached', 'Conversion', 'Dropped'], funnelRows));
  }

  // === Subscription Funnel ===
  if (report.subscriptionFunnel) {
    sections.push(heading('Subscription Funnel', HeadingLevel.HEADING_2));
    const subRows = report.subscriptionFunnel.funnel.map(s => [
      s.step,
      String(s.uniqueUsers),
      String(s.totalEvents),
    ]);
    sections.push(makeTable(['Step', 'Unique Users', 'Total Events'], subRows));
  }

  // === Trial Segmentation ===
  if (report.trialSegmentation) {
    sections.push(heading('Trial User Segments', HeadingLevel.HEADING_2));
    const seg = report.trialSegmentation;
    sections.push(metricLine('High Engagement (no convert)', seg.high_engagement_no_convert.length));
    sections.push(metricLine('Moderate Fading', seg.moderate_fading.length));
    sections.push(metricLine('Single Session', seg.single_session.length));
    sections.push(metricLine('Active Trial', seg.active_trial.length));
    sections.push(metricLine('Expired/Lapsed', seg.expired_lapsed.length));
  }

  // === Engagement Gap ===
  if (report.engagementComparison.length > 0) {
    sections.push(heading('Trial vs Paid Engagement', HeadingLevel.HEADING_2));
    const gapRows = report.engagementComparison.map(c => [
      c.metric,
      c.trialMedian !== null ? c.trialMedian.toFixed(1) : '—',
      c.paidMedian !== null ? c.paidMedian.toFixed(1) : '—',
      c.gapRatio !== null ? `${c.gapRatio.toFixed(1)}x` : '—',
    ]);
    sections.push(makeTable(['Metric', 'Trial Median', 'Paid Median', 'Gap'], gapRows));
    sections.push(para(`Strongest conversion predictor: ${report.strongestPredictor} (${report.strongestGap.toFixed(1)}x gap)`));
  }

  // === Screen Metrics ===
  if (report.screenMetrics.length > 0) {
    sections.push(heading('Screen Metrics', HeadingLevel.HEADING_2));
    const screenRows = report.screenMetrics.map(s => [
      s.screenName,
      String(s.totalSessions),
      `${s.bounceRate.toFixed(1)}%`,
      `${s.medianEngagementTime.toFixed(1)}s`,
      String(s.totalRage),
    ]);
    sections.push(makeTable(['Screen', 'Sessions', 'Bounce Rate', 'Median Engagement', 'Rage'], screenRows));
  }

  // === Conversion Blockers ===
  if (report.conversionBlockers.length > 0) {
    sections.push(heading('Conversion Blockers', HeadingLevel.HEADING_2));
    const blockerRows = report.conversionBlockers.map(b => [
      b.severity,
      b.category.replace(/_/g, ' '),
      b.title,
      b.evidence,
    ]);
    sections.push(makeTable(['Severity', 'Category', 'Issue', 'Evidence'], blockerRows));
  }

  // === Sanity Checks ===
  sections.push(heading('Sanity Checks', HeadingLevel.HEADING_2));
  const checkRows = report.sanityChecks.map(c => [
    c.level,
    c.check.replace(/_/g, ' '),
    c.message,
  ]);
  sections.push(makeTable(['Status', 'Check', 'Detail'], checkRows));

  // Build document
  const doc = new Document({
    sections: [{
      properties: {},
      children: sections,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

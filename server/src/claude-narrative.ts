import Anthropic from '@anthropic-ai/sdk';
import type { AnalysisReport } from './orchestrator.js';
import type { BaselineMetrics } from './types.js';

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (anthropicClient) return anthropicClient;
  anthropicClient = new Anthropic();
  return anthropicClient;
}

/**
 * Serialize report data for the prompt, stripping Maps to plain objects.
 */
function serializeForPrompt(report: AnalysisReport, prevBaseline: BaselineMetrics | null): string {
  const data: Record<string, unknown> = {
    weekLabel: report.weekLabel,
    chatSegments: report.chatSegments,
    trialSegmentation: report.trialSegmentation,
    engagementComparison: report.engagementComparison,
    strongestPredictor: report.strongestPredictor,
    strongestGap: report.strongestGap,
    trialProfileCount: report.trialProfiles.size,
    paidProfileCount: report.paidProfiles.size,
    onboardingFunnel: report.onboardingFunnel
      ? { funnelTable: report.onboardingFunnel.funnelTable, dropoffs: report.onboardingFunnel.dropoffs }
      : null,
    subscriptionFunnel: report.subscriptionFunnel
      ? { funnel: report.subscriptionFunnel.funnel, fromPageBreakdown: report.subscriptionFunnel.fromPageBreakdown, modalUserCount: report.subscriptionFunnel.modalUserCount }
      : null,
    screenMetrics: report.screenMetrics,
    conversionBlockers: report.conversionBlockers,
    sanityChecks: report.sanityChecks,
    baseline: report.baselineMetrics,
    prevBaseline,
    rcActiveSubs: report.rcActiveSubs,
    rcMrr: report.rcMrr,
    rcNewCustomers: report.rcNewCustomers,
    retentionCohorts: report.retentionCohorts.slice(0, 6),
    conversionData: report.conversionData.slice(-4),
  };
  return JSON.stringify(data, null, 2);
}

const SYSTEM_PROMPT = `You are a product analytics expert writing the narrative section of Sylva's weekly product report. Sylva is a mental health chatbot app for young people (teens/young adults) that uses a trial-to-subscription model.

Your job is to write a concise, data-driven executive summary and recommendations section. Rules:
- Every claim MUST reference specific numbers from the data provided.
- NEVER fabricate or interpolate numbers. If data is missing, say so.
- Use British English spelling (analyse, behaviour, colour, etc.).
- Keep the tone professional but accessible.
- Structure your response with clear headings.
- Compare to previous week (WoW) where data is available.
- Highlight the top 3 most actionable insights.
- Keep the total output under 800 words.`;

export interface NarrativeResult {
  executiveSummary: string;
  weekOverWeekChanges: string;
  topInsights: string;
  recommendations: string;
  fullNarrative: string;
}

/**
 * Generate a narrative summary using Claude.
 */
export async function generateNarrative(
  report: AnalysisReport,
  prevBaseline: BaselineMetrics | null
): Promise<NarrativeResult> {
  const client = getClient();
  const dataStr = serializeForPrompt(report, prevBaseline);

  const userPrompt = `Here is this week's analysis data for Sylva (week ${report.weekLabel}):

${dataStr}

Write the report narrative with these sections:
1. **Executive Summary** (3-4 sentences overview)
2. **Week-over-Week Changes** (compare key metrics to previous week if available)
3. **Top 3 Insights** (numbered, each with data evidence)
4. **Recommendations** (3-5 specific, actionable items with expected impact)

Format using Markdown headings (##).`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const fullNarrative = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  // Parse sections from markdown
  const sections = fullNarrative.split(/^##\s+/m).filter(Boolean);
  const findSection = (keyword: string) =>
    sections.find(s => s.toLowerCase().includes(keyword))?.trim() ?? '';

  return {
    executiveSummary: findSection('executive') || findSection('summary'),
    weekOverWeekChanges: findSection('week-over-week') || findSection('week over week'),
    topInsights: findSection('insight') || findSection('top 3'),
    recommendations: findSection('recommend'),
    fullNarrative,
  };
}

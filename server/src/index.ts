import express from 'express';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsvContent, groupBySourceType, type ParsedCsvFile } from './csv-reader.js';
import { runAnalysis, type AnalysisReport } from './orchestrator.js';
import { generateNarrative, type NarrativeResult } from './claude-narrative.js';
import { generateDocxReport } from './docx-report.js';
import { saveBaseline, loadPreviousBaseline } from './supabase-storage.js';
import type { BaselineMetrics } from './types.js';

const app = express();
const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

// Serve the frontend SPA from project root
const projectRoot = join(import.meta.dirname, '..', '..');
app.use(express.static(projectRoot, { index: 'index.html' }));
app.use(express.json({ limit: '50mb' }));

// Simple in-memory multipart parsing for CSV uploads
// Express 5 doesn't bundle body-parser for multipart; we parse raw bodies
app.use('/api', express.raw({ type: 'multipart/form-data', limit: '100mb' }));

// === State ===
let lastReport: AnalysisReport | null = null;
let lastNarrative: NarrativeResult | null = null;
let lastPrevBaseline: BaselineMetrics | null = null;

// Temp upload dir
const UPLOAD_DIR = join(import.meta.dirname, '..', 'uploads');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

// === Health ===
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

/**
 * POST /api/analyse
 * Accepts JSON body: { weekLabel, files: [{ name, content }], trialLengthDays?, filterProject? }
 * where content is the raw CSV text.
 */
app.post('/api/analyse', async (req, res) => {
  try {
    const body = req.body as {
      weekLabel: string;
      files: { name: string; content: string }[];
      trialLengthDays?: number;
      filterProject?: string;
    };

    if (!body.weekLabel || !body.files || body.files.length === 0) {
      res.status(400).json({ error: 'weekLabel and files[] are required' });
      return;
    }

    const parsedFiles: ParsedCsvFile[] = body.files.map(f =>
      parseCsvContent(f.content, f.name)
    );

    const filesByType = groupBySourceType(parsedFiles);
    const todayDate = new Date();
    const trialLengthDays = body.trialLengthDays ?? 7;
    const filterProject = body.filterProject ?? 'Sylva';

    const report = runAnalysis(filesByType, body.weekLabel, todayDate, trialLengthDays, filterProject);
    lastReport = report;

    // Try WoW comparison from Supabase (non-blocking if not configured)
    let prevBaseline: BaselineMetrics | null = null;
    try {
      prevBaseline = await loadPreviousBaseline(body.weekLabel);
    } catch {
      // Supabase not configured — skip
    }
    lastPrevBaseline = prevBaseline;

    // Try to save baseline to Supabase (non-blocking)
    try {
      await saveBaseline(report.baselineMetrics);
    } catch {
      // Supabase not configured — skip
    }

    // Serialize Maps to plain objects for JSON response
    const serialized = serializeReport(report);

    res.json({
      success: true,
      report: serialized,
      prevBaseline,
      sanityChecks: report.sanityChecks,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/narrative
 * Generate Claude narrative for the last analysis.
 */
app.post('/api/narrative', async (req, res) => {
  try {
    if (!lastReport) {
      res.status(400).json({ error: 'No analysis has been run yet. POST /api/analyse first.' });
      return;
    }

    const narrative = await generateNarrative(lastReport, lastPrevBaseline);
    lastNarrative = narrative;

    res.json({ success: true, narrative });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/report.docx
 * Download the DOCX report for the last analysis.
 */
app.get('/api/report.docx', async (_req, res) => {
  try {
    if (!lastReport) {
      res.status(400).json({ error: 'No analysis has been run yet.' });
      return;
    }

    const buffer = await generateDocxReport(lastReport, lastNarrative, lastPrevBaseline);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="sylva-report-${lastReport.weekLabel}.docx"`);
    res.send(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/report.json
 * Download the raw analysis JSON.
 */
app.get('/api/report.json', (_req, res) => {
  if (!lastReport) {
    res.status(400).json({ error: 'No analysis has been run yet.' });
    return;
  }
  res.json(serializeReport(lastReport));
});

// === Serialization helper (converts Maps to objects/arrays) ===

function serializeReport(report: AnalysisReport): Record<string, unknown> {
  return {
    weekLabel: report.weekLabel,
    analyzedAt: report.analyzedAt,
    chatSegments: report.chatSegments,
    trialProfiles: Object.fromEntries(report.trialProfiles),
    paidProfiles: Object.fromEntries(report.paidProfiles),
    trialSegmentation: report.trialSegmentation,
    engagementComparison: report.engagementComparison,
    strongestPredictor: report.strongestPredictor,
    strongestGap: report.strongestGap,
    onboardingFunnel: report.onboardingFunnel
      ? {
          funnelTable: report.onboardingFunnel.funnelTable,
          dropoffs: report.onboardingFunnel.dropoffs,
          userDeepestStep: Object.fromEntries(report.onboardingFunnel.userDeepestStep),
        }
      : null,
    subscriptionFunnel: report.subscriptionFunnel
      ? {
          funnel: report.subscriptionFunnel.funnel,
          fromPageBreakdown: report.subscriptionFunnel.fromPageBreakdown,
          modalUserCount: report.subscriptionFunnel.modalUserCount,
        }
      : null,
    dropoffAnalyses: Object.fromEntries(report.dropoffAnalyses),
    screenMetrics: report.screenMetrics,
    fuzzyMatches: report.fuzzyMatches,
    conversionData: report.conversionData,
    retentionCohorts: report.retentionCohorts,
    rcActiveSubs: report.rcActiveSubs,
    rcMrr: report.rcMrr,
    rcNewCustomers: report.rcNewCustomers,
    rcNewPaying: report.rcNewPaying,
    adjustW1Retention: report.adjustW1Retention,
    conversionBlockers: report.conversionBlockers,
    sanityChecks: report.sanityChecks,
    baselineMetrics: report.baselineMetrics,
  };
}

// === Start ===
app.listen(PORT, () => {
  console.log(`Sylva Report Server running on http://localhost:${PORT}`);
  console.log(`  POST /api/analyse     — Upload CSVs and run analysis`);
  console.log(`  POST /api/narrative   — Generate Claude narrative`);
  console.log(`  GET  /api/report.docx — Download Word report`);
  console.log(`  GET  /api/report.json — Download raw JSON`);
});

export default app;

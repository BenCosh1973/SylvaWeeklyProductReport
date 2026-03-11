/**
 * Persistent storage for weekly analysis results.
 * Stores processed metrics as JSON, indexed by week label.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const STORE_DIR = 'data/store';
const HISTORY_FILE = join(STORE_DIR, 'history.json');

async function ensureStoreDir() {
  await mkdir(STORE_DIR, { recursive: true });
}

/**
 * Load the full history of all weekly analyses.
 */
export async function loadHistory() {
  await ensureStoreDir();
  if (existsSync(HISTORY_FILE)) {
    return JSON.parse(await readFile(HISTORY_FILE, 'utf-8'));
  }
  return { weeks: {}, baselineNumbers: null };
}

/**
 * Save a week's analysis results.
 */
export async function saveWeekAnalysis(weekLabel, analysis) {
  const history = await loadHistory();
  history.weeks[weekLabel] = {
    analyzedAt: new Date().toISOString(),
    ...analysis,
  };
  await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));

  // Also save individual week file for easy access
  const weekFile = join(STORE_DIR, `${weekLabel}.json`);
  await writeFile(weekFile, JSON.stringify(analysis, null, 2));

  return history;
}

/**
 * Load a specific week's analysis.
 */
export async function loadWeekAnalysis(weekLabel) {
  const weekFile = join(STORE_DIR, `${weekLabel}.json`);
  if (existsSync(weekFile)) {
    return JSON.parse(await readFile(weekFile, 'utf-8'));
  }
  return null;
}

/**
 * Get trend data across all weeks for a specific metric path.
 * e.g. getTrend('trialMetrics.totalUsers') returns [{week, value}, ...]
 */
export async function getTrend(metricPath) {
  const history = await loadHistory();
  const trend = [];

  for (const [week, data] of Object.entries(history.weeks)) {
    const value = metricPath.split('.').reduce((obj, key) => obj?.[key], data);
    if (value !== undefined) {
      trend.push({ week, value });
    }
  }

  return trend.sort((a, b) => a.week.localeCompare(b.week));
}

/**
 * Compare two weeks' analyses.
 */
export async function compareWeeks(weekA, weekB) {
  const dataA = await loadWeekAnalysis(weekA);
  const dataB = await loadWeekAnalysis(weekB);
  if (!dataA || !dataB) return null;

  return { weekA: { label: weekA, data: dataA }, weekB: { label: weekB, data: dataB } };
}

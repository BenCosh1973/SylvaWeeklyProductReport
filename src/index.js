#!/usr/bin/env node
/**
 * Sylva Weekly Product Report — Main Orchestrator
 *
 * Usage:
 *   node src/index.js ingest [--dir path] [--week 2026-W11]
 *   node src/index.js analyze [--week 2026-W11]
 *   node src/index.js report [--week 2026-W11]
 *   node src/index.js all [--dir path] [--week 2026-W11]
 *   node src/index.js history
 */
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { ingestWeeklyData, currentWeekLabel, getDataFile, listWeeks } from './ingest/ingestor.js';
import { analyzeChatDigest } from './analysis/chatDigest.js';
import { analyzeUXCamEvents, analyzeUXCamUsers, analyzeUXCamSessions, analyzeUXCamScreens } from './analysis/uxcam.js';
import { analyzeConversion, analyzeRetention, analyzeActiveSubscriptions, analyzeMRR, analyzeNewCustomers, BENCHMARKS } from './analysis/revenuecat.js';
import { identifyBlockers, generateActions } from './analysis/blockers.js';
import { runSanityChecks } from './analysis/sanityChecks.js';
import { saveWeekAnalysis, loadWeekAnalysis } from './storage/store.js';
import { buildDashboard } from './report/buildDashboard.js';
import { generateDocxReport } from './report/docxReport.js';

const OUTPUT_DIR = 'output';

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';
  const opts = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--dir' && args[i + 1]) { opts.dir = args[++i]; }
    else if (args[i] === '--week' && args[i + 1]) { opts.week = args[++i]; }
  }

  return { command, ...opts };
}

async function runIngest(opts) {
  console.log('\n=== STEP 1: DATA INGESTION ===\n');
  const weekLabel = opts.week || currentWeekLabel();
  const incomingDir = opts.dir || 'data/incoming';

  const result = await ingestWeeklyData(incomingDir, weekLabel);
  console.log(`\nIngestion complete for ${result.weekLabel}`);

  // Summary of classified files
  const classified = result.classified;
  const types = Object.keys(classified);
  if (types.length === 0) {
    console.log('No files were classified. Place CSV files in data/incoming/ and try again.');
  } else {
    console.log(`Classified ${types.length} data type(s): ${types.join(', ')}`);
  }

  return result;
}

async function runAnalysis(weekLabel) {
  console.log('\n=== STEP 2: DATA ANALYSIS ===\n');
  weekLabel = weekLabel || currentWeekLabel();

  // Get file paths for each data type
  const files = {
    chatDigest: await getDataFile(weekLabel, 'chatDigest'),
    uxcamEvent: await getDataFile(weekLabel, 'uxcamEvent'),
    uxcamUser: await getDataFile(weekLabel, 'uxcamUser'),
    uxcamSession: await getDataFile(weekLabel, 'uxcamSession'),
    uxcamScreen: await getDataFile(weekLabel, 'uxcamScreen'),
    revenuecatConversion: await getDataFile(weekLabel, 'revenuecatConversion'),
    revenuecatRetention: await getDataFile(weekLabel, 'revenuecatRetention'),
    revenuecatActiveSubscriptions: await getDataFile(weekLabel, 'revenuecatActiveSubscriptions'),
    revenuecatMRR: await getDataFile(weekLabel, 'revenuecatMRR'),
    revenuecatNewCustomers: await getDataFile(weekLabel, 'revenuecatNewCustomers'),
  };

  console.log('Available data files:');
  for (const [type, path] of Object.entries(files)) {
    console.log(`  ${type}: ${path || 'NOT FOUND'}`);
  }
  console.log();

  // Run analyses
  const today = new Date();

  console.log('Analysing Chat Digest...');
  const chatDigest = files.chatDigest
    ? await analyzeChatDigest(files.chatDigest, today)
    : { error: 'No chat digest file found' };
  if (!chatDigest.error) {
    console.log(`  ${chatDigest.totalUsers} users, ${chatDigest.statusCounts.trial} trial, ${chatDigest.statusCounts.active} paid`);
  }

  console.log('Analysing UXCam Events...');
  const uxcamEvents = files.uxcamEvent
    ? await analyzeUXCamEvents(files.uxcamEvent)
    : { error: 'No UXCam event file found' };

  console.log('Analysing UXCam Users...');
  const uxcamUsers = files.uxcamUser
    ? await analyzeUXCamUsers(files.uxcamUser)
    : { error: 'No UXCam user file found' };

  console.log('Analysing UXCam Sessions...');
  const uxcamSessions = files.uxcamSession
    ? await analyzeUXCamSessions(files.uxcamSession)
    : { error: 'No UXCam session file found' };

  console.log('Analysing UXCam Screens...');
  const uxcamScreens = files.uxcamScreen
    ? await analyzeUXCamScreens(files.uxcamScreen)
    : { error: 'No UXCam screen file found' };

  console.log('Analysing RevenueCat Conversion...');
  const conversion = files.revenuecatConversion
    ? await analyzeConversion(files.revenuecatConversion)
    : { error: 'No conversion file found' };

  console.log('Analysing RevenueCat Retention...');
  const retention = files.revenuecatRetention
    ? await analyzeRetention(files.revenuecatRetention)
    : { error: 'No retention file found' };

  console.log('Analysing RevenueCat Active Subscriptions...');
  const activeSubscriptions = files.revenuecatActiveSubscriptions
    ? await analyzeActiveSubscriptions(files.revenuecatActiveSubscriptions)
    : { error: 'No active subscriptions file found' };

  console.log('Analysing RevenueCat MRR...');
  const mrrData = files.revenuecatMRR
    ? await analyzeMRR(files.revenuecatMRR)
    : { error: 'No MRR file found' };

  console.log('Analysing RevenueCat New Customers...');
  const newCustomers = files.revenuecatNewCustomers
    ? await analyzeNewCustomers(files.revenuecatNewCustomers)
    : { error: 'No new customers file found' };

  // Identify blockers and generate actions
  console.log('\nIdentifying conversion blockers...');
  const blockers = !chatDigest.error
    ? identifyBlockers(chatDigest, uxcamEvents, uxcamScreens)
    : {};

  console.log('Generating priority actions...');
  const actions = !chatDigest.error
    ? generateActions(blockers, chatDigest, uxcamEvents)
    : [];

  // Run sanity checks
  console.log('Running sanity checks...');
  const sanityChecks = runSanityChecks(
    chatDigest.error ? null : chatDigest,
    uxcamEvents.error ? null : uxcamEvents,
    uxcamUsers.error ? null : uxcamUsers,
    retention.error ? null : retention,
    conversion.error ? null : conversion,
    activeSubscriptions.error ? null : activeSubscriptions,
  );

  const passedChecks = sanityChecks.filter(c => c.passed).length;
  console.log(`  ${passedChecks}/${sanityChecks.length} checks passed`);

  const analysis = {
    weekLabel,
    analyzedAt: today.toISOString(),
    chatDigest: chatDigest.error ? { error: chatDigest.error } : chatDigest,
    uxcamEvents: uxcamEvents.error ? { error: uxcamEvents.error } : uxcamEvents,
    uxcamUsers: uxcamUsers.error ? { error: uxcamUsers.error } : uxcamUsers,
    uxcamSessions: uxcamSessions.error ? { error: uxcamSessions.error } : uxcamSessions,
    uxcamScreens: uxcamScreens.error ? { error: uxcamScreens.error } : uxcamScreens,
    conversion: conversion.error ? { error: conversion.error } : conversion,
    retention: retention.error ? { error: retention.error } : retention,
    activeSubscriptions: activeSubscriptions.error ? { error: activeSubscriptions.error } : activeSubscriptions,
    mrr: mrrData.error ? { error: mrrData.error } : mrrData,
    newCustomers: newCustomers.error ? { error: newCustomers.error } : newCustomers,
    blockers,
    actions,
    sanityChecks,
    benchmarks: BENCHMARKS,
  };

  // Save to persistent store
  await saveWeekAnalysis(weekLabel, analysis);
  console.log(`\nAnalysis saved for ${weekLabel}`);

  return analysis;
}

async function runReport(weekLabel) {
  console.log('\n=== STEP 3: REPORT GENERATION ===\n');
  weekLabel = weekLabel || currentWeekLabel();

  // Load analysis (run analysis first if not available)
  let analysis = await loadWeekAnalysis(weekLabel);
  if (!analysis) {
    console.log(`No analysis found for ${weekLabel}. Running analysis first...`);
    analysis = await runAnalysis(weekLabel);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const weekOutputDir = join(OUTPUT_DIR, weekLabel);
  await mkdir(weekOutputDir, { recursive: true });

  // Build dashboard
  console.log('Building interactive dashboard...');
  const dashboardPath = join(weekOutputDir, `sylva-dashboard-${weekLabel}.html`);
  await buildDashboard(analysis, dashboardPath);

  // Build Word document
  console.log('Generating Word document report...');
  const docxPath = join(weekOutputDir, `sylva-report-${weekLabel}.docx`);
  await generateDocxReport(analysis, docxPath);

  console.log(`\nReports generated in ${weekOutputDir}/`);
  console.log(`  Dashboard: ${dashboardPath}`);
  console.log(`  Word Report: ${docxPath}`);

  return { dashboardPath, docxPath };
}

async function showHistory() {
  const weeks = await listWeeks();
  if (weeks.length === 0) {
    console.log('No data has been ingested yet. Run: npm run ingest');
    return;
  }
  console.log('Ingested weeks:');
  for (const week of weeks) {
    const analysis = await loadWeekAnalysis(week);
    const status = analysis ? 'analysed' : 'ingested only';
    console.log(`  ${week} [${status}]`);
  }
}

// ── Main ──
async function main() {
  const { command, dir, week } = parseArgs();

  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║  Sylva Weekly Product Report                  ║');
  console.log('║  Trial → Subscription Drop-off Analysis       ║');
  console.log('╚═══════════════════════════════════════════════╝');

  switch (command) {
    case 'ingest':
      await runIngest({ dir, week });
      break;

    case 'analyze':
    case 'analyse':
      await runAnalysis(week);
      break;

    case 'report':
      await runReport(week);
      break;

    case 'all': {
      const ingestResult = await runIngest({ dir, week });
      const weekLabel = ingestResult.weekLabel;
      await runAnalysis(weekLabel);
      await runReport(weekLabel);
      console.log('\n=== ALL STEPS COMPLETE ===');
      break;
    }

    case 'history':
      await showHistory();
      break;

    default:
      console.log(`Unknown command: ${command}`);
      console.log('Usage: node src/index.js [ingest|analyze|report|all|history] [--dir path] [--week YYYY-WNN]');
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});

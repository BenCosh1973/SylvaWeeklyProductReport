/**
 * Data Ingestor — scans incoming directory, classifies files,
 * archives them by week, and records metadata.
 */
import { readdir, copyFile, mkdir, readFile, writeFile } from 'fs/promises';
import { join, basename, extname } from 'path';
import { existsSync } from 'fs';
import { format, getISOWeek, getISOWeekYear } from 'date-fns';
import { classifyFile, selectBestChatDigest } from './classifier.js';

const DATA_DIR = 'data';
const INCOMING_DIR = join(DATA_DIR, 'incoming');
const ARCHIVE_DIR = join(DATA_DIR, 'archive');
const MANIFEST_FILE = join(DATA_DIR, 'manifest.json');

/**
 * Get the current ISO week label, e.g. "2026-W11".
 */
export function currentWeekLabel(date = new Date()) {
  const year = getISOWeekYear(date);
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Load or create the manifest that tracks all ingested data.
 */
export async function loadManifest() {
  if (existsSync(MANIFEST_FILE)) {
    return JSON.parse(await readFile(MANIFEST_FILE, 'utf-8'));
  }
  return { weeks: {}, lastIngested: null };
}

async function saveManifest(manifest) {
  await writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
}

/**
 * Scan the incoming directory, classify all CSVs, archive them,
 * and return the classification results.
 */
export async function ingestWeeklyData(incomingDir = INCOMING_DIR, weekLabel = null) {
  weekLabel = weekLabel || currentWeekLabel();
  const weekDir = join(ARCHIVE_DIR, weekLabel);
  await mkdir(weekDir, { recursive: true });

  // Find all CSV files in the incoming directory
  let files;
  try {
    files = (await readdir(incomingDir))
      .filter(f => extname(f).toLowerCase() === '.csv')
      .map(f => join(incomingDir, f));
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`No incoming directory found at ${incomingDir}. Create it and add CSV files.`);
      return { weekLabel, files: [], classified: {} };
    }
    throw err;
  }

  if (files.length === 0) {
    console.log(`No CSV files found in ${incomingDir}.`);
    return { weekLabel, files: [], classified: {} };
  }

  console.log(`Found ${files.length} CSV file(s) in ${incomingDir}`);

  // Classify each file
  const classifiedFiles = [];
  for (const filePath of files) {
    const result = await classifyFile(filePath);
    classifiedFiles.push({
      ...result,
      originalPath: filePath,
      fileName: basename(filePath),
    });
    console.log(`  ${basename(filePath)} → ${result.type} (${result.confidence})`);
  }

  // Handle multiple Chat Digests — pick the best one
  const bestChatDigest = selectBestChatDigest(classifiedFiles);
  if (bestChatDigest) {
    console.log(`  Selected Chat Digest: ${bestChatDigest.fileName} (${bestChatDigest.rowCount} rows)`);
  }

  // Copy files to weekly archive
  const classified = {};
  for (const cf of classifiedFiles) {
    const destPath = join(weekDir, cf.fileName);
    await copyFile(cf.originalPath, destPath);

    // For chat digest, mark whether it's the selected one
    if (cf.type === 'chatDigest') {
      cf.isSelected = cf === bestChatDigest;
    }

    if (!classified[cf.type]) classified[cf.type] = [];
    classified[cf.type].push({
      fileName: cf.fileName,
      archivePath: destPath,
      headers: cf.headers,
      rowCount: cf.rowCount,
      isSelected: cf.isSelected,
    });
  }

  // Update manifest
  const manifest = await loadManifest();
  manifest.weeks[weekLabel] = {
    ingestedAt: new Date().toISOString(),
    files: classified,
  };
  manifest.lastIngested = weekLabel;
  await saveManifest(manifest);

  console.log(`Archived ${files.length} file(s) to ${weekDir}`);
  return { weekLabel, files: classifiedFiles, classified };
}

/**
 * Get the file path for a specific data type in a given week.
 * For chatDigest, returns the selected (largest) file.
 */
export async function getDataFile(weekLabel, dataType) {
  const manifest = await loadManifest();
  const week = manifest.weeks[weekLabel];
  if (!week || !week.files[dataType]) return null;

  const files = week.files[dataType];
  if (dataType === 'chatDigest') {
    const selected = files.find(f => f.isSelected);
    return selected ? selected.archivePath : files[0]?.archivePath;
  }
  return files[0]?.archivePath || null;
}

/**
 * List all ingested weeks.
 */
export async function listWeeks() {
  const manifest = await loadManifest();
  return Object.keys(manifest.weeks).sort();
}

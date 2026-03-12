import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';
import { classifyByHeaders, classifyFile } from './parsers/csv-classifier.js';
import type { ClassifiedFile, DataSourceType } from './types.js';

export interface ParsedCsvFile {
  classified: ClassifiedFile;
  headers: string[];
  rows: Record<string, string>[];
  rawRows: string[][];
}

/**
 * Read and parse a CSV file from disk, returning both structured rows and raw arrays.
 */
export function readCsvFile(filePath: string): ParsedCsvFile {
  const content = readFileSync(filePath, 'utf-8');
  return parseCsvContent(content, filePath);
}

/**
 * Parse CSV content from a string (e.g. from a file upload buffer).
 */
export function parseCsvContent(content: string, filename: string): ParsedCsvFile {
  // Parse as array of arrays for raw access (needed for RevenueCat triple-column)
  const rawRows: string[][] = parse(content, {
    relax_column_count: true,
    skip_empty_lines: true,
  });

  if (rawRows.length === 0) {
    return {
      classified: { filename, sourceType: 'unknown', rowCount: 0, dateRange: null, headers: [] },
      headers: [],
      rows: [],
      rawRows: [],
    };
  }

  const headers = rawRows[0];
  const dataRawRows = rawRows.slice(1);

  // Build record rows using headers
  const rows: Record<string, string>[] = dataRawRows.map(row => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = row[i] ?? '';
    }
    return obj;
  });

  // Classify
  const sampleRows = dataRawRows.slice(0, 5);
  const classified = classifyFile(filename, headers, dataRawRows.length, sampleRows);

  return { classified, headers, rows, rawRows };
}

/**
 * Given multiple parsed CSV files, group them by source type and pick the best (largest) for each type.
 */
export function groupBySourceType(files: ParsedCsvFile[]): Map<DataSourceType, ParsedCsvFile> {
  const groups = new Map<DataSourceType, ParsedCsvFile[]>();
  for (const f of files) {
    const type = f.classified.sourceType;
    if (type === 'unknown') continue;
    const arr = groups.get(type) ?? [];
    arr.push(f);
    groups.set(type, arr);
  }

  const best = new Map<DataSourceType, ParsedCsvFile>();
  for (const [type, arr] of groups) {
    // Pick highest row count
    arr.sort((a, b) => b.classified.rowCount - a.classified.rowCount);
    best.set(type, arr[0]);
  }
  return best;
}

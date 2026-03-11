/**
 * Shared CSV reading utility.
 */
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';

/**
 * Read all rows from a CSV file as objects (keyed by column headers).
 */
export async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    if (!filePath) { resolve([]); return; }
    const stream = createReadStream(filePath);
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        rows.push(record);
      }
    });
    parser.on('end', () => resolve(rows));
    parser.on('error', reject);
    stream.pipe(parser);
  });
}

/**
 * Parse a numeric value, returning null for invalid/empty values.
 */
export function num(val) {
  if (val === null || val === undefined || val === '' || val === 'NaN') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

/**
 * Calculate median of an array of numbers.
 */
export function median(arr) {
  const valid = arr.filter(v => v !== null && v !== undefined).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 !== 0 ? valid[mid] : (valid[mid - 1] + valid[mid]) / 2;
}

/**
 * Calculate mean of an array of numbers.
 */
export function mean(arr) {
  const valid = arr.filter(v => v !== null && v !== undefined);
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

/**
 * Get the most common value in an array.
 */
export function mode(arr) {
  const valid = arr.filter(v => v !== null && v !== undefined && v !== '' && v !== 'NaN');
  if (valid.length === 0) return null;
  const counts = {};
  for (const v of valid) {
    counts[v] = (counts[v] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Round a number to n decimal places.
 */
export function round(val, n = 1) {
  if (val === null || val === undefined) return null;
  return Math.round(val * 10 ** n) / 10 ** n;
}

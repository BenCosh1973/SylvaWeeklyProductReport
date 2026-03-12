import type { RevenueCatConversion, RevenueCatRetentionCohort } from '../types.js';

export function parseConversionCsv(rows: string[][], filterProject: string): RevenueCatConversion[] {
  throw new Error('Not implemented');
}

export function parseRetentionCsv(rows: string[][]): RevenueCatRetentionCohort[] {
  throw new Error('Not implemented');
}

export function parseSimpleCsv(rows: string[][], filterProject: string): { date: string; value: number }[] {
  throw new Error('Not implemented');
}

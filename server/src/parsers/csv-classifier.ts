import type { ClassifiedFile, DataSourceType } from '../types.js';

export function classifyByHeaders(headers: string[]): DataSourceType {
  throw new Error('Not implemented');
}

export function classifyFile(filename: string, headers: string[], rowCount: number, sampleRows?: string[][]): ClassifiedFile {
  throw new Error('Not implemented');
}

export function selectBestFile(files: ClassifiedFile[]): ClassifiedFile {
  throw new Error('Not implemented');
}

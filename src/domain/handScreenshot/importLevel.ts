import type { Detection } from './types';

export type ImportLevelMode = 'maximum' | 'current';
export interface ImportDetection extends Detection {
  levelOverrides?: Partial<Record<ImportLevelMode, number | undefined>>;
}

/** Keep OCR evidence intact for uncaps and retain edits separately for each mode. */
export function getImportLevel(row: ImportDetection, mode: ImportLevelMode): number | undefined {
  if (row.levelOverrides && Object.prototype.hasOwnProperty.call(row.levelOverrides, mode)) return row.levelOverrides[mode];
  return mode === 'maximum' ? row.maxLevel : row.level;
}

export function setImportLevel(row: ImportDetection, mode: ImportLevelMode, value: string): void {
  row.levelOverrides ??= {};
  row.levelOverrides[mode] = value === '' ? undefined : Number(value);
}

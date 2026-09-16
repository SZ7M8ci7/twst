import type { Detection } from './types';

/** A limit-break screenshot supplements the cards in the main screenshots. */
export function uncapSourceFiles(rows: Detection[]): Set<number> {
  return new Set(rows.filter(row=>row.displayMode==='uncaps').map(row=>row.fileIndex));
}

export function primaryDetections<T extends Detection>(rows: T[]): T[] {
  const supplemental=uncapSourceFiles(rows);
  return rows.filter(row=>!supplemental.has(row.fileIndex));
}

export function combinedDetections<T extends Detection>(rows: T[]): T[] {
  const primary=primaryDetections(rows), keys=new Set(primary.map(row=>row.selected).filter(Boolean));
  const supplemental=uncapSourceFiles(rows);
  return [...primary,...rows.filter(row=>supplemental.has(row.fileIndex)&&keys.has(row.selected))];
}

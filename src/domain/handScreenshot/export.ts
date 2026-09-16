import type { Detection } from './types';
import { primaryDetections } from './supplement';

export function moveImage(order: number[], index: number, offset: number): number[] {
  const next = order.slice(), target = index + offset;
  if (index < 0 || target < 0 || index >= next.length || target >= next.length) return next;
  next.splice(target, 0, next.splice(index, 1)[0]);
  return next;
}

export function orderedCards(rows: Detection[], order: number[]): Detection[] {
  const primary=primaryDetections(rows);
  return order.flatMap(fileIndex => primary.filter(row => row.fileIndex === fileIndex).sort((a, b) =>
    Math.abs(a.box.y - b.box.y) < Math.min(a.box.width, b.box.width) * .3 ? a.box.x - b.box.x : a.box.y - b.box.y));
}

export function samePortrait(a: Uint8ClampedArray, b: Uint8ClampedArray, sameCard: boolean): boolean {
  if (a.length !== b.length || !a.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 4) for (let c = 0; c < 3; c++) difference += Math.abs(a[i + c] - b[i + c]);
  return difference / (a.length / 4 * 3) < (sameCard ? 18 : 7);
}

export type ExportPage = { url: string; width: number; height: number };
export async function exportCollection(files: File[], rows: Detection[], order: number[]): Promise<{ pages: ExportPage[]; count: number; duplicates: number }> {
  const portraits: { row: Detection; signature: Uint8ClampedArray }[] = [], pages: ExportPage[] = [];
  const selected = orderedCards(rows, order);
  const cardWidth = 146, cardHeight = 187, columns = 6, gap = 24, margin = 42;
  const perPage = columns * 45, pageWidth = margin * 2 + columns * cardWidth + (columns - 1) * gap;
  // Decode one source at a time, not all uploads at once.
  const signatureCanvas = document.createElement('canvas'); signatureCanvas.width = signatureCanvas.height = 32;
  const signatureContext = signatureCanvas.getContext('2d', { willReadFrequently: true })!;
  for (const fileIndex of order) {
    if (!selected.some(row=>row.fileIndex===fileIndex)) continue;
    const bitmap = await createImageBitmap(files[fileIndex]);
    try {
      for (const row of selected.filter(row => row.fileIndex === fileIndex)) {
        const b = row.box;
        signatureContext.drawImage(bitmap, b.x + b.width * .08, b.y + b.width * .22, b.width * .78, b.width * .64, 0, 0, 32, 32);
        const signature = signatureContext.getImageData(0, 0, 32, 32).data;
        const duplicate = portraits.some(other => other.row.fileIndex !== fileIndex &&
          (!row.selected || !other.row.selected || row.selected === other.row.selected) &&
          samePortrait(signature, other.signature, !!row.selected && row.selected === other.row.selected));
        if (!duplicate) portraits.push({ row, signature });
      }
    } finally { bitmap.close(); }
  }
  try {
    for (let start = 0; start < portraits.length; start += perPage) {
      const group = portraits.slice(start, start + perPage), rowCount = Math.ceil(group.length / columns);
      const canvas = document.createElement('canvas'); canvas.width = pageWidth; canvas.height = margin * 2 + rowCount * cardHeight + (rowCount - 1) * gap;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#f4f1e9'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = '#ad9c70'; context.lineWidth = 3; context.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
      context.lineWidth = 1; context.strokeRect(19, 19, canvas.width - 38, canvas.height - 38);
      for (const fileIndex of order) {
        if (!group.some(p => p.row.fileIndex === fileIndex)) continue;
        const bitmap = await createImageBitmap(files[fileIndex]);
        try {
          group.forEach(({ row }, i) => {
            if (row.fileIndex !== fileIndex) return;
            const b = row.box, x = margin + i % columns * (cardWidth + gap), y = margin + Math.floor(i / columns) * (cardHeight + gap);
            context.drawImage(bitmap, b.x, b.y, b.width, Math.min(b.width * 1.28, bitmap.height - b.y), x, y, cardWidth, cardHeight);
          });
        } finally { bitmap.close(); }
      }
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Image encoding failed')), 'image/png'));
      pages.push({ url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height });
      canvas.width = canvas.height = 1;
    }
    return { pages, count: portraits.length, duplicates: selected.length - portraits.length };
  } catch (error) { pages.forEach(page => URL.revokeObjectURL(page.url)); throw error; }
}

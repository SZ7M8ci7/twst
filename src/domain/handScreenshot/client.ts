import type { Box, Detection } from './types';
import { loadDataset, type DatasetProgress } from './dataset';
import { recognizeLevels } from './levelOcr';
import { abortable } from './abortable';
import { levelRegion, prepareLevelImage, readUncaps } from './metadata';
import { createWorker, PSM, type Worker as OcrWorker } from 'tesseract.js';

// Resolve beside the application entry, independent of the current history route.
function publicAsset(directory: string) {
  const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src]');
  return new URL('../' + directory + '/', entry?.src ?? document.baseURI).href;
}

export function crop(bitmap: ImageBitmap, box: Box, width = Math.round(box.width), height = Math.round(box.height)) {
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, width); canvas.height = Math.max(1, height);
  canvas.getContext('2d')!.drawImage(bitmap, box.x, box.y, box.width, box.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}
export class ScreenshotSession {
  private worker = new Worker(new URL('../../workers/handScreenshot.worker.ts', import.meta.url), { type: 'module' });
  private sequence = 0;
  private callbacks = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  private ocr?: OcrWorker;
  readonly abort = new AbortController();
  constructor() {
    this.worker.onmessage = event => {
      const callback = this.callbacks.get(event.data.id); if (!callback) return;
      this.callbacks.delete(event.data.id);
      if (event.data.type === 'error') callback.reject(new Error(event.data.error)); else callback.resolve(event.data);
    };
    this.worker.onerror = () => this.stop(new Error('Image recognition worker failed'));
  }
  private request(message: any, transfer: Transferable[] = []) {
    this.abort.signal.throwIfAborted();
    return new Promise<any>((resolve, reject) => {
      const id = ++this.sequence;
      this.callbacks.set(id, { resolve, reject }); this.worker.postMessage({ ...message, id }, transfer);
    });
  }
  async load(progress: (phase: DatasetProgress) => void) {
    const data = await loadDataset(publicAsset('recognition'), this.abort.signal, progress);
    await this.request({ type: 'load', index: data.index, features: data.features }, [data.features]);
    return data;
  }
  async analyze(file: File, fileIndex: number, progress: (done: number, total: number) => void, manualBox?: Box): Promise<Detection[]> {
    if (file.size > 30_000_000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Unsupported image');
    const bitmap = await createImageBitmap(file);
    try {
      if (bitmap.width * bitmap.height > 24_000_000 || Math.max(bitmap.width, bitmap.height) > 24000) throw new Error('Image dimensions too large');
      const boxes: Box[] = [];
      if (manualBox) boxes.push(manualBox);
      else {
        // Horizontal strips retain small icons in stitched screenshots.
        const scale = Math.min(1, 1400 / bitmap.width), stripHeight = Math.round(1200 / scale), overlap = Math.round(240 / scale);
        for (let y = 0; y < bitmap.height; y += stripHeight - overlap) {
          const height = Math.min(stripHeight, bitmap.height - y);
          const scout = crop(bitmap, { x: 0, y, width: bitmap.width, height }, Math.round(bitmap.width * scale), Math.round(height * scale));
          const image = scout.getContext('2d')!.getImageData(0, 0, scout.width, scout.height);
          const result = await this.request({ type: 'detect', image }, [image.data.buffer]);
          for (const box of result.boxes as Box[]) {
            const original = { x: box.x / scale, y: y + box.y / scale, width: box.width / scale, height: box.height / scale };
            if (!boxes.some(b => Math.abs(b.x - original.x) < original.width * .4 && Math.abs(b.y - original.y) < original.height * .4)) boxes.push(original);
          }
          scout.width = scout.height = 1;
          if (y + height >= bitmap.height) break;
        }
      }
      if (boxes.length > 300) throw new Error('Too many cards in one image');
      const detections: Detection[] = [];
      for (const box of boxes) {
        this.abort.signal.throwIfAborted();
        const canvas = crop(bitmap, box, 128, 128), image = canvas.getContext('2d')!.getImageData(0, 0, 128, 128);
        const { result } = await this.request({ type: 'match', image, box, fileIndex }, [image.data.buffer]);
        const context = crop(bitmap, { ...box, height: Math.min(box.width * 1.28, bitmap.height-box.y) }, 256, Math.round(Math.min(box.width*1.28,bitmap.height-box.y)/box.width*256));
        result.thumbnail = context.toDataURL('image/webp', .9);
        Object.assign(result, readUncaps(context.getContext('2d')!.getImageData(0,0,context.width,context.height)));
        if (result.totsuEvidence !== 'dots') {
          try {
            if (!this.ocr) {
              const base = publicAsset('recognition-runtime/v7');
              this.ocr = await abortable(createWorker('eng', 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base, workerBlobURL: false, errorHandler: () => {} }).then(worker => {
                if (this.abort.signal.aborted) { void worker.terminate(); this.abort.signal.throwIfAborted(); }
                return worker;
              }), this.abort.signal);
              await abortable(this.ocr.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789/Lv', user_defined_dpi: '150' }), this.abort.signal);
            }
            const levelBox = levelRegion(box, bitmap.height);
            if (levelBox.height > 0) {
              // Encode before handing the image to OCR. Its asynchronous Canvas
              // encoder can otherwise send to a worker that was just terminated.
              const raw = crop(bitmap, levelBox);
              const prepared = prepareLevelImage(raw.getContext('2d')!.getImageData(0,0,raw.width,raw.height));
              if (!prepared) { detections.push(result); progress(detections.length, boxes.length); continue; }
              const levels = await recognizeLevels(this.ocr, prepared, pixels => {
                const clean = document.createElement('canvas'); clean.width=pixels.width; clean.height=pixels.height;
                clean.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels.data),pixels.width,pixels.height),0,0);
                return clean.toDataURL('image/png');
              }, this.abort.signal);
              if (levels) Object.assign(result, levels);
            }
          } catch (error) {
            if (this.abort.signal.aborted) throw error;
            // Identity remains usable even when an OCR asset or number is unavailable.
          }
        }
        detections.push(result); progress(detections.length, boxes.length);
      }
      // Keep source classification separate from editable recognition evidence.
      if (detections.length && detections.filter(row=>row.totsuEvidence==='dots').length >= Math.ceil(detections.length/2)) {
        for (const row of detections) {
          row.displayMode='uncaps';
          delete row.level; delete row.maxLevel;
          // Include the last 4% of the portrait above the footer for visual context.
          const y=row.box.y+row.box.width*.96;
          const strip=crop(bitmap,{x:row.box.x,y,width:row.box.width,height:Math.min(row.box.width*.32,bitmap.height-y)},256,82);
          row.uncapThumbnail=strip.toDataURL('image/webp',.95);
        }
      }
      return detections;
    } finally { bitmap.close(); }
  }
  stop(error: Error = new DOMException('Cancelled', 'AbortError')) {
    this.abort.abort(error); this.worker.terminate(); void this.ocr?.terminate();
    for (const callback of this.callbacks.values()) callback.reject(error);
    this.callbacks.clear();
  }
}

import cvModule from '@techstark/opencv-js';
import { Recognizer, detectBoxes, detectionResult } from '@/domain/handScreenshot/recognizer';
import type { Box } from '@/domain/handScreenshot/types';

let recognizer: Recognizer;
const cvReady = Promise.resolve(cvModule as any);
self.onmessage = async (event: MessageEvent) => {
  const { id, type } = event.data;
  try {
    const cv = await cvReady;
    if (type === 'load') {
      recognizer = new Recognizer(cv, event.data.index, event.data.features);
      self.postMessage({ id, type: 'ready' });
    } else if (type === 'detect') {
      self.postMessage({ id, type: 'boxes', boxes: detectBoxes(cv, event.data.image) });
    } else if (type === 'match') {
      const { image, box, fileIndex } = event.data as { image: ImageData; box: Box; fileIndex: number };
      self.postMessage({ id, type: 'result', result: detectionResult(String(id), fileIndex, box, recognizer.match(image)) });
    }
  } catch (error) { self.postMessage({ id, type: 'error', error: error instanceof Error ? error.message : String(error) }); }
};

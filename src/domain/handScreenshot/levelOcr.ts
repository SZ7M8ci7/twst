import { PSM, type Worker } from 'tesseract.js';
import { parseLevels } from './types';
import { levelGlyphs, type Pixels } from './metadata';
import { abortable } from './abortable';

export async function recognizeLevels(worker: Worker, prepared: Pixels, encode: (image: Pixels) => Parameters<Worker['recognize']>[0], signal: AbortSignal) {
  const input = encode(prepared);
  try {
    for (const mode of [PSM.SINGLE_LINE, PSM.RAW_LINE]) {
      await abortable(worker.setParameters({ tessedit_pageseg_mode: mode, tessedit_char_whitelist: '0123456789/Lv' }), signal);
      const { data } = await abortable(worker.recognize(input), signal);
      const levels = parseLevels(data.text, data.confidence);
      if (levels) return levels;
    }
    const glyphs = levelGlyphs(prepared);
    if (!glyphs) return undefined;
    await abortable(worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_CHAR, tessedit_char_whitelist: '0123456789' }), signal);
    let text = '', confidence = 0;
    for (const glyph of glyphs) {
      if (glyph.symbol) { text += glyph.symbol; confidence += 90; continue; }
      const { data } = await abortable(worker.recognize(encode(glyph.image)), signal);
      const digit = data.text.trim();
      if (!/^\d$/.test(digit) || data.confidence < 70) return undefined;
      text += digit; confidence += data.confidence;
    }
    return parseLevels(text, confidence / glyphs.length);
  } finally {
    if (!signal.aborted) await abortable(worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789/Lv' }), signal);
  }
}

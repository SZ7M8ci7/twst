import type { Pixels } from './metadata';

export type GroovyStatus = 'present' | 'absent' | 'unknown';
export interface GroovySource { width: number; complete: boolean }

/**
 * Read the corner marker only, never artwork variants. Absence needs a sharp,
 * uninterrupted frame and readable corner; unverified/obscured crops stay unknown.
 * This is a conservative check of the supported list layout, not image-forgery detection.
 */
export function readGroovyStatus(image: Pixels, source?: GroovySource): GroovyStatus {
  const { width: w, height: h, data } = image;
  if (!source?.complete || !Number.isFinite(source.width) || source.width < 96 ||
      !Number.isInteger(w) || !Number.isInteger(h) || w < 160 || h < w * 1.20 || data.length < w * h * 4) return 'unknown';
  const value = (x: number, y: number, channel: number) => data[(y * w + x) * 4 + channel];
  const brightness = (x: number, y: number) => (value(x, y, 0) + value(x, y, 1) + value(x, y, 2)) / 3;
  const step = Math.max(2, Math.round(w * .018));

  // Boxes can start at attribute flags rather than the artwork. Locate the
  // footer divider in two clear spans: a left-side COLLECT label can cover one
  // span, while the central span remains outside the diagonal ribbon.
  const baselines = new Set<number>();
  for (const [start, end] of [[.14, .58], [.58, .70]]) {
    let baseline = -1, best = -Infinity;
    for (let y = Math.round(w * .96); y <= Math.round(w * 1.075); y++) {
      let score = 0, count = 0;
      for (let x = Math.round(w * start); x < Math.round(w * end); x++) {
        score += brightness(x, y) - (brightness(x, y - step) + brightness(x, y + step)) / 2; count++;
      }
      score /= count;
      if (score > best) { baseline = y; best = score; }
    }
    // A dark frame has a weaker peak; validate its nearby candidates with
    // both continuous crossings and sharpness rather than the peak alone.
    if (best >= 8) for (let dy = -step; dy <= step; dy++) baselines.add(baseline + dy);
  }
  let absent = false;
  for (const baseline of baselines) {
    const status = readAlignedStatus(image, baseline, source.width);
    if (status === 'present') return status;
    if (status === 'absent') absent = true;
  }
  return absent ? 'absent' : 'unknown';
}

function readAlignedStatus(image: Pixels, baseline: number, sourceWidth: number): GroovyStatus {
  const { width: w, height: h, data } = image;
  const value = (x: number, y: number, channel: number) => data[(y * w + x) * 4 + channel];
  const step = Math.max(2, Math.round(w * .018));
  const offset = baseline - w;
  const normalized = new Uint8ClampedArray(w * Math.round(w * 1.1) * 4);
  for (let y = 0; y < normalized.length / (w * 4); y++) {
    const from = y + offset;
    if (from >= 0 && from < h) normalized.set(data.subarray(from * w * 4, (from + 1) * w * 4), y * w * 4);
  }
  const aligned = { width: w, height: normalized.length / (w * 4), data: normalized };
  for (let y = Math.floor(w * .68); y < w; y++) for (let x = Math.floor(w * .68); x < w; x++) {
    if (normalized[(y * w + x) * 4 + 3] < 250) return 'unknown';
  }
  if (hasGroovyRibbon(aligned, sourceWidth)) return 'present';


  // A bounded opaque rectangular replacement is unreadable. Natural artwork
  // may be flat; reject geometric covers rather than low portrait variance.
  const centerX = Math.round(w * .885), centerY = Math.round(w * .915);
  const center = (centerY * w + centerX) * 4;
  const same = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return normalized[i + 3] >= 250 && [0, 1, 2].every(c => Math.abs(normalized[i + c] - normalized[center + c]) <= 1);
  };
  const queue = [centerY * w + centerX], visited = new Set(queue);
  let minX = centerX, maxX = centerX, minY = centerY, maxY = centerY;
  for (let j = 0; j < queue.length; j++) {
    const x = queue[j] % w, y = Math.floor(queue[j] / w);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      const p = ny * w + nx;
      if (nx >= Math.floor(w * .68) && nx < w && ny >= Math.floor(w * .68) && ny < w && !visited.has(p) && same(nx, ny)) { visited.add(p); queue.push(p); }
    }
  }
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  if (cw >= w * .08 && ch >= w * .08 && cw <= w * .25 && ch <= w * .25 && queue.length / (cw * ch) >= .95) return 'unknown';

  const mean = (horizontal: boolean, position: number, start: number, end: number) => {
    const color = [0, 0, 0]; let count = 0;
    for (let along = Math.round(w * start); along < Math.round(w * end); along++) {
      const x = horizontal ? along : position, y = horizontal ? position : along + offset;
      if (x < 0 || x >= w || y < 0 || y >= h || value(x, y, 3) < 250) return;
      for (let c = 0; c < 3; c++) color[c] += value(x, y, c);
      count++;
    }
    return color.map(total => total / count);
  };
  const light = (color: number[]) => color.reduce((sum, c) => sum + c, 0) / 3;
  const readableFrame = (color: number[], outer: number[], inner: number[], minimum: number) => {
    const level = light(color), contrast = Math.max(Math.abs(level - light(outer)), Math.abs(level - light(inner)));
    // Darker gold frames can still be sharp. Require much stronger local
    // contrast for these, rather than lowering the bright-frame threshold.
    return contrast >= minimum && (level >= 165 || (level >= 40 && contrast >= Math.max(20, level * .3)));
  };
  const intactLine = (horizontal: boolean, position: number) => {
    const controls = horizontal ? [[.20, .55], [.58, .68]] : [[.20, .55]];
    for (const [controlStart, controlEnd] of controls) {
      const control = mean(horizontal, position, controlStart, controlEnd);
      const outer = mean(horizontal, position + step, controlStart, controlEnd);
      const inner = mean(horizontal, position - step, controlStart, controlEnd);
      if (!control || !outer || !inner || !readableFrame(control, outer, inner, 22)) continue;
      const nearOuter = mean(horizontal, position + 1, controlStart, controlEnd), nearInner = mean(horizontal, position - 1, controlStart, controlEnd);
      if (!nearOuter || !nearInner) continue;
      // Search one native pixel around the frame: interpolation can create a
      // short plateau, while a blurred edge spreads its contrast more widely.
      const broadContrast = Math.max(Math.abs(light(control) - light(outer)), Math.abs(light(control) - light(inner)));
      let nearContrast = 0;
      for (let delta = -Math.ceil(w / sourceWidth); delta <= Math.ceil(w / sourceWidth); delta++) {
        const a = mean(horizontal, position + delta, controlStart, controlEnd), b = mean(horizontal, position + delta + 1, controlStart, controlEnd);
        if (a && b) nearContrast = Math.max(nearContrast, Math.abs(light(a) - light(b)));
      }
      if (nearContrast < broadContrast * .23) continue;
      let intact = true;
      for (const [start, end] of [[.70, .77], [.77, .84], [.84, .91]]) {
        const target = mean(horizontal, position, start, end);
        const outside = mean(horizontal, position + step, start, end), inside = mean(horizontal, position - step, start, end);
        if (!target || !outside || !inside || !readableFrame(target, outside, inside, 20) ||
            // Even a faded purple crossing is not evidence of an absent ribbon.
            Math.min(target[0], target[2]) - target[1] > 8 ||
            Math.max(...target.map((c, i) => Math.abs(c - control[i]))) > 42) { intact = false; break; }
      }
      if (intact) return true;
    }
    return false;
  };
  if (!intactLine(true, baseline)) return 'unknown';
  // The right frame must also continue through the marker's expected crossing.
  for (let x = Math.round(w * .945); x <= Math.round(w * .98); x++) {
    if (intactLine(false, x)) return 'absent';
  }
  return 'unknown';
}

/** Positive visual evidence only. False also covers cropped or unreadable ribbons. */
export function hasGroovyRibbon(image: Pixels, sourceWidth = image.width): boolean {
  const { width: w, height: h, data } = image;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 160 || h < w || data.length < w * h * 4) return false;
  // Upsampling cannot restore the half-pixel rounding at a small source's star
  // boundary. Account for that native quantization only in its minimum extent;
  // shape, position, diagonal band and both satellite marks remain mandatory.
  const pixelTolerance = Number.isFinite(sourceWidth) && sourceWidth >= 96 && sourceWidth < w
    ? .5 * w / sourceWidth : 0;
  const minimumStarExtent = w * .025 - pixelTolerance;
  const magenta = (x: number, y: number) => {
    const i = (y * w + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    return r > 130 && b > 100 && r - g > 60 && b - g > 45;
  };
  const white = (x: number, y: number, minimum: number, range: number) => {
    const i = (y * w + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    return Math.min(r, g, b) > minimum && Math.max(r, g, b) - Math.min(r, g, b) < range;
  };

  // Find the large white star, not just purple artwork in this corner.
  // A ~100px source has a smaller antialiased white core after resizing, so
  // retain its full diagonal band and both satellite marks as evidence.
  const left = Math.floor(w * .83), right = Math.ceil(w * .95);
  const top = Math.floor(w * .86), bottom = Math.min(w, Math.ceil(w * .97));
  const visited = new Set<number>();
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    const start = y * w + x;
    if (visited.has(start) || !white(x, y, 190, 75)) continue;
    const points = [start]; visited.add(start);
    let minX = x, maxX = x, minY = y, maxY = y, sumX = 0, sumY = 0;
    for (let j = 0; j < points.length; j++) {
      const px = points[j] % w, py = Math.floor(points[j] / w);
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py); sumX += px; sumY += py;
      for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
        const p = ny * w + nx;
        if (nx >= left && nx < right && ny >= top && ny < bottom && !visited.has(p) && white(nx, ny, 190, 75)) {
          visited.add(p); points.push(p);
        }
      }
    }
    const sw = maxX - minX + 1, sh = maxY - minY + 1, fill = points.length / (sw * sh);
    if (sw < minimumStarExtent || sw > w * .085 || sh < minimumStarExtent || sh > w * .085 || sw / sh < .55 || sw / sh > 1.8 || fill < .25 || fill > .72) continue;
    const cx = sumX / points.length / w, cy = sumY / points.length / w, diagonal = cx + cy;
    if (cx < .85 || cx > .93 || cy < .88 || cy > .96 || diagonal < 1.75 || diagonal > 1.85) continue;

    // A ribbon crosses the whole corner along x+y=constant. Require pink on
    // both sides of the star and a distinct boundary outside the diagonal band.
    const colored = [0, 0, 0], total = [0, 0, 0];
    let outside = 0, outsideTotal = 0, bandStrength = 0;
    const outerStrength = [0, 0], outerCount = [0, 0];
    const purpleStrength = (x: number, y: number) => {
      const i = (y * w + x) * 4;
      return Math.min(data[i], data[i + 2]) - data[i + 1];
    };
    for (let py = Math.floor(w * .68); py < w; py++) for (let px = Math.floor(w * .68); px < w; px++) {
      const distance = (px + py) / w - diagonal, along = (px - py) / w;
      if (Math.abs(distance) < .065 && along > -.23 && along < .23) {
        const section = along < -.075 ? 0 : along > .075 ? 2 : 1;
        total[section]++; bandStrength += purpleStrength(px, py);
        if (magenta(px, py)) colored[section]++;
      } else if (Math.abs(distance) > .12 && Math.abs(distance) < .16 && Math.abs(along) < .18) {
        outsideTotal++; if (magenta(px, py)) outside++;
        const side = distance < 0 ? 0 : 1;
        outerCount[side]++; outerStrength[side] += purpleStrength(px, py);
      }
    }
    // Purple artwork beside a real band is valid. Its boundary can instead be
    // proven by a stronger purple colour inside the band on BOTH outer sides.
    // A uniformly purple corner with sparkles has no such boundary.
    const innerMean = bandStrength / total.reduce((sum, count) => sum + count, 0);
    const distinctBoundary = outerCount.every((count, i) => count >= 8 && innerMean - outerStrength[i] / count >= 30);
    if (total.some((count, i) => !count || colored[i] / count < .58) || !outsideTotal ||
        (outside / outsideTotal > .3 && !distinctBoundary)) continue;

    // The two smaller white marks bracket the star along that same diagonal.
    // Requiring the motif avoids accepting a generic pink stripe with one blob.
    const satellite = (sx: number, sy: number) => {
      let count = 0;
      for (let py = Math.max(0, Math.floor((sy - .016) * w)); py < Math.min(w, Math.ceil((sy + .016) * w)); py++) {
        for (let px = Math.max(0, Math.floor((sx - .016) * w)); px < Math.min(w, Math.ceil((sx + .016) * w)); px++) {
          // JPEG compression blends these tiny marks with the purple band.
          // Keep both marks and the central star/full-band checks, while
          // accepting the dimmer, slightly tinted cores of compressed marks.
          if (white(px, py, 130, 125)) count++;
        }
      }
      return count >= Math.max(1, Math.ceil(w * w * .000018));
    };
    if (satellite(cx - .058, cy + .058) && satellite(cx + .054, cy - .054)) return true;
  }
  return false;
}

import type { Box, Candidate, DatasetIndex, Detection } from './types';
import { geometricScore, type Match } from './geometry';

const bitCounts = new Uint8Array(65536);
for (let i = 1; i < bitCounts.length; i++) bitCounts[i] = bitCounts[i >>> 1] + (i & 1);

// OpenCV is injected so the same engine can be tested under Node and in a Worker.
export class Recognizer {
  private bytes: Uint8Array;
  private words: Uint32Array;
  private view: DataView;
  private offsets: Uint32Array;
  private owners: Uint16Array;
  private buckets = new Map<number, Uint32Array>();
  constructor(private cv: any, private index: DatasetIndex, features: ArrayBuffer) {
    this.bytes = new Uint8Array(features); this.words = new Uint32Array(features); this.view = new DataView(features);
    const count = index.templates.reduce((total, template) => total + template.count, 0);
    this.offsets = new Uint32Array(count); this.owners = new Uint16Array(count);
    const buckets = new Map<number, number[]>(); let next = 0;
    index.templates.forEach((template, owner) => {
      for (let i = 0; i < template.count; i++) {
        const offset = template.offset + i * 40, id = next++;
        this.offsets[id] = offset; this.owners[id] = owner;
        for (let band = 0; band < 6; band++) {
          const key = this.band(this.bytes, offset + 8, band);
          const bucket = buckets.get(key) ?? [];
          bucket.push(id); buckets.set(key, bucket);
        }
      }
    });
    for (const [key, ids] of buckets) { this.buckets.set(key, Uint32Array.from(ids)); buckets.delete(key); }
  }
  private band(data: Uint8Array, offset: number, band: number) {
    const start = offset + band * 5;
    return band * 4096 + ((data[start] << 4) | (data[start + 1] & 15));
  }
  private distance(q: Uint32Array, qo: number, ro: number) {
    let distance = 0;
    for (let b = 0; b < 8; b++) {
      const difference = q[qo + b] ^ this.words[ro + b];
      distance += bitCounts[difference & 65535] + bitCounts[difference >>> 16];
      if (distance > 72) break;
    }
    return distance;
  }
  private shortlist(descriptors: Uint8Array, rows: number) {
    const aligned = descriptors.byteOffset % 4 ? descriptors.slice() : descriptors;
    const words = new Uint32Array(aligned.buffer, aligned.byteOffset, aligned.byteLength / 4);
    const votes = new Float32Array(this.index.templates.length);
    const visited = new Int32Array(this.offsets.length).fill(-1);
    const perOwner = new Float32Array(votes.length);
    for (let row = 0; row < rows; row += 2) {
      perOwner.fill(0);
      for (let band = 0; band < 6; band++) {
        for (const id of this.buckets.get(this.band(descriptors, row * 32, band)) ?? []) {
          if (visited[id] === row) continue;
          visited[id] = row;
          const distance = this.distance(words, row * 8, (this.offsets[id] + 8) / 4);
          if (distance < 65) perOwner[this.owners[id]] = Math.max(perOwner[this.owners[id]], (65 - distance) / 20);
        }
      }
      for (let owner = 0; owner < votes.length; owner++) votes[owner] += perOwner[owner];
    }
    return [...votes].map((score, owner) => ({ score, owner })).sort((a, b) => b.score - a.score).slice(0, 14).map(v => v.owner);
  }
  match(image: ImageData): { candidates: Candidate[]; confident: boolean } {
    let best = this.matchAtSize(image, 128);
    if (best.confident) return best;
    // A larger sampling scale recovers small facial details without making
    // every card pay for a second pass or assuming a particular screenshot size.
    for (const size of [192, 224, 256]) {
      const retry = this.matchAtSize(image, size);
      if (retry.confident) return retry;
      if ((retry.candidates[0]?.score ?? 0) > (best.candidates[0]?.score ?? 0)) best = retry;
    }
    return best;
  }
  private matchAtSize(image: ImageData, querySize: number): { candidates: Candidate[]; confident: boolean } {
    const cv = this.cv, source = cv.matFromImageData(image), gray = new cv.Mat(), resized = new cv.Mat();
    const keypoints = new cv.KeyPointVector(), descriptors = new cv.Mat(), mask = new cv.Mat();
    const orb = new cv.ORB(640, 1.2, 10, 8, 0, 2, 0, 31, 7);
    try {
      cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
      cv.resize(gray, resized, new cv.Size(querySize, querySize), 0, 0, cv.INTER_AREA);
      // UI flags and the lower-right Groovy banner are not identity evidence.
      mask.create(querySize, querySize, cv.CV_8UC1); mask.setTo(new cv.Scalar(255));
      cv.rectangle(mask, new cv.Point(Math.round(45 * querySize / 128), 0), new cv.Point(querySize - 1, Math.round(25 * querySize / 128)), new cv.Scalar(0), -1);
      cv.rectangle(mask, new cv.Point(Math.round(105 * querySize / 128), Math.round(101 * querySize / 128)), new cv.Point(querySize - 1, querySize - 1), new cv.Scalar(0), -1);
      orb.detectAndCompute(resized, mask, keypoints, descriptors);
      if (!descriptors.rows) return { candidates: [], confident: false };
      const candidates: (Candidate & { spread: number; ratio: number })[] = [];
      for (const owner of this.shortlist(descriptors.data, descriptors.rows)) {
        const template = this.index.templates[owner];
        const train = new cv.Mat(template.count, 32, cv.CV_8UC1);
        for (let i = 0; i < template.count; i++) train.data.set(this.bytes.subarray(template.offset + i * 40 + 8, template.offset + i * 40 + 40), i * 32);
        const matcher = new cv.BFMatcher(cv.NORM_HAMMING, false), matches = new cv.DMatchVectorVector();
        try {
          matcher.knnMatch(descriptors, train, matches, 2);
          const good: Match[] = [], seenReference = new Set<number>();
          for (let i = 0; i < matches.size(); i++) {
            const pair = matches.get(i);
            try {
              if (pair.size() < 2) continue;
              const first = pair.get(0), second = pair.get(1);
              if (first.distance >= 72 || first.distance >= .76 * second.distance || seenReference.has(first.trainIdx)) continue;
              seenReference.add(first.trainIdx);
              const point = keypoints.get(first.queryIdx).pt, offset = template.offset + first.trainIdx * 40;
              good.push({ qx: point.x * 128 / querySize, qy: point.y * 128 / querySize, x: this.view.getFloat32(offset, true), y: this.view.getFloat32(offset + 4, true), distance: first.distance });
            } finally { pair.delete(); }
          }
          const geometry = geometricScore(good);
          candidates.push({ cardKey: template.cardKey, variant: template.variant, score: geometry.inliers + geometry.spread * 5, ...geometry });
        } finally { matcher.delete(); matches.delete(); train.delete(); }
      }
      const distinct = new Map<string, typeof candidates[number]>();
      for (const candidate of candidates) if (!distinct.has(candidate.cardKey) || distinct.get(candidate.cardKey)!.score < candidate.score) distinct.set(candidate.cardKey, candidate);
      const ranked = [...distinct.values()].sort((a, b) => b.score - a.score);
      const best = ranked[0], second = ranked[1];
      const confident = !!best && best.inliers >= 10 && best.spread >= .10 && best.ratio >= .40 && (!second || best.score - second.score >= 6);
      return { candidates: ranked.filter(c => c.inliers >= 3).slice(0, 3), confident };
    } finally { orb.delete(); mask.delete(); descriptors.delete(); keypoints.delete(); resized.delete(); gray.delete(); source.delete(); }
  }
}

export function detectBoxes(cv: any, image: ImageData): Box[] {
  const src = cv.matFromImageData(image), gray = new cv.Mat(), edges = new cv.Mat(), hierarchy = new cv.Mat();
  const contours = new cv.MatVector(), kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY); cv.Canny(gray, edges, 40, 120);
    cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    const candidates: (Box & { area: number; support: number })[] = [];
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      try {
        const rect = cv.boundingRect(contour), ratio = rect.height / rect.width;
        if (rect.width < 26 || rect.width > image.width * .40 || ratio < .85 || ratio > 1.35 || rect.y + rect.height >= image.height - 2) continue;
        const area = Math.abs(cv.contourArea(contour));
        if (area < rect.width * rect.height * .62) continue;
        candidates.push({ ...rect, area, support: 0 });
      } finally { contour.delete(); }
    }
    for (const candidate of candidates) {
      candidate.support = candidates.filter(other => other !== candidate && Math.abs(other.width - candidate.width) < candidate.width * .15 &&
        ((Math.abs(other.y - candidate.y) < candidate.width * .12 && Math.abs(other.x - candidate.x) > candidate.width * .8) ||
         (Math.abs(other.x - candidate.x) < candidate.width * .12 && Math.abs(other.y - candidate.y) > candidate.width * .8))).length;
    }
    const selected: Box[] = [];
    // A row of tiny attribute flags also repeats. Prefer enclosing card frames
    // before deduplicating so those flags cannot suppress their own cards.
    for (const candidate of candidates.sort((a, b) => b.area - a.area)) {
      if (candidate.support < 1) continue;
      if (selected.some(other => Math.abs(other.x - candidate.x) < Math.max(other.width, candidate.width) * .65 && Math.abs(other.y - candidate.y) < Math.max(other.height, candidate.height) * .65)) continue;
      // Discard the level strip while retaining the square artwork.
      selected.push({ x: candidate.x, y: candidate.y, width: candidate.width, height: Math.min(candidate.height, candidate.width) });
      if (selected.length >= 300) break;
    }
    const largest = Math.max(...selected.map(b => b.width));
    return selected.filter(b => b.width >= largest * .65).sort((a, b) => Math.abs(a.y - b.y) < Math.min(a.width, b.width) * .15 ? a.x - b.x : a.y - b.y);
  } finally { src.delete(); gray.delete(); edges.delete(); contours.delete(); hierarchy.delete(); kernel.delete(); }
}

export function detectionResult(id: string, fileIndex: number, box: Box, result: ReturnType<Recognizer['match']>): Detection {
  return { id, fileIndex, box, ...result, selected: result.confident ? result.candidates[0].cardKey : '' };
}

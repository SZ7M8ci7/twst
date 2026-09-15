export interface Match { qx: number; qy: number; x: number; y: number; distance: number }
export function geometricScore(matches: Match[]): { inliers: number; spread: number; ratio: number } {
  if (matches.length < 4) return { inliers: 0, spread: 0, ratio: 0 };
  let best: Match[] = [];
  const sorted = matches.slice().sort((a, b) => a.distance - b.distance).slice(0, 120);
  for (let trial = 0; trial < Math.min(180, sorted.length * 6); trial++) {
    const p = sorted[trial % sorted.length], q = sorted[(trial * 17 + 7) % sorted.length];
    const dx = q.qx - p.qx, dy = q.qy - p.qy, length = dx * dx + dy * dy;
    if (length < 150) continue;
    const rx = q.x - p.x, ry = q.y - p.y;
    const a = (rx * dx + ry * dy) / length, b = (ry * dx - rx * dy) / length;
    const scale = Math.hypot(a, b);
    if (scale < .15 || scale > 20) continue;
    const tx = p.x - a * p.qx + b * p.qy, ty = p.y - b * p.qx - a * p.qy;
    const threshold = Math.max(3, scale * 3);
    const inliers = sorted.filter(m => Math.hypot(a * m.qx - b * m.qy + tx - m.x, b * m.qx + a * m.qy + ty - m.y) < threshold);
    if (inliers.length > best.length) best = inliers;
  }
  if (!best.length) return { inliers: 0, spread: 0, ratio: 0 };
  const xs = best.map(m => m.qx), ys = best.map(m => m.qy);
  return { inliers: best.length, spread: (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) / (128 * 128), ratio: best.length / sorted.length };
}

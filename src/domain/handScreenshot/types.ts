export const EXTRACTOR = 'orb-art-catalog-diverse-v5';
export const DATASET_SOURCE = 'https://twst.wikiru.jp/';
export interface AssetPart { path: string; sha256: string; bytes: number }
export interface Template {
  id: string; cardKey: string; variant: 'normal' | 'groovy' | 'catalog'; kind: 'icon' | 'art';
  count: number; offset: number; width: number; height: number; thumbnail?: string;
  sourceHash: string; sourceUrl: string; retained?: boolean;
}
export interface DatasetIndex {
  schemaVersion: number; extractor: string; templates: Template[];
  cards: { cardKey: string; name: string; normal: boolean; groovy: boolean; reason?: string }[];
}
export interface DatasetManifest {
  schemaVersion: number; extractor: string; datasetVersion: string; checkedAt: string;
  catalogHash: string; cardCount: number; readyCount: number; pending: string[];
  source: string;
  index: AssetPart;
  features: { parts: AssetPart[]; bytes: number };
}
export interface Box { x: number; y: number; width: number; height: number }
export interface Candidate { cardKey: string; variant: string; score: number; inliers: number }
export interface Detection {
  id: string; fileIndex: number; box: Box; candidates: Candidate[]; confident: boolean;
  selected: string; level?: number; maxLevel?: number; levelConflict?: boolean; thumbnail?: string;
  totsu?: number; totsuEvidence?: 'dots' | 'black-frame' | 'magic3' | 'max-level' | 'unknown' | 'manual';
}

export function parseLevels(text: string, confidence: number): { level: number; maxLevel: number } | undefined {
  if (confidence < 75) return undefined;
  const match = text.replace(/\s/g, '').match(/^(?:Lv)?(\d{1,3})\/(\d{1,3})$/i);
  if (!match) return undefined;
  const level = Number(match[1]), max = Number(match[2]);
  return level >= 1 && max <= 120 && level <= max ? { level, maxLevel: max } : undefined;
}

export function parseLevel(text: string, confidence: number): number | undefined {
  return parseLevels(text, confidence)?.level;
}

export function mergeDetections(detections: Detection[]): { cardKey: string; level?: number; conflict: boolean; totsu?: number; totsuConflict?: boolean }[] {
  const cards = new Map<string, Set<number>>();
  const uncaps = new Map<string, Set<number>>();
  const uncapPriority = new Map<string, number>();
  for (const detection of detections) {
    if (!detection.selected) continue;
    const levels = cards.get(detection.selected) ?? new Set<number>();
    if (Number.isInteger(detection.level) && detection.level! > 0 && detection.level! <= 120) levels.add(detection.level!);
    cards.set(detection.selected, levels);
    const priority=detection.totsuEvidence==='manual'?3:detection.totsuEvidence==='dots'?2:1;
    if(detection.totsuEvidence==='manual'||(Number.isInteger(detection.totsu)&&detection.totsu!>=0&&detection.totsu!<=4)) {
      const previousPriority=uncapPriority.get(detection.selected)??0;
      if(priority>=previousPriority) {
        const values=priority>previousPriority?new Set<number>():uncaps.get(detection.selected)??new Set<number>();
        if(Number.isInteger(detection.totsu)&&detection.totsu!>=0&&detection.totsu!<=4)values.add(detection.totsu!);
        uncaps.set(detection.selected,values);uncapPriority.set(detection.selected,priority);
      }
    }
  }
  return [...cards].map(([cardKey, levels]) => {
    const values=uncaps.get(cardKey)??new Set<number>();
    return { cardKey, level: levels.size === 1 ? [...levels][0] : undefined, conflict: levels.size > 1,
      ...(values.size===1?{totsu:[...values][0]}:{}), ...(values.size>1?{totsuConflict:true}:{}) };
  });
}

export function validateIndex(index: DatasetIndex, bytes: number): void {
  if (index.schemaVersion !== 2 || index.extractor !== EXTRACTOR || !Array.isArray(index.templates) || !index.templates.length || index.templates.length > 5000 || !Array.isArray(index.cards)) throw new Error('Unsupported dictionary');
  const seen = new Set<string>();
  for (const template of index.templates) {
    const allowedSource = template.kind === 'art' ? (template.sourceUrl?.startsWith(DATASET_SOURCE + 'attach2/') || template.sourceUrl?.startsWith('https://cdn.gamerch.com/contents/wiki/5992/entry/')) : template.kind === 'icon' && template.sourceUrl === 'app-icons/' + template.cardKey + '.webp';
    if (!allowedSource || !/^[a-f0-9]{64}$/.test(template.sourceHash) || seen.has(template.id) || typeof template.cardKey !== 'string' || !Number.isInteger(template.offset) || template.offset < 0 || template.offset % 4 || !Number.isInteger(template.count) || template.count < 1 || template.count > 3000 || template.offset + template.count * 40 > bytes) throw new Error('Invalid dictionary');
    seen.add(template.id);
  }
}

import type { HandCard } from '@/store/handCollection';
import { getInputMaxLevel, isValidInputLevel } from '@/constants/levels';
import { deriveTotsuCount } from '@/utils/totsu';

interface ImportCard { name: string; chara: string; costume: string; rare: string }
export interface HandImportIssue {
  cardName: string;
  field: 'level' | 'totsu';
  value: string;
  max: number;
}

function importNumber(value: unknown): number {
  if (value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return NaN;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function parseHandCollectionImport(text: string, catalog: ImportCard[]) {
  const updates: { cardName: string; values: Partial<HandCard> }[] = [];
  const issues: HandImportIssue[] = [];
  const stage = (card: ImportCard, rawLevel: unknown, rawTotsu: unknown, isOwned?: unknown) => {
    const level = importNumber(rawLevel), totsu = importNumber(rawTotsu);
    const cardIssues: HandImportIssue[] = [];
    if (!isValidInputLevel(level, card.rare)) cardIssues.push({
      cardName: card.name, field: 'level', value: String(rawLevel), max: getInputMaxLevel(card.rare),
    });
    if (!Number.isInteger(totsu) || totsu < 0 || totsu > 4) cardIssues.push({
      cardName: card.name, field: 'totsu', value: String(rawTotsu), max: 4,
    });
    issues.push(...cardIssues);
    if (!cardIssues.length) updates.push({ cardName: card.name, values: { level, totsu, isOwned: isOwned === undefined ? level > 0 : isOwned as boolean } });
  };
  let parsed: unknown, json = false;
  try { parsed = JSON.parse(text.trim()); json = true; } catch {
    if (/^[{[]/.test(text.trim())) throw new Error('Invalid JSON hand collection');
    // Legacy tab-separated data.
  }
  if (json) {
    if (!isRecord(parsed) || (parsed.format !== undefined &&
        !['twst-hand-collection-v1', 'twst-hand-collection-v2', 'twst-hand-collection-v3'].includes(parsed.format as string))) {
      throw new Error('Unsupported hand collection format');
    }
    // The old local version1 envelope and bare card maps can also be assigned
    // through this importer without changing their saved source data.
    const source = parsed.cards ?? (parsed.version === 1 ? parsed.data :
      parsed.format === undefined && parsed.version === undefined ? parsed : undefined);
    if (!Array.isArray(source) && !isRecord(source)) throw new Error('Invalid hand collection cards');
    const entries = Array.isArray(source) ? source
      : Object.entries(source).map(([cardName, value]) => {
        if (!isRecord(value)) throw new Error('Invalid hand collection card');
        return { ...value, cardName };
      });
    for (const entry of entries) {
      if (!isRecord(entry) || ['isOwned', 'isM3', 'isLimitBreak'].some(field =>
        entry[field] !== undefined && typeof entry[field] !== 'boolean')) throw new Error('Invalid hand collection ownership');
      const card = catalog.find(card => (entry.cardName && card.name === entry.cardName)
        || (entry.chara && entry.costume && card.chara === entry.chara && card.costume === entry.costume));
      if (card) stage(card, entry.level, entry.totsu === undefined ? deriveTotsuCount(entry) : entry.totsu, entry.isOwned);
    }
  } else {
    for (const line of text.split(/\r?\n/).filter(line => line.trim())) {
      const parts = line.split('\t');
      if (parts.length !== 5 && parts.length !== 7) continue;
      const [chara, costume, level, , hasM3, isOwned, isLimitBreak] = parts;
      const card = catalog.find(card => card.chara === chara && card.costume === costume);
      if (card && [hasM3, ...(parts.length === 7 ? [isOwned, isLimitBreak] : [])].some(value => !/^(true|false)$/i.test(value))) {
        throw new Error('Invalid legacy ownership value');
      }
      if (card) stage(card, level, deriveTotsuCount({
        isM3: hasM3.toLowerCase() === 'true', isLimitBreak: isLimitBreak?.toLowerCase() === 'true',
      }), parts.length === 7 ? isOwned.toLowerCase() === 'true' : undefined);
    }
  }
  if (!updates.length && !issues.length) throw new Error('No importable hand collection data found');
  // Conflicting duplicate entries must not overwrite a card that needs review.
  const reviewNames = new Set(issues.map(issue => issue.cardName));
  return { updates: updates.filter(update => !reviewNames.has(update.cardName)), issues };
}

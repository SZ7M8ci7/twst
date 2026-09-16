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
    if (!cardIssues.length) updates.push({ cardName: card.name, values: { level, totsu, isOwned: Boolean(isOwned ?? level > 0) } });
  };
  let parsed: any;
  try { parsed = JSON.parse(text.trim()); } catch { /* Legacy tab-separated data. */ }
  if (parsed && typeof parsed === 'object') {
    const entries = Array.isArray(parsed.cards) ? parsed.cards
      : Object.entries(parsed.cards || {}).map(([cardName, value]) => ({ cardName, ...(value as object) }));
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const card = catalog.find(card => (entry.cardName && card.name === entry.cardName)
        || (entry.chara && entry.costume && card.chara === entry.chara && card.costume === entry.costume));
      if (card) stage(card, entry.level, entry.totsu, entry.isOwned);
    }
  } else {
    for (const line of text.split(/\r?\n/).filter(line => line.trim())) {
      const parts = line.split('\t');
      if (parts.length !== 5 && parts.length !== 7) continue;
      const [chara, costume, level, , hasM3, isOwned, isLimitBreak] = parts;
      const card = catalog.find(card => card.chara === chara && card.costume === costume);
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

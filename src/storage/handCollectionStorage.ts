import type { HandCollection } from '@/store/handCollection';
import { isValidInputLevel } from '@/constants/levels';

export const HAND_COLLECTION_STORAGE_KEY = 'twst-hand-collection';
export const MAX_HAND_COLLECTION_SETS = 5;
export const HAND_COLLECTION_SETS_BACKUP_FORMAT = 'twst-hand-collection-sets-v1';
export interface HandCollectionSet { id: string; name: string; data: HandCollection; slot?: number }
export interface HandCollectionDocument { version: 2; activeSetId: string | null; sets: HandCollectionSet[]; activeSlot?: number }

export class HandCollectionStorageError extends Error {
  constructor(public readonly reason: 'invalid' | 'version' | 'conflict' | 'unavailable' | 'limit' | 'confirmation') {
    super(`Hand collection storage: ${reason}`);
  }
}

function storage(): Storage {
  if (typeof window === 'undefined' || !window.localStorage) throw new HandCollectionStorageError('unavailable');
  return window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function validateHandCollection(value: unknown): HandCollection {
  if (!isRecord(value) || Object.entries(value).some(([key, card]) =>
    ['__proto__', 'constructor', 'prototype'].includes(key) || !isRecord(card) ||
    ['isOwned', 'isLimitBreak', 'isM3'].some(field => card[field] !== undefined && typeof card[field] !== 'boolean') ||
    ['characterName', 'cardName'].some(field => card[field] !== undefined && typeof card[field] !== 'string') ||
    (card.totsu !== undefined && (typeof card.totsu !== 'number' || !Number.isInteger(card.totsu) || card.totsu < 0 || card.totsu > 4)) ||
    (card.level !== undefined && (typeof card.level !== 'number' || !Number.isFinite(card.level) || card.level < 0))
  )) throw new HandCollectionStorageError('invalid');
  // Card images, URLs and unrelated fields never become saved hand settings.
  const fields = ['characterName', 'cardName', 'isOwned', 'level', 'totsu', 'isLimitBreak', 'isM3'];
  return Object.fromEntries(Object.entries(value).map(([key, card]) => [key,
    Object.fromEntries(fields.filter(field => (card as Record<string, unknown>)[field] !== undefined)
      .map(field => [field, (card as Record<string, unknown>)[field]])),
  ])) as unknown as HandCollection;
}

export function validateHandCollectionDocument(value: unknown): HandCollectionDocument {
  if (!isRecord(value)) throw new HandCollectionStorageError('invalid');
  if (value.version !== 2) throw new HandCollectionStorageError('version');
  if (!Array.isArray(value.sets)) throw new HandCollectionStorageError('invalid');
  if (value.sets.length > MAX_HAND_COLLECTION_SETS) throw new HandCollectionStorageError('limit');
  const ids = new Set<string>();
  const occupied = new Set<number>();
  // Reserve explicit slots first, then assign old documents to free slots in
  // their original order. Reading never rewrites the user's existing bytes.
  for (const item of value.sets) {
    if (isRecord(item) && item.slot !== undefined) {
      if (!Number.isInteger(item.slot) || (item.slot as number) < 1 || (item.slot as number) > 5 || occupied.has(item.slot as number)) {
        throw new HandCollectionStorageError('invalid');
      }
      occupied.add(item.slot as number);
    }
  }
  const sets = value.sets.map(item => {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id) ||
        typeof item.name !== 'string' || !item.name.trim()) throw new HandCollectionStorageError('invalid');
    ids.add(item.id);
    let slot = item.slot as number | undefined;
    if (slot === undefined) {
      slot = [1, 2, 3, 4, 5].find(number => !occupied.has(number))!;
      occupied.add(slot);
    }
    return { id: item.id, name: item.name.trim(), data: validateHandCollection(item.data), slot };
  });
  const activeSlot = value.activeSlot === undefined
    ? sets.find(set => set.id === value.activeSetId)?.slot ?? 1 : value.activeSlot;
  if (!Number.isInteger(activeSlot) || (activeSlot as number) < 1 || (activeSlot as number) > 5 ||
      !(value.activeSetId === null || typeof value.activeSetId === 'string') ||
      (value.activeSetId !== null && !ids.has(value.activeSetId)) ||
      (sets.find(set => set.slot === activeSlot)?.id ?? null) !== value.activeSetId) {
    throw new HandCollectionStorageError('invalid');
  }
  return { version: 2, activeSetId: value.activeSetId as string | null, sets: sets.sort((a,b) => a.slot - b.slot), activeSlot: activeSlot as number };
}

// Read legacy data without writing migration bytes. The first successful user
// save atomically commits all sets; failed reads/saves leave existing bytes alone.
export function readHandCollectionSnapshot(): HandCollectionDocument & { raw: string | null; data: HandCollection } {
  const raw = storage().getItem(HAND_COLLECTION_STORAGE_KEY);
  if (raw === null) return { raw, version: 2, activeSetId: null, activeSlot: 1, sets: [], data: {} };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new HandCollectionStorageError('invalid'); }
  let document: HandCollectionDocument;
  if (isRecord(parsed) && parsed.version === 2) document = validateHandCollectionDocument(parsed);
  else {
    if (isRecord(parsed) && ('version' in parsed || 'data' in parsed) && parsed.version !== 1) {
      throw new HandCollectionStorageError('version');
    }
    const data = validateHandCollection(isRecord(parsed) && parsed.version === 1 ? parsed.data : parsed);
    document = { version: 2, activeSetId: 'legacy', activeSlot: 1, sets: [{ id: 'legacy', name: 'セット1', data, slot: 1 }] };
  }
  return { ...document, raw, data: document.sets.find(set => set.id === document.activeSetId)?.data ?? {} };
}

export function loadStoredHandCollection(): HandCollection {
  return readHandCollectionSnapshot().data;
}

export async function saveStoredHandCollectionDocument(
  document: HandCollectionDocument, expectedRaw: string | null, beforeWrite?: () => void,
): Promise<string> {
  // Freeze every set before waiting for another tab's lock. One atomic key write
  // also commits the selected set, so quota failures cannot leave partial sets.
  const raw = JSON.stringify(validateHandCollectionDocument(document));
  const write = () => {
    const target = storage();
    if (target.getItem(HAND_COLLECTION_STORAGE_KEY) !== expectedRaw) throw new HandCollectionStorageError('conflict');
    beforeWrite?.();
    target.setItem(HAND_COLLECTION_STORAGE_KEY, raw);
    return raw;
  };
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(HAND_COLLECTION_STORAGE_KEY, write);
  }
  return write();
}

// Keep the existing storage API for callers that save the selected collection.
export async function saveStoredHandCollection(collection: HandCollection, expectedRaw: string | null): Promise<string> {
  const snapshot = readHandCollectionSnapshot();
  const slot = snapshot.activeSlot ?? 1;
  let id = snapshot.activeSetId ?? `slot-${slot}`;
  while (!snapshot.activeSetId && snapshot.sets.some(set => set.id === id)) id += '-new';
  const sets = snapshot.sets.map(set => set.id === id ? { ...set, data: collection } : set);
  if (!snapshot.activeSetId) sets.push({ id, name: `セット${slot}`, data: collection, slot });
  return saveStoredHandCollectionDocument({ version: 2, activeSetId: id, activeSlot: slot, sets }, expectedRaw);
}

export function createHandCollectionSetsBackup(document: HandCollectionDocument): string {
  const validated = validateHandCollectionDocument(document);
  return JSON.stringify({ format: HAND_COLLECTION_SETS_BACKUP_FORMAT, exportedAt: new Date().toISOString(),
    activeSetId: validated.activeSetId, activeSlot: validated.activeSlot, sets: validated.sets }, null, 2);
}

export function parseHandCollectionSetsBackup(
  text: string, catalog?: { name: string; rare: string }[],
): HandCollectionDocument | null {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return null; }
  if (!isRecord(parsed) || parsed.format !== HAND_COLLECTION_SETS_BACKUP_FORMAT) return null;
  const document = validateHandCollectionDocument({ version: 2, activeSetId: parsed.activeSetId, activeSlot: parsed.activeSlot, sets: parsed.sets });
  for (const set of document.sets) for (const [key, card] of Object.entries(set.data)) {
    const known = catalog?.find(item => item.name === key);
    if ((card.totsu !== undefined && (!Number.isInteger(card.totsu) || card.totsu < 0 || card.totsu > 4)) ||
        (known && !isValidInputLevel(card.level ?? 0, known.rare))) throw new HandCollectionStorageError('invalid');
  }
  return document;
}

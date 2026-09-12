import type { HandCollection } from '@/store/handCollection';
export const HAND_COLLECTION_STORAGE_KEY = 'twst-hand-collection';
const STORAGE_VERSION = 1;

export class HandCollectionStorageError extends Error {
  constructor(public readonly reason: 'invalid' | 'version' | 'conflict' | 'unavailable') {
    super(`Hand collection storage: ${reason}`);
  }
}

function storage(): Storage {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new HandCollectionStorageError('unavailable');
  }
  return window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function validateHandCollection(value: unknown): HandCollection {
  if (!isRecord(value) || Object.entries(value).some(([key, card]) =>
    ['__proto__', 'constructor', 'prototype'].includes(key) || !isRecord(card) ||
    ['isOwned', 'isLimitBreak', 'isM3'].some(field => card[field] !== undefined && typeof card[field] !== 'boolean') ||
    (card.level !== undefined && (typeof card.level !== 'number' || !Number.isFinite(card.level) || card.level < 0))
  )) throw new HandCollectionStorageError('invalid');
  return value as unknown as HandCollection;
}

// Preserve the exact bytes as the expected version, including legacy data.
// A failed read must never be indistinguishable from a missing key.
export function readHandCollectionSnapshot(): { raw: string | null; data: HandCollection } {
  const raw = storage().getItem(HAND_COLLECTION_STORAGE_KEY);
  if (raw === null) return { raw, data: {} };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new HandCollectionStorageError('invalid'); }
  if (isRecord(parsed) && ('version' in parsed || 'data' in parsed)) {
    if (parsed.version !== STORAGE_VERSION) throw new HandCollectionStorageError('version');
    return { raw, data: validateHandCollection(parsed.data) };
  }
  return { raw, data: validateHandCollection(parsed) };
}

export function loadStoredHandCollection(): HandCollection {
  return readHandCollectionSnapshot().data;
}

export async function saveStoredHandCollection(collection: HandCollection, expectedRaw: string | null): Promise<string> {
  // Freeze this save's content before waiting for another tab's lock.
  const raw = JSON.stringify({ version: STORAGE_VERSION, data: validateHandCollection(collection) });
  const write = () => {
    const target = storage();
    if (target.getItem(HAND_COLLECTION_STORAGE_KEY) !== expectedRaw) {
      throw new HandCollectionStorageError('conflict');
    }
    target.setItem(HAND_COLLECTION_STORAGE_KEY, raw);
    return raw;
  };
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(HAND_COLLECTION_STORAGE_KEY, write);
  }
  // Older browsers: keep the compare and write in one synchronous task.
  return write();
}

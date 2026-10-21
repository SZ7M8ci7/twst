import type { SearchInput, Candidate } from '@/domain/examSearch/types';
import type { SessionCheckpoint } from '@/domain/examSearch/scheduler';
import { ENGINE_VERSION } from '@/domain/examSearch/types';
import LZString from 'lz-string';
import { readExamSearchRecord, writeExamSearchRecord } from '@/storage/examSearchDatabase';
const { compressToUTF16, decompressFromUTF16 } = LZString;
const KEY = 'twst-exam-resource-search-v1';
const TRANSFER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TRANSFERS = 20;
export interface SavedSearchSession { input: SearchInput; checkpoint: SessionCheckpoint; catalogVersion: string; version: string }
const SESSION_KEY = `${KEY}-session`;
interface StoredSession {
  format: 1;
  savedAt: number;
  setupAtSave?: string | null;
  session: SavedSearchSession;
}
let cachedRecord: StoredSession | null = null;
let lastSavedAt = 0;
let writes: Promise<unknown> = Promise.resolve();
let initializing: Promise<void> | undefined;
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const next = writes.then(operation, operation);
  writes = next.catch(() => undefined);
  return next;
}
function localValue(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function hasIndexedDB(): boolean {
  try { return typeof indexedDB !== 'undefined'; } catch { return false; }
}
function removeLegacy(raw: string | null) {
  try { if (raw !== null && localStorage.getItem(SESSION_KEY) === raw) localStorage.removeItem(SESSION_KEY); } catch { /* Keep the legacy copy if cleanup is unavailable. */ }
}
function validRecord(value: StoredSession | undefined): value is StoredSession {
  return value?.format === 1 && Number.isFinite(value.savedAt) && !!value.session?.input && Array.isArray(value.session?.checkpoint?.finalists);
}
const transferStorageKey = (id: string) => `${KEY}-transfer-${id}`;
const transferKeyPrefix = `${KEY}-transfer-`;
export function loadExamSearch(): SearchInput | null {
  try {
    const raw = localValue(KEY);
    const latest = readStoredRecord();
    // The checkpoint owns a complete input snapshot even if the smaller setup
    // write failed. A later explicit setup save has a different revision.
    if (latest && latest.setupAtSave === raw) return JSON.parse(JSON.stringify(latest.session.input));
    const value = JSON.parse(raw ?? 'null');
    if (!value || !value.preset?.id || !value.challengeLocks || !Array.isArray(value.roster) || !Array.isArray(value.supports)) return null;
    if ([...value.roster, ...value.supports].some(c => !c?.name || !Array.isArray(c.magicLevels) || c.magicLevels.length !== 3 || !Array.isArray(c.buddyLevels) || c.buddyLevels.length !== 3)) return null;
    const { setupVersion, setupRevision: _revision, ...input } = value;
    if (setupVersion !== 2) input.desiredProbability = 0.05;
    return input;
  } catch { return null; }
}
export function saveSearchTransfer(input: SearchInput, candidate: Candidate, best?: { seed: string; score: number }): string {
  const id = `resource-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const now = Date.now();
  const entries: Array<{ key: string; createdAt: number }> = [];
  const transferKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter((key): key is string => !!key?.startsWith(transferKeyPrefix));
  for (const key of transferKeys) {
    try {
      const createdAt = Number(JSON.parse(localStorage.getItem(key) ?? 'null')?.createdAt);
      if (!Number.isFinite(createdAt) || now - createdAt > TRANSFER_TTL_MS) localStorage.removeItem(key);
      else entries.push({ key, createdAt });
    } catch { localStorage.removeItem(key); }
  }
  entries.sort((a, b) => b.createdAt - a.createdAt).slice(MAX_TRANSFERS - 1).forEach(entry => localStorage.removeItem(entry.key));
  localStorage.setItem(transferStorageKey(id), JSON.stringify({ id, input, candidate, best, createdAt: now }));
  return id;
}
export function loadSearchTransfer(id: string): { input: SearchInput; candidate: Candidate; best?: { seed: string; score: number } } | null {
  try {
    const key = transferStorageKey(id);
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (value?.id === id) {
      if (Number.isFinite(Number(value.createdAt)) && Date.now() - Number(value.createdAt) > TRANSFER_TTL_MS) {
        localStorage.removeItem(key);
        return null;
      }
      return value;
    }
    // Keep links created by the previous same-tab implementation readable.
    const legacy = JSON.parse(sessionStorage.getItem(`${KEY}-transfer`) ?? 'null');
    return legacy?.id === id ? legacy : null;
  } catch { return null; }
}
export function saveExamSearch(input: SearchInput): boolean {
  try { localStorage.setItem(KEY, JSON.stringify({ ...input, setupVersion: 2, setupRevision: `${Date.now()}-${Math.random()}` })); return true; } catch { return false; }
}
export function serializeSearchSession(value: SavedSearchSession): string {
  const checkpoint=JSON.stringify(value.checkpoint);
  if(checkpoint.length<200000)return JSON.stringify(value);
  return JSON.stringify({input:value.input,catalogVersion:value.catalogVersion,version:value.version,
    checkpointEncoding:'lz-utf16-v1',checkpointLz:compressToUTF16(checkpoint)});
}
function decodeLegacy(raw: string | null): StoredSession | null {
  const value=JSON.parse(raw??'null');
  if(value?.checkpointEncoding==='lz-utf16-v1') {
    if(typeof value.checkpointLz!=='string')return null;
    const checkpoint=decompressFromUTF16(value.checkpointLz);
    if(!checkpoint)return null;
    value.checkpoint=JSON.parse(checkpoint);
  } else if(value?.checkpointEncoding)return null;
  if (!value?.input || !Array.isArray(value.checkpoint?.finalists)) return null;
  return { format: 1, savedAt: Number.isFinite(value.savedAt) ? value.savedAt : 0,
    // Old checkpoints have no setup revision. Never mistake a newer saved
    // setup for the checkpoint's input when migrating that older format.
    setupAtSave: value.setupAtSave === null || typeof value.setupAtSave === 'string'
      ? value.setupAtSave : localValue(KEY) === null ? null : undefined,
    session: {input:value.input,checkpoint:value.checkpoint,catalogVersion:value.catalogVersion,version:value.version} };
}
function readStoredRecord(): StoredSession | null {
  let legacy: StoredSession | null = null;
  try { legacy = decodeLegacy(localValue(SESSION_KEY)); } catch { /* A corrupt legacy copy must not hide the committed database record. */ }
  return legacy && (!cachedRecord || legacy.savedAt > cachedRecord.savedAt) ? legacy : cachedRecord;
}

/** Await before mounting the simulator/search panel; synchronous readers then use the hydrated snapshot. */
export function initializeExamSearchStorage(): Promise<void> {
  if (initializing) return initializing;
  initializing = enqueue(async () => {
    const raw = localValue(SESSION_KEY);
    let legacy: StoredSession | null = null;
    try { legacy = decodeLegacy(raw); } catch { /* Leave unreadable legacy bytes untouched. */ }
    if (!hasIndexedDB()) return;
    try {
      const existing = await readExamSearchRecord<StoredSession>();
      cachedRecord = validRecord(existing) ? existing : null;
      if (legacy && (!cachedRecord || legacy.savedAt > cachedRecord.savedAt)) {
        cachedRecord = await writeExamSearchRecord(legacy, true);
        removeLegacy(raw);
      } else if (cachedRecord && legacy && cachedRecord.savedAt >= legacy.savedAt) removeLegacy(raw);
    } catch (error) {
      console.warn('Exam search storage initialization failed; legacy data retained', error);
    }
  }).finally(() => { initializing = undefined; });
  return initializing;
}

function saveLegacy(value: SavedSearchSession, record: StoredSession, serialized?: string): boolean {
  try {
    const encoded = serialized ?? serializeSearchSession(value);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...JSON.parse(encoded), savedAt: record.savedAt, setupAtSave: record.setupAtSave }));
    return true;
  } catch (error) {
    console.warn('Exam search checkpoint save failed', { backend: 'localStorage', error,
      serializedCodeUnits: serialized?.length });
    return false;
  }
}

export function saveSearchSession(value: SavedSearchSession, serialized?: string): Promise<boolean> {
  lastSavedAt = Math.max(Date.now(), lastSavedAt + 1, (cachedRecord?.savedAt ?? 0) + 1);
  const record: StoredSession = { format: 1, savedAt: lastSavedAt, setupAtSave: localValue(KEY), session: value };
  // Compatibility path for environments where IndexedDB is not exposed.
  if (!hasIndexedDB()) return Promise.resolve(saveLegacy(value, record, serialized));
  const legacy = localValue(SESSION_KEY);
  return enqueue(async () => {
    try {
      // Structured cloning keeps shared result objects shared, including the
      // aggregate finalists and their island copies. No huge JSON/LZ copy is needed.
      await writeExamSearchRecord(record);
      cachedRecord = record;
      removeLegacy(legacy);
      return true;
    } catch (error) {
      console.warn('Exam search IndexedDB save failed; trying legacy storage', error);
      return saveLegacy(value, record, serialized);
    }
  });
}
export function loadSearchSession(): SavedSearchSession | null {
  try {
    const value = readStoredRecord()?.session;
    if (value?.version !== ENGINE_VERSION || !['seen', 'pool', 'pending', 'finalists'].every(key =>
      Array.isArray(value?.checkpoint?.[key as keyof SessionCheckpoint]))) return null;
    return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  } catch { return null; }
}
// Card names remain useful after an engine update; old scores, training and
// plans do not. Candidate generation rechecks current ownership and training.
export function loadSearchSeedTeams(presetId:string): string[][] {
  try {
    const saved=readStoredRecord()?.session;
    if(saved?.input?.preset?.id!==presetId||!Array.isArray(saved?.checkpoint?.finalists))return [];
    const seen=new Set<string>();
    return saved.checkpoint.finalists.flatMap((result:any)=>{
      const cards=result?.candidate?.cards;
      if(!Array.isArray(cards)||cards.length!==5||!cards.every(c=>typeof c?.name==='string'))return [];
      const names=cards.map(c=>c.name),key=names.join('|');
      if(seen.has(key))return [];seen.add(key);return [names];
    }).slice(0,8);
  }catch{return [];}
}

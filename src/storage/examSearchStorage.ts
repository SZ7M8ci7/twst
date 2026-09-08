import type { SearchInput, Candidate } from '@/domain/examSearch/types';
import type { SessionCheckpoint } from '@/domain/examSearch/scheduler';
import { ENGINE_VERSION } from '@/domain/examSearch/types';
import LZString from 'lz-string';
const { compressToUTF16, decompressFromUTF16 } = LZString;
const KEY = 'twst-exam-resource-search-v1';
const TRANSFER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TRANSFERS = 20;
export interface SavedSearchSession { input: SearchInput; checkpoint: SessionCheckpoint; catalogVersion: string; version: string }
const transferStorageKey = (id: string) => `${KEY}-transfer-${id}`;
const transferKeyPrefix = `${KEY}-transfer-`;
export function loadExamSearch(): SearchInput | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!value || !value.preset?.id || !value.challengeLocks || !Array.isArray(value.roster) || !Array.isArray(value.supports)) return null;
    if ([...value.roster, ...value.supports].some(c => !c?.name || !Array.isArray(c.magicLevels) || c.magicLevels.length !== 3 || !Array.isArray(c.buddyLevels) || c.buddyLevels.length !== 3)) return null;
    const { setupVersion, ...input } = value;
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
  try { localStorage.setItem(KEY, JSON.stringify({ ...input, setupVersion: 2 })); return true; } catch { return false; }
}
export function serializeSearchSession(value: SavedSearchSession): string {
  const checkpoint=JSON.stringify(value.checkpoint);
  if(checkpoint.length<200000)return JSON.stringify(value);
  return JSON.stringify({input:value.input,catalogVersion:value.catalogVersion,version:value.version,
    checkpointEncoding:'lz-utf16-v1',checkpointLz:compressToUTF16(checkpoint)});
}
function readStoredSession(): SavedSearchSession | null {
  const value=JSON.parse(localStorage.getItem(`${KEY}-session`)??'null');
  if(value?.checkpointEncoding==='lz-utf16-v1') {
    if(typeof value.checkpointLz!=='string')return null;
    const checkpoint=decompressFromUTF16(value.checkpointLz);
    if(!checkpoint)return null;
    value.checkpoint=JSON.parse(checkpoint);
  } else if(value?.checkpointEncoding)return null;
  return value?{input:value.input,checkpoint:value.checkpoint,catalogVersion:value.catalogVersion,version:value.version}:null;
}
export function saveSearchSession(value: SavedSearchSession, serialized?: string): boolean {
  try { localStorage.setItem(`${KEY}-session`, serialized??serializeSearchSession(value)); return true; } catch { return false; }
}
export function loadSearchSession(): SavedSearchSession | null {
  try {
    const value = readStoredSession();
    return value?.version === ENGINE_VERSION && Array.isArray(value?.checkpoint?.finalists) ? value : null;
  } catch { return null; }
}
// Card names remain useful after an engine update; old scores, training and
// plans do not. Candidate generation rechecks current ownership and training.
export function loadSearchSeedTeams(presetId:string): string[][] {
  try {
    const saved=readStoredSession();
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

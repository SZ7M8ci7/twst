import {
  readLegacyJSON,
  readVersionedStorage,
  removeStorageKeys,
  writeVersionedStorage,
} from '@/storage/versionedStorage';

const STORAGE_KEY = 'twst-retire-state';
const STORAGE_VERSION = 1;
const LEGACY_KEYS = [
  'retire_input_values',
  'retire_selected_characters',
  'retire_visible_fields',
  'retire_reset_count',
  'retire_last_reset_time',
] as const;

export interface RetirePersistedState {
  inputValues: unknown[];
  selectedCharacters: unknown[];
  visibleFields: number[];
  resetCount: number;
  lastResetTime: string;
}

function readLegacyString(key: string, fallback = '') {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return fallback;
  }

  return window.localStorage.getItem(key) ?? fallback;
}

function migrateLegacyRetireState(): RetirePersistedState | null {
  const inputValues = readLegacyJSON<unknown[]>('retire_input_values') ?? [];
  const selectedCharacters = readLegacyJSON<unknown[]>('retire_selected_characters') ?? [];
  const visibleFields = readLegacyJSON<number[]>('retire_visible_fields') ?? [];
  const resetCount = Number(readLegacyString('retire_reset_count', '0'));
  const lastResetTime = readLegacyString('retire_last_reset_time');

  if (
    inputValues.length === 0 &&
    selectedCharacters.length === 0 &&
    visibleFields.length === 0 &&
    resetCount === 0 &&
    !lastResetTime
  ) {
    return null;
  }

  return {
    inputValues,
    selectedCharacters,
    visibleFields,
    resetCount,
    lastResetTime,
  };
}

export function loadRetireState() {
  return readVersionedStorage<RetirePersistedState>(
    STORAGE_KEY,
    STORAGE_VERSION,
    migrateLegacyRetireState
  );
}

export function saveRetireState(state: RetirePersistedState) {
  writeVersionedStorage(STORAGE_KEY, STORAGE_VERSION, state);
  removeStorageKeys([...LEGACY_KEYS]);
}

export function clearRetireState() {
  removeStorageKeys([STORAGE_KEY, ...LEGACY_KEYS]);
}

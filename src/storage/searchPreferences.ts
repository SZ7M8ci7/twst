import {
  readLegacyJSON,
  readVersionedStorage,
  removeStorageKeys,
  writeVersionedStorage,
} from '@/storage/versionedStorage';

const STORAGE_KEY = 'twst-search-character-preferences';
const STORAGE_VERSION = 1;
const LEGACY_KEYS = [
  'characterLevels',
  'characterM3',
  'characterTotsu',
  'characterMagicUsage',
] as const;

export interface SearchMagicUsagePreference {
  hasM1: boolean;
  hasM2: boolean;
  hasM3: boolean;
}

export interface SearchCharacterPreferences {
  levels: Record<string, number>;
  hasM3: Record<string, boolean>;
  totsu: Record<string, number>;
  magicUsage: Record<string, SearchMagicUsagePreference>;
}

function createDefaultPreferences(): SearchCharacterPreferences {
  return {
    levels: {},
    hasM3: {},
    totsu: {},
    magicUsage: {},
  };
}

function normalizePreferences(
  value?: Partial<SearchCharacterPreferences> | null
): SearchCharacterPreferences {
  const base = createDefaultPreferences();

  return {
    levels: { ...base.levels, ...(value?.levels ?? {}) },
    hasM3: { ...base.hasM3, ...(value?.hasM3 ?? {}) },
    totsu: { ...base.totsu, ...(value?.totsu ?? {}) },
    magicUsage: { ...base.magicUsage, ...(value?.magicUsage ?? {}) },
  };
}

function migrateLegacyPreferences(): SearchCharacterPreferences | null {
  const levels = readLegacyJSON<Record<string, number>>('characterLevels') ?? {};
  const hasM3 = readLegacyJSON<Record<string, boolean>>('characterM3') ?? {};
  const totsu = readLegacyJSON<Record<string, number>>('characterTotsu') ?? {};
  const magicUsage = readLegacyJSON<Record<string, SearchMagicUsagePreference>>('characterMagicUsage') ?? {};

  if (
    Object.keys(levels).length === 0 &&
    Object.keys(hasM3).length === 0 &&
    Object.keys(totsu).length === 0 &&
    Object.keys(magicUsage).length === 0
  ) {
    return null;
  }

  return normalizePreferences({
    levels,
    hasM3,
    totsu,
    magicUsage,
  });
}

export function loadSearchCharacterPreferences() {
  return normalizePreferences(
    readVersionedStorage<SearchCharacterPreferences>(
      STORAGE_KEY,
      STORAGE_VERSION,
      migrateLegacyPreferences
    )
  );
}

export function saveSearchCharacterPreferences(value: SearchCharacterPreferences) {
  writeVersionedStorage(STORAGE_KEY, STORAGE_VERSION, normalizePreferences(value));
  removeStorageKeys([...LEGACY_KEYS]);
}

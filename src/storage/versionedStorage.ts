interface VersionedStorageEnvelope<T> {
  version: number;
  data: T;
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readLegacyJSON<T>(key: string): T | null {
  if (!canUseStorage()) return null;

  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeLegacyJSON<T>(key: string, data: T) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(data));
}

export function removeStorageKeys(keys: string[]) {
  if (!canUseStorage()) return;
  keys.forEach((key) => {
    window.localStorage.removeItem(key);
  });
}

export function readVersionedStorage<T>(
  key: string,
  version: number,
  migrateLegacy?: () => T | null
): T | null {
  if (!canUseStorage()) return null;

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return migrateLegacy ? migrateLegacy() : null;
  }

  try {
    const parsed = JSON.parse(raw) as VersionedStorageEnvelope<T> | T;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'version' in parsed &&
      'data' in parsed &&
      parsed.version === version
    ) {
      return parsed.data as T;
    }

    return parsed as T;
  } catch {
    return migrateLegacy ? migrateLegacy() : null;
  }
}

export function writeVersionedStorage<T>(key: string, version: number, data: T) {
  if (!canUseStorage()) return;

  const payload: VersionedStorageEnvelope<T> = {
    version,
    data,
  };

  window.localStorage.setItem(key, JSON.stringify(payload));
}

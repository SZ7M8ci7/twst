export async function requestPersistentStorage(): Promise<boolean | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return null;
  }

  try {
    if (navigator.storage.persisted && await navigator.storage.persisted()) {
      return true;
    }

    return await navigator.storage.persist();
  } catch (error) {
    console.warn('Failed to request persistent storage:', error);
    return false;
  }
}

import type { HandCollection } from '@/store/handCollection';
import { readVersionedStorage, writeVersionedStorage } from '@/storage/versionedStorage';

const STORAGE_KEY = 'twst-hand-collection';
const STORAGE_VERSION = 1;

export function loadStoredHandCollection() {
  return readVersionedStorage<HandCollection>(STORAGE_KEY, STORAGE_VERSION) ?? {};
}

export function saveStoredHandCollection(collection: HandCollection) {
  writeVersionedStorage(STORAGE_KEY, STORAGE_VERSION, collection);
}

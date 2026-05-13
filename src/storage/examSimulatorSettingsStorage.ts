import { readVersionedStorage, writeVersionedStorage } from '@/storage/versionedStorage';

const STORAGE_KEY = 'twst-exam-simulator-settings';
const STORAGE_VERSION = 1;
const MAX_SAVED_SETTINGS = 40;

export interface SavedExamSimulatorSettings {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  payload: any;
}

function normalizeSettings(settings: SavedExamSimulatorSettings[]) {
  return settings
    .filter((setting) => setting?.id && setting?.name && setting?.payload)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_SAVED_SETTINGS);
}

export function loadSavedExamSimulatorSettings() {
  return normalizeSettings(
    readVersionedStorage<SavedExamSimulatorSettings[]>(STORAGE_KEY, STORAGE_VERSION) ?? [],
  );
}

export function saveSavedExamSimulatorSettings(settings: SavedExamSimulatorSettings[]) {
  writeVersionedStorage(STORAGE_KEY, STORAGE_VERSION, normalizeSettings(settings));
}

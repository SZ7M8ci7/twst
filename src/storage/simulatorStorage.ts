import { readVersionedStorage, writeVersionedStorage } from '@/storage/versionedStorage';

const STORAGE_VERSION = 1;
const SIMULATOR_STATE_KEY = 'twstSimulatorState';
const SAVED_DECKS_KEY = 'twst_saved_decks';
const AUTO_SAVE_KEY = 'twst_autosave_deck';

export interface SimulatorWindowState {
  deckCharacters: any[];
  selectedAttribute: string;
}

export function loadSimulatorWindowState() {
  return readVersionedStorage<SimulatorWindowState>(SIMULATOR_STATE_KEY, STORAGE_VERSION);
}

export function saveSimulatorWindowState(state: SimulatorWindowState) {
  writeVersionedStorage(SIMULATOR_STATE_KEY, STORAGE_VERSION, state);
}

export function loadStoredSavedDecks<T>() {
  return readVersionedStorage<T[]>(SAVED_DECKS_KEY, STORAGE_VERSION) ?? [];
}

export function saveStoredSavedDecks<T>(decks: T[]) {
  writeVersionedStorage(SAVED_DECKS_KEY, STORAGE_VERSION, decks);
}

export function loadStoredAutoSaveDeck<T>() {
  return readVersionedStorage<T>(AUTO_SAVE_KEY, STORAGE_VERSION);
}

export function saveStoredAutoSaveDeck<T>(deck: T) {
  writeVersionedStorage(AUTO_SAVE_KEY, STORAGE_VERSION, deck);
}

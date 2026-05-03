import { readVersionedStorage, writeVersionedStorage } from '@/storage/versionedStorage';

const STORAGE_VERSION = 1;
const SIMULATOR_STATE_KEY = 'twstSimulatorState';
const EXAM_SIMULATOR_IMPORT_KEY = 'twstExamSimulatorImport';
const SAVED_DECKS_KEY = 'twst_saved_decks';
const AUTO_SAVE_KEY = 'twst_autosave_deck';

export interface SimulatorWindowState {
  deckCharacters: any[];
  selectedAttribute: string;
  selectedOpponentAttribute?: string;
}

export interface ExamSimulatorDeckImportState {
  id: string;
  deckCharacters: any[];
  selectedAttribute?: string;
  createdAt: string;
}

interface ExamSimulatorDeckImportStore {
  imports: Record<string, ExamSimulatorDeckImportState>;
}

export function loadSimulatorWindowState() {
  return readVersionedStorage<SimulatorWindowState>(SIMULATOR_STATE_KEY, STORAGE_VERSION);
}

export function saveSimulatorWindowState(state: SimulatorWindowState) {
  writeVersionedStorage(SIMULATOR_STATE_KEY, STORAGE_VERSION, state);
}

function readExamSimulatorDeckImportStore(): ExamSimulatorDeckImportStore {
  const stored = readVersionedStorage<ExamSimulatorDeckImportStore | ExamSimulatorDeckImportState>(EXAM_SIMULATOR_IMPORT_KEY, STORAGE_VERSION);
  if (!stored) return { imports: {} };
  if ('imports' in stored && stored.imports && typeof stored.imports === 'object') {
    return stored;
  }
  if ('id' in stored && stored.id) {
    return { imports: { [stored.id]: stored } };
  }
  return { imports: {} };
}

export function loadExamSimulatorDeckImportState(id?: string) {
  const store = readExamSimulatorDeckImportStore();
  if (id) return store.imports[id] ?? null;
  const imports = Object.values(store.imports);
  return imports.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export function saveExamSimulatorDeckImportState(state: ExamSimulatorDeckImportState) {
  const store = readExamSimulatorDeckImportStore();
  const imports = {
    ...store.imports,
    [state.id]: state,
  };
  const limitedImports = Object.fromEntries(
    Object.values(imports)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 12)
      .map((entry) => [entry.id, entry])
  );
  writeVersionedStorage(EXAM_SIMULATOR_IMPORT_KEY, STORAGE_VERSION, { imports: limitedImports });
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

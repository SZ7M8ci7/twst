// Keep the large checkpoint out of localStorage's small, shared quota.
export const EXAM_SEARCH_DATABASE = 'twst-exam-search';
const STORE = 'sessions';
const KEY = 'latest';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = indexedDB.open(EXAM_SEARCH_DATABASE, 1);
    const timer = setTimeout(() => fail(new Error('IndexedDB open timed out')), 5000);
    function fail(error: unknown) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onerror = () => fail(request.error);
    request.onblocked = () => fail(new Error('IndexedDB upgrade blocked'));
    request.onsuccess = () => {
      if (settled) { request.result.close(); return; }
      settled = true;
      clearTimeout(timer);
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

async function transaction<T>(mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, result: (value: T) => void, fail: (error: unknown) => void) => void): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let value: T;
      // Request success is not enough: quota/disk failures can abort afterwards.
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
      tx.onerror = () => { /* The abort event reports the final transaction error. */ };
      const fail = (error: unknown) => {
        try { tx.abort(); } catch { /* The transaction may already have aborted. */ }
        reject(error);
      };
      try { operation(tx.objectStore(STORE), result => { value = result; }, fail); }
      catch (error) { fail(error); }
    });
  } finally { db.close(); }
}

export function readExamSearchRecord<T>(): Promise<T | undefined> {
  return transaction('readonly', (store, result) => {
    const request = store.get(KEY);
    request.onsuccess = () => result(request.result);
  });
}

export function writeExamSearchRecord<T extends { savedAt: number }>(value: T, migrating = false): Promise<T> {
  return transaction('readwrite', (store, result, fail) => {
    const write = () => {
      try { store.put(value, KEY); result(value); }
      catch (error) { fail(error); }
    };
    if (!migrating) { write(); return; }
    // A different tab may save while this tab is decoding a legacy checkpoint.
    const current = store.get(KEY);
    current.onsuccess = () => {
      if (current.result && current.result.savedAt >= value.savedAt) result(current.result);
      else write();
    };
  });
}

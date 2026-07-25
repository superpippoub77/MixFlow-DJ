/**
 * Salva i file audio locali nell'IndexedDB del browser (supporta Blob/File
 * nativamente), così la libreria sopravvive a un refresh della pagina.
 * Non usa localStorage: i file audio sarebbero troppo grandi e localStorage
 * non supporta i Blob comunque.
 */

const DB_NAME = 'mixflowdj';
const STORE_NAME = 'local-tracks';

interface StoredTrack {
  id: string;
  name: string;
  type: string;
  blob: Blob;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalTrack(id: string, file: File): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const record: StoredTrack = { id, name: file.name, type: file.type, blob: file };
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAllLocalTracks(): Promise<{ id: string; file: File }[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const rows = req.result as StoredTrack[];
      resolve(rows.map((r) => ({ id: r.id, file: new File([r.blob], r.name, { type: r.type }) })));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function removeLocalTrack(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

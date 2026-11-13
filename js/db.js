// Storage (IndexedDB; localStorage is ~5MB and photos would blow it fast).
const dbReady = new Promise((resolve, reject) => {
  const req = indexedDB.open('november-memories', 2);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
    if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' });
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

async function tx(stores, mode, fn) {
  const db = await dbReady;
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    const r = fn(...[].concat(stores).map((n) => t.objectStore(n)));
    t.oncomplete = () => resolve(r && r.result);
    t.onerror = () => reject(t.error);
  });
}

// Photos are stored as raw bytes (more reliable than Blobs in Safari) and never rewritten after capture.
// Notes live in their own store so editing a note never rewrites the photo.
export const savePhoto = (rec) => tx('photos', 'readwrite', (s) => s.add(rec));
export const saveNote = (id, text) => tx('notes', 'readwrite', (s) => s.put({ id, text }));
export const deletePhoto = (id) => tx(['photos', 'notes'], 'readwrite', (p, n) => { p.delete(id); n.delete(id); });

export async function allPhotos() {
  const photos = await tx('photos', 'readonly', (s) => s.getAll());
  const notes = await tx('notes', 'readonly', (s) => s.getAll());
  const byId = new Map(notes.map((n) => [n.id, n.text]));
  return photos.map((p) => ({ ...p, note: byId.has(p.id) ? byId.get(p.id) : p.note || '' }));
}

export const photoBlob = (p) => p.blob || new Blob([p.data], { type: p.type || 'image/jpeg' }); // old records hold a Blob

export const requestPersistence = () => navigator.storage?.persist?.(); // ask the browser not to evict our data

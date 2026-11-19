// Tiny IndexedDB wrapper with a localStorage fallback.
const DB_NAME = 'murmur', DB_VER = 2, STORES = ['books', 'quotes', 'kv', 'files'];
let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    if (!('indexedDB' in window)) return rej(new Error('no idb'));
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => STORES.forEach(s => { if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
const lsKey = (s, k) => `murmur:${s}:${k}`;
async function tx(store, mode, fn) {
  try {
    const db = await open();
    return await new Promise((res, rej) => {
      const t = db.transaction(store, mode), st = t.objectStore(store);
      const out = fn(st);
      t.oncomplete = () => res(out && 'result' in out ? out.result : out);
      t.onerror = () => rej(t.error);
    });
  } catch (e) { return undefined; }
}
export const db = {
  async get(store, key) {
    const v = await tx(store, 'readonly', st => st.get(key));
    if (v !== undefined) return v;
    try { const s = localStorage.getItem(lsKey(store, key)); return s ? JSON.parse(s) : undefined; } catch { return undefined; }
  },
  async set(store, key, val) {
    const r = await tx(store, 'readwrite', st => st.put(val, key));
    if (r === undefined) try { localStorage.setItem(lsKey(store, key), JSON.stringify(val)); } catch {}
  },
  async del(store, key) { await tx(store, 'readwrite', st => st.delete(key)); try { localStorage.removeItem(lsKey(store, key)); } catch {} },
  async all(store) {
    const v = await tx(store, 'readonly', st => st.getAll());
    if (Array.isArray(v)) return v;
    const out = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(`murmur:${store}:`)) out.push(JSON.parse(localStorage.getItem(k))); } } catch {}
    return out;
  }
};

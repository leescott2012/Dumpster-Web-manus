/**
 * localStore — IndexedDB-backed key/value store for the photo workspace.
 *
 * Why this exists:
 *   Dumps + pool are persisted as JSON that embeds every uploaded photo as a
 *   base64 data URL. localStorage caps at ~5 MB, so after ~15-25 photos every
 *   write throws QuotaExceededError — new uploads then vanish on the next
 *   refresh ("max storage hit … they should stay in refresh"). IndexedDB has a
 *   far larger quota (hundreds of MB to GBs), so the durable copy lives here.
 *
 *   localStorage stays as a synchronous first-paint cache (see useCarouselState):
 *   instant render from whatever fit, then this store hydrates the full set.
 *
 * Fail-safe: if IndexedDB is unavailable (private mode, ancient browser, an
 * open error), every call resolves to null / no-ops and the app silently falls
 * back to its previous localStorage-only behaviour. Nothing here can throw.
 */

const DB_NAME = "dumpster";
const STORE = "workspace";
const VERSION = 1;

let _dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise(function (resolve) {
    try {
      if (typeof indexedDB === "undefined") { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
      // Some browsers fire onblocked instead of erroring — treat as unavailable.
      req.onblocked = function () { resolve(null); };
    } catch { resolve(null); }
  });
  return _dbPromise;
}

/** Read a value. Resolves to null if missing or IndexedDB is unavailable. */
export async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise(function (resolve) {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = function () { resolve((req.result as T) ?? null); };
      req.onerror = function () { resolve(null); };
    } catch { resolve(null); }
  });
}

// Writes are coalesced per key — state updates fire on every drag tick, so we
// only keep the latest value and flush it after a short idle window.
const _pending = new Map<string, unknown>();
const _timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Queue a debounced write. Stores the structured value (no JSON needed). */
export function idbSet(key: string, value: unknown, debounceMs = 200): void {
  _pending.set(key, value);
  const existing = _timers.get(key);
  if (existing) clearTimeout(existing);
  _timers.set(key, setTimeout(function () {
    _timers.delete(key);
    const v = _pending.get(key); _pending.delete(key);
    void writeNow(key, v);
  }, debounceMs));
}

async function writeNow(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
  } catch { /* ignore — durable copy is best-effort */ }
}

/** Delete a key (used by resetAll). */
export async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
  } catch { /* ignore */ }
}

/** Flush any debounced writes immediately. Call on beforeunload. */
export function idbFlush(): void {
  const entries = Array.from(_timers.entries());
  for (let i = 0; i < entries.length; i++) {
    const key = entries[i][0];
    clearTimeout(entries[i][1]);
    _timers.delete(key);
    const v = _pending.get(key); _pending.delete(key);
    void writeNow(key, v);
  }
}

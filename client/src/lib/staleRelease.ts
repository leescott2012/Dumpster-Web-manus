/**
 * After a new release, a tab on the old version asks for files that no longer
 * exist; Vercel answers with index.html and the import fails. Reload once to
 * pick up the new version. Still failing inside the window = a real outage, so
 * the crash screen shows instead of a reload loop.
 */
const KEY = "dumpster_stale_reload_at";
const WINDOW_MS = 60_000;

type Store = Pick<Storage, "getItem" | "setItem">;

export function shouldReload(store: Store, now: number): boolean {
  try {
    if (now - Number(store.getItem(KEY) || 0) < WINDOW_MS) return false;
    store.setItem(KEY, String(now));
    return true;
  } catch (_) {
    return false; // can't remember a reload, so never risk looping
  }
}

export function installStaleReleaseReload() {
  window.addEventListener("vite:preloadError", function (e) {
    if (!shouldReload(sessionStorage, Date.now())) return;
    e.preventDefault();
    window.location.reload();
  });
}

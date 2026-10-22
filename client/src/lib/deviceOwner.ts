/**
 * Per-account device data. Dumps, photos, captions, AI settings and BYO keys live in this
 * browser's localStorage/IndexedDB, not per user — so a second account signing in on the same
 * device used to see (and even cloud-sync) the first account's photos and captions.
 *
 * When a DIFFERENT account signs in we PARK the previous owner's local data (nothing is deleted)
 * and restore the new account's own parked data, if it has any. Switching back swaps again.
 * The caller reloads the page after claimDevice() so state rehydrates clean.
 */
import { idbGet, idbPutNow, idbDelNow } from "@/lib/localStore";

var OWNER_KEY = "dumpster_device_owner";
var PARK_PREFIX = "dumpster_parked_";
// Photo workspace keys (mirrored in IndexedDB under the same names).
var IDB_KEYS = [
  "dumpster_state_dumps_guest", "dumpster_state_dumps_owner",
  "dumpster_state_pool_guest", "dumpster_state_pool_owner",
  "dumpster_state_archived_guest", "dumpster_state_archived_owner",
  "dumpster_state_dupe_dismissed_guest", "dumpster_state_dupe_dismissed_owner",
];
// Device-level or already per-user localStorage keys that must NOT move with the account data.
var UUID_IN_KEY = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
function stays(k: string): boolean {
  return k === OWNER_KEY || k.startsWith(PARK_PREFIX) || k === "dumpster_accent" || k === "dumpster_ref_code"
    || k === "dumpster_otp_sends" || UUID_IN_KEY.test(k);
}

function getOwner(): string | null { try { return localStorage.getItem(OWNER_KEY); } catch { return null; } }

/** True when this device's local data belongs to another account (sync; safe to call before any state loads). */
export function deviceBelongsToOther(uid: string): boolean {
  var o = getOwner();
  if (!o) { try { localStorage.setItem(OWNER_KEY, uid); } catch { /* noop */ } return false; } // first claim keeps existing data
  return o !== uid;
}

async function snapshot(): Promise<{ ls: Record<string, string>; idb: Record<string, unknown> }> {
  var ls: Record<string, string> = {};
  try {
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var k = localStorage.key(i);
      if (k && k.startsWith("dumpster_") && !stays(k)) { ls[k] = localStorage.getItem(k) as string; }
    }
  } catch { /* noop */ }
  var idb: Record<string, unknown> = {};
  for (var j = 0; j < IDB_KEYS.length; j++) {
    var v = await idbGet<unknown>(IDB_KEYS[j]);
    if (v != null) idb[IDB_KEYS[j]] = v;
  }
  return { ls: ls, idb: idb };
}

/** Park the previous owner's data, restore the new owner's (if any), record the new owner. */
var inflight: Promise<void> | null = null;
/** Single-flight: getSession + onAuthStateChange both fire at sign-in; a 2nd concurrent run would re-park an already-cleared (empty) device over the good parked copy. */
export function claimDevice(uid: string): Promise<void> {
  if (!inflight) inflight = doClaim(uid).finally(function () { inflight = null; });
  return inflight;
}

async function doClaim(uid: string): Promise<void> {
  var prev = getOwner();
  if (prev && prev !== uid) {
    var snap = await snapshot();
    var saved = await idbPutNow(PARK_PREFIX + prev, snap);
    if (saved) {
      // Only clear after the copy is safely committed.
      Object.keys(snap.ls).forEach(function (k) { try { localStorage.removeItem(k); } catch { /* noop */ } });
      for (var i = 0; i < IDB_KEYS.length; i++) await idbDelNow(IDB_KEYS[i]);
    }
    var mine = saved ? await idbGet<{ ls: Record<string, string>; idb: Record<string, unknown> }>(PARK_PREFIX + uid) : null;
    if (mine) {
      Object.keys(mine.ls || {}).forEach(function (k) { try { localStorage.setItem(k, mine!.ls[k]); } catch { /* noop */ } });
      var ik = Object.keys(mine.idb || {});
      for (var j = 0; j < ik.length; j++) await idbPutNow(ik[j], mine.idb[ik[j]]);
      await idbDelNow(PARK_PREFIX + uid);
    }
  }
  try { localStorage.setItem(OWNER_KEY, uid); } catch { /* noop */ }
}

/** Signed-in user id from Supabase's stored session (sync, no network) — lets us swap data BEFORE React mounts. */
function storedSessionUserId(): string | null {
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && /^sb-.+-auth-token$/.test(k)) {
        var j = JSON.parse(localStorage.getItem(k) || "null");
        var id = j && (j.user && j.user.id || j.currentSession && j.currentSession.user && j.currentSession.user.id);
        if (id) return String(id);
      }
    }
  } catch { /* noop */ }
  return null;
}

/** Boot gate (main.tsx): if the stored session belongs to a different account than this device's data, swap before the app renders.
 *  Done pre-mount because a running app writes its in-memory state back to storage on unload, which would undo a late clear. */
export async function claimOnBoot(): Promise<void> {
  try {
    var uid = storedSessionUserId();
    if (uid && deviceBelongsToOther(uid)) await claimDevice(uid);
  } catch { /* never block the app from starting */ }
}

/** A different account signed in while the app was running: reload so claimOnBoot() swaps data cleanly (once per tab+account, no loops). */
export function reloadForAccountSwitch(uid: string): void {
  try {
    if (sessionStorage.getItem("dumpster_swap_reload") === uid) return;
    sessionStorage.setItem("dumpster_swap_reload", uid);
  } catch { /* noop */ }
  window.location.reload();
}

/**
 * pinLock — a 4-digit PIN that unlocks the app on THIS device after a normal
 * sign-in (texted/emailed code, Apple, Google). It never logs anyone in by
 * itself, so it can't be guessed from another device. Only a salted PBKDF2 hash
 * is stored locally. Wrong PINs: 3 fails -> 30s wait, 4 -> 60s, 5 -> PIN wiped
 * and the user must sign in again with a code.
 */
const MAX_FAILS = 5;
const KEY = (app: string, uid: string) => `${app}_pin_v1_${uid}`;
const DISMISS = (app: string, uid: string) => `${app}_pin_setup_dismissed_${uid}`;
const UNLOCKED = (app: string) => `${app}_unlocked`;

interface Rec { salt: string; hash: string; fails: number; lockedUntil: number }

const hex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b as ArrayBuffer)).map((x) => x.toString(16).padStart(2, "0")).join("");

async function derive(pin: string, saltHex: string) {
  const salt = new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 150_000, hash: "SHA-256" }, key, 256));
}

function read(app: string, uid: string): Rec | null {
  try { return JSON.parse(localStorage.getItem(KEY(app, uid)) || "null"); } catch { return null; }
}
function write(app: string, uid: string, r: Rec) {
  try { localStorage.setItem(KEY(app, uid), JSON.stringify(r)); } catch { /* private mode: PIN just won't persist */ }
}

export const hasPin = (app: string, uid: string) => !!read(app, uid);
export function removePin(app: string, uid: string) { try { localStorage.removeItem(KEY(app, uid)); } catch { /* ignore */ } }

export async function setPin(app: string, uid: string, pin: string) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  write(app, uid, { salt, hash: await derive(pin, salt), fails: 0, lockedUntil: 0 });
}

export type VerifyResult = { ok: true } | { ok: false; remaining: number; waitSeconds: number; forceSignOut: boolean };

export async function verifyPin(app: string, uid: string, pin: string): Promise<VerifyResult> {
  const r = read(app, uid);
  if (!r) return { ok: false, remaining: 0, waitSeconds: 0, forceSignOut: true };
  const wait = Math.ceil((r.lockedUntil - Date.now()) / 1000);
  if (wait > 0) return { ok: false, remaining: MAX_FAILS - r.fails, waitSeconds: wait, forceSignOut: false };
  if ((await derive(pin, r.salt)) === r.hash) { write(app, uid, { ...r, fails: 0, lockedUntil: 0 }); return { ok: true }; }
  const fails = r.fails + 1;
  if (fails >= MAX_FAILS) { removePin(app, uid); return { ok: false, remaining: 0, waitSeconds: 0, forceSignOut: true }; }
  const waitSeconds = fails >= 4 ? 60 : fails >= 3 ? 30 : 0;
  write(app, uid, { ...r, fails, lockedUntil: waitSeconds ? Date.now() + waitSeconds * 1000 : 0 });
  return { ok: false, remaining: MAX_FAILS - fails, waitSeconds, forceSignOut: false };
}

// "Unlocked" lasts for the life of the tab/app launch; the UI also re-locks after 5 min in the background.
export const isUnlocked = (app: string) => { try { return sessionStorage.getItem(UNLOCKED(app)) === "1"; } catch { return false; } };
export const markUnlocked = (app: string) => { try { sessionStorage.setItem(UNLOCKED(app), "1"); } catch { /* ignore */ } };
export const lockNow = (app: string) => { try { sessionStorage.removeItem(UNLOCKED(app)); } catch { /* ignore */ } };

export const setupDismissed = (app: string, uid: string) => { try { return localStorage.getItem(DISMISS(app, uid)) === "1"; } catch { return false; } };
export const dismissSetup = (app: string, uid: string) => { try { localStorage.setItem(DISMISS(app, uid), "1"); } catch { /* ignore */ } };

/**
 * Module-level current-user reference.
 *
 * The captionPool / taste / rules save functions are called from many places
 * (DumpChatSheet's taste_update actions, MainMenu settings, CaptionsSheet,
 * etc.) and don't have access to React context. Rather than thread `userId`
 * through every API, AuthContext writes the current user here on sign-in /
 * sign-out and the sync layer reads it.
 *
 * Returns null when signed out (or before AuthContext has initialized) —
 * callers should no-op the cloud save in that case.
 */
var currentUserId: string | null = null;

export function setCurrentUserId(id: string | null) {
  currentUserId = id;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

// ── AI memory change notification ──────────────────────────────────────────
// captionPool.ts calls notifyAIProfileChanged() after every mutation.
// aiProfileSync.ts registers a debounced cloud-save handler at import time.
// This indirection avoids a circular import between the two modules.

type ChangeHandler = (userId: string) => void;
var handler: ChangeHandler | null = null;

export function onAIProfileChanged(fn: ChangeHandler) {
  handler = fn;
}

export function notifyAIProfileChanged() {
  if (!handler) return;
  var uid = currentUserId;
  if (!uid) return;
  handler(uid);
}

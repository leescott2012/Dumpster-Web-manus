/**
 * Tiny in-app deep-link bus. The bell (and anything else) calls openTarget(); Home opens the
 * right sheet, MainMenu scrolls to the Taste Profile box. Keeps overlays decoupled.
 */
import type { NavTarget } from "@shared/notifications";

export const NAV_EVENT = "dumpster:nav";

export function openTarget(t: NavTarget) {
  if (t) window.dispatchEvent(new CustomEvent(NAV_EVENT, { detail: t }));
}

/** The user's local calendar day, YYYY-MM-DD (sent to the server so "daily" matches their day). */
export function localDay(d: Date = new Date()): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

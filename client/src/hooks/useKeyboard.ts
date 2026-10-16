/**
 * useKeyboard — Keyboard shortcut management hook
 * Supports binding callbacks to key combinations with escape handling
 */
import { useEffect, useCallback, useRef } from "react";

export interface KeyboardShortcut {
  /** Key combo like "ctrl+s", "?", "Escape" */
  keys: string;
  /** Callback fired when the combo is pressed */
  callback: () => void;
  /** Optional description for help overlays */
  description?: string;
  /** Prevent default browser behavior */
  preventDefault?: boolean;
}

export interface UseKeyboardOptions {
  /** Array of shortcuts to register */
  shortcuts: KeyboardShortcut[];
  /** Whether the handler should be active */
  enabled?: boolean;
  /** Element to attach to (default: document) */
  delegateTo?: HTMLElement;
}

// ── Key Normalization ─────────────────────────────────────────────────────────

function normalizeKey(key: string): string {
  const lowerKey = key.toLowerCase();

  const keyMap: Record<string, string> = {
    " ": "space",
    "escape": "escape",
    "enter": "enter",
    "tab": "tab",
    "delete": "delete",
    "arrowup": "up",
    "arrowdown": "down",
    "arrowleft": "left",
    "arrowright": "right",
    "insert": "insert",
    "home": "home",
    "end": "end",
    "pageup": "pageup",
    "pagedown": "pagedown",
  };

  return keyMap[lowerKey] || lowerKey;
}

function formatKeyCombo(e: KeyboardEvent): string {
  const parts: string[] = [];

  if (e.ctrlKey) parts.push("ctrl");
  if (e.metaKey) parts.push("cmd");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");

  const key = normalizeKey(e.key);
  parts.push(key);
  return parts.join("+").toLowerCase();
}

function formatKeyComboFromParts(combo: string): string {
  return combo.toLowerCase().trim();
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useKeyboard(
  shortcuts: KeyboardShortcut[],
  enabled: boolean = true,
  delegateTo?: HTMLElement
): Map<string, () => void> {
  const shortcutMapRef = useRef<Map<string, KeyboardShortcut>>(new Map());

  // Update the shortcut map when shortcuts change
  useEffect(() => {
    shortcutMapRef.current = new Map(
      shortcuts.map(s => [formatKeyComboFromParts(s.keys), s])
    );
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled) return;

    const target = delegateTo || document;

    const handleKeyDown = (e: KeyboardEvent) => {
      const combo = formatKeyCombo(e);
      const shortcut = shortcutMapRef.current.get(combo);

      if (shortcut) {
        if (shortcut.preventDefault !== false) {
          e.preventDefault();
        }
        shortcut.callback();
      }
    };

    target.addEventListener("keydown", handleKeyDown as EventListener);

    return () => {
      target.removeEventListener("keydown", handleKeyDown as EventListener);
    };
  }, [enabled, delegateTo, shortcutMapRef]);

  // Return a map for help display
  const shortcutMap = new Map<string, () => void>();
  shortcuts.forEach(s => {
    const normalized = formatKeyComboFromParts(s.keys);
    shortcutMap.set(normalized, s.callback);
  });

  return shortcutMap;
}

// ── Convenience Hook for Specific Shortcuts ─────────────────────────────────

/**
 * useShortcut — Bind a single keyboard shortcut
 */
export function useShortcut(
  keys: string,
  callback: () => void,
  options?: { enabled?: boolean; preventDefault?: boolean }
): void {
  useKeyboard([{ keys, callback, preventDefault: options?.preventDefault ?? false }], options?.enabled ?? true);
}

// ── Escape Key Hook ───────────────────────────────────────────────────────

/**
 * useEscapeKey — Call a callback when Escape is pressed
 */
export function useEscapeKey(callback: () => void, enabled: boolean = true): void {
  useKeyboard([{ keys: "escape", callback }], enabled);
}

// ── Tab Key Hook ───────────────────────────────────────────────────────────

/**
 * useTabKey — Track tab key state for cycling
 */
export function useTabKey(): {
  isPressed: boolean;
  pressCount: number;
  onTab: () => void;
  onKeyUp: () => void;
} {
  const isPressed = useRef(false);
  const pressCount = useRef(0);

  const onTab = useCallback(() => {
    isPressed.current = true;
    pressCount.current++;
  }, []);

  const onKeyUp = useCallback(() => {
    isPressed.current = false;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        onTab();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        onKeyUp();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [onTab, onKeyUp]);

  return {
    isPressed: isPressed.current,
    pressCount: pressCount.current,
    onTab,
    onKeyUp,
  };
}

// ── Global Shortcut Register ───────────────────────────────────────────────

/**
 * Keyboard Manager for registering global shortcuts
 */
export class KeyboardManagerClass {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private enabled: boolean = true;

  register(shortcut: KeyboardShortcut): void {
    const key = formatKeyComboFromParts(shortcut.keys);
    this.shortcuts.set(key, shortcut);
    this.attachHandler();
  }

  unregister(keys: string): void {
    const key = formatKeyComboFromParts(keys);
    this.shortcuts.delete(key);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  getAll(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  getMap(): Map<string, KeyboardShortcut> {
    return new Map(this.shortcuts);
  }

  private handlerAttached: boolean = false;

  private attachHandler(): void {
    if (this.handlerAttached) return;
    this.handlerAttached = true;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!this.enabled) return;
      const combo = formatKeyCombo(e);
      const shortcut = this.shortcuts.get(combo);
      if (shortcut) {
        e.preventDefault();
        shortcut.callback();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
  }
}

export const KeyboardManager = new KeyboardManagerClass();
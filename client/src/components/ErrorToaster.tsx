/**
 * ErrorToaster — visible "something went wrong" stack of toasts.
 *
 * Subscribes to the bugLogger pub-sub. Whenever an error is logged (non-silent),
 * a small red card slides in from the bottom right of the screen. The user can:
 *   • Tap "Send to bug log" → posts to /api/bug-report and inserts a row
 *   • Tap × to dismiss without sending
 *
 * Auto-dismisses after 12s if untouched. Stacks up to 3 visible; older ones
 * drop off but stay in console.
 *
 * Mount once near the top of the app tree (in main.tsx or App.tsx).
 */
import { useEffect, useState, useCallback } from "react";
import { onBugToast, type BugToastPayload } from "@/lib/bugLogger";

type Status = "pending" | "sending" | "sent" | "error";

interface ToastItem extends BugToastPayload {
  status: Status;
}

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 12_000;

export default function ErrorToaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    return onBugToast((p) => {
      setItems(prev => {
        const next = [...prev, { ...p, status: "pending" as Status }];
        // Keep only newest MAX_VISIBLE
        return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
      });
    });
  }, []);

  // Auto-dismiss timer per toast
  useEffect(() => {
    if (items.length === 0) return;
    const timers = items
      .filter(i => i.status === "pending")
      .map(i => setTimeout(() => {
        setItems(prev => prev.filter(p => p.id !== i.id));
      }, AUTO_DISMISS_MS));
    return () => { timers.forEach(t => clearTimeout(t)); };
  }, [items]);

  const dismiss = useCallback((id: string) => {
    setItems(prev => prev.filter(p => p.id !== id));
  }, []);

  const send = useCallback(async (id: string) => {
    setItems(prev => prev.map(p => p.id === id ? { ...p, status: "sending" } : p));
    const item = items.find(p => p.id === id);
    if (!item) return;
    const ok = await item.send();
    setItems(prev => prev.map(p => p.id === id ? { ...p, status: ok ? "sent" : "error" } : p));
    // Auto-dismiss successful sends after 2s
    if (ok) {
      setTimeout(() => setItems(prev => prev.filter(p => p.id !== id)), 2000);
    }
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Error notifications"
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 100000,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: "min(360px, calc(100vw - 32px))",
        pointerEvents: "none",
      }}
    >
      {items.map(item => (
        <div
          key={item.id}
          role="alert"
          style={{
            pointerEvents: "auto",
            background: "#1a0a0a",
            border: "1px solid #5a1a1a",
            borderLeft: "3px solid #ff4d4d",
            borderRadius: 10,
            padding: "10px 12px 10px 14px",
            color: "#fff",
            fontSize: 12,
            lineHeight: 1.4,
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            animation: "et-slide-in 0.18s ease-out",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <span style={{ color: "#ff8080", fontWeight: 700, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Error
              </span>
              <span style={{ color: "#888", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.source}{item.errorCode ? " · " + item.errorCode : ""}
              </span>
            </div>
            <button
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss"
              style={{
                background: "transparent", border: "none",
                color: "#888", fontSize: 14, cursor: "pointer",
                padding: "0 4px", lineHeight: 1,
              }}
            >×</button>
          </div>

          {/* Message */}
          <div style={{ color: "#eee", wordBreak: "break-word" }}>
            {item.message}
          </div>

          {/* Action row */}
          <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
            {item.status === "pending" && (
              <button
                onClick={() => send(item.id)}
                style={{
                  background: "#ff4d4d", color: "#000",
                  border: "none", borderRadius: 6,
                  padding: "5px 10px", fontSize: 11, fontWeight: 700,
                  cursor: "pointer", flex: 1,
                }}
              >
                Send to bug log
              </button>
            )}
            {item.status === "sending" && (
              <div style={{ color: "#888", fontSize: 11, padding: "5px 10px" }}>Sending…</div>
            )}
            {item.status === "sent" && (
              <div style={{ color: "#3ddc97", fontSize: 11, padding: "5px 10px", fontWeight: 700 }}>
                ✓ Logged
              </div>
            )}
            {item.status === "error" && (
              <button
                onClick={() => send(item.id)}
                style={{
                  background: "transparent", color: "#ff8080",
                  border: "1px solid #5a1a1a", borderRadius: 6,
                  padding: "5px 10px", fontSize: 11, cursor: "pointer", flex: 1,
                }}
              >
                Retry send
              </button>
            )}
          </div>
        </div>
      ))}

      <style>{`
        @keyframes et-slide-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

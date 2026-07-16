/**
 * NotificationBell — top-nav icon button with unread badge + dropdown panel.
 * Polls /api/notifications every 45s (no websockets needed at this volume,
 * per the spec). Only rendered for signed-in users.
 */
import { useEffect, useRef, useState } from "react";
import { Bell, MessageCircle, UserPlus, UserCheck, Bug, Info } from "lucide-react";
import { getAuthHeaders } from "@/lib/supabase";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

var TYPE_ICON: Record<string, React.ReactNode> = {
  dm: <MessageCircle size={14} />,
  connection_request: <UserPlus size={14} />,
  connection_accepted: <UserCheck size={14} />,
  bug_reply: <Bug size={14} />,
};

function timeAgo(iso: string): string {
  var ms = Date.now() - new Date(iso).getTime();
  var min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return min + "m";
  var hr = Math.floor(min / 60);
  if (hr < 24) return hr + "h";
  return Math.floor(hr / 24) + "d";
}

export default function NotificationBell() {
  var [items, setItems] = useState<Notification[]>([]);
  var [unread, setUnread] = useState(0);
  var [open, setOpen] = useState(false);
  var timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refresh() {
    try {
      var headers = await getAuthHeaders();
      if (!headers.Authorization) return;
      var res = await fetch("/api/notifications", { headers: headers });
      if (!res.ok) return;
      var data = await res.json();
      setItems(data.notifications || []);
      setUnread(data.unreadCount || 0);
    } catch {
      // silent — notifications are non-critical, don't surface a toast for a poll failure
    }
  }

  useEffect(function () {
    refresh();
    timerRef.current = setInterval(refresh, 45000);
    return function () { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  async function markAllRead() {
    setItems(function (prev) { return prev.map(function (n) { return { ...n, read_at: n.read_at || new Date().toISOString() }; }); });
    setUnread(0);
    try {
      var headers = await getAuthHeaders();
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: Object.assign({ "Content-Type": "application/json" }, headers),
        body: JSON.stringify({ markAllRead: true }),
      });
    } catch { /* local state already updated; next poll reconciles */ }
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={function (e) { e.stopPropagation(); setOpen(function (o) { var next = !o; if (next && unread > 0) markAllRead(); return next; }); }}
        aria-label="Notifications"
        style={{
          width: 36, height: 36, borderRadius: 9, position: "relative",
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#e8e8e8", transition: "all 0.15s",
        }}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8,
            background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
            border: "1.5px solid #050505",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={function () { setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 349 }} />
          <div style={{
            position: "absolute", top: 44, right: 0, width: 320, maxHeight: 420, overflowY: "auto",
            background: "#0e0e0e", border: "1px solid #2a2a2a", borderRadius: 14, zIndex: 350,
            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
          }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a1a1a", fontSize: 13, fontWeight: 700, color: "#e8e8e8" }}>
              Notifications
            </div>
            {items.length === 0 ? (
              <div style={{ padding: "28px 16px", textAlign: "center" as const, fontSize: 12, color: "#555" }}>
                <Info size={18} color="#444" style={{ marginBottom: 8 }} />
                <div>Nothing yet</div>
              </div>
            ) : (
              items.map(function (n) {
                return (
                  <a key={n.id} href={n.link || "#"} style={{
                    display: "flex", gap: 10, padding: "12px 16px", textDecoration: "none",
                    borderBottom: "1px solid #161616", background: n.read_at ? "transparent" : "rgba(var(--accent-rgb),0.05)",
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                      background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", color: "#8a8a8a",
                    }}>
                      {TYPE_ICON[n.type] || <Bell size={13} />}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#e8e8e8" }}>{n.title}</div>
                      {n.body && <div style={{ fontSize: 11.5, color: "#888", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{n.body}</div>}
                      <div style={{ fontSize: 10, color: "#555", marginTop: 3 }}>{timeAgo(n.created_at)}</div>
                    </div>
                  </a>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

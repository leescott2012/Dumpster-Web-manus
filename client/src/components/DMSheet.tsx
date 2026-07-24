/**
 * DMSheet — text thread with one accepted connection. Polls every 8s while
 * open (tighter than the notification bell's 45s since this is the active
 * focus when open).
 */
import { useEffect, useRef, useState } from "react";
import { X, Send } from "lucide-react";
import { getAuthHeaders } from "@/lib/supabase";
import { getCurrentUserId } from "@/lib/currentUser";

interface Profile { id: string; username: string | null; avatar_icon: string | null; avatar_color: string | null; }
interface DMMessage { id: string; sender_id: string; recipient_id: string; body: string; created_at: string; }

interface DMSheetProps {
  open: boolean;
  other: Profile | null;
  onClose: () => void;
}

export default function DMSheet({ open, other, onClose }: DMSheetProps) {
  var [messages, setMessages] = useState<DMMessage[]>([]);
  var [draft, setDraft] = useState("");
  var [sending, setSending] = useState(false);
  var timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  var scrollRef = useRef<HTMLDivElement | null>(null);
  var myId = getCurrentUserId();

  async function load() {
    if (!other) return;
    var headers = await getAuthHeaders();
    var res = await fetch("/api/dm?with=" + other.id, { headers: headers });
    if (res.ok) { var data = await res.json(); setMessages(data.messages || []); }
  }

  useEffect(function () {
    if (!open || !other) return;
    load();
    timerRef.current = setInterval(load, 8000);
    return function () { if (timerRef.current) clearInterval(timerRef.current); };
  }, [open, other?.id]);

  useEffect(function () {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  if (!open || !other) return null;

  async function send() {
    var text = draft.trim();
    if (!text || !other) return;
    setSending(true);
    setDraft("");
    var headers = await getAuthHeaders();
    var res = await fetch("/api/dm", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, headers),
      body: JSON.stringify({ recipientId: other.id, body: text }),
    });
    setSending(false);
    if (res.ok) load();
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)", zIndex: 650 }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 651,
        background: "#0e0e0e", borderTop: "1px solid #2a2a2a",
        borderRadius: "20px 20px 0 0", overflow: "hidden",
        height: "70vh", display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #1a1a1a", flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>@{other.username}</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", background: "#1a1a1a", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8a8a8a" }}>
            <X size={14} />
          </button>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.length === 0 && (
            <div style={{ margin: "auto", fontSize: 12, color: "#555" }}>Say hi to @{other.username}</div>
          )}
          {messages.map(function (m) {
            var mine = m.sender_id === myId;
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "75%", padding: "9px 13px", borderRadius: 14,
                  background: mine ? "var(--accent)" : "#1a1a1a",
                  color: mine ? "#0e0e0e" : "#e8e8e8",
                  fontSize: 13.5, wordBreak: "break-word" as const,
                }}>
                  {m.body}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, padding: "12px 20px calc(16px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid #1a1a1a", flexShrink: 0 }}>
          <input
            value={draft}
            onChange={function (e) { setDraft(e.target.value); }}
            onKeyDown={function (e) { if (e.key === "Enter") send(); }}
            placeholder="Message"
            style={{
              flex: 1, padding: "11px 14px", borderRadius: 20,
              background: "#141414", border: "1px solid #2a2a2a", color: "#e8e8e8",
              fontSize: 14, fontFamily: "inherit", outline: "none",
            }}
          />
          <button
            onClick={send}
            disabled={!draft.trim() || sending}
            style={{
              width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
              background: draft.trim() ? "var(--accent)" : "#1a1a1a",
              border: "none", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: draft.trim() ? "pointer" : "default", color: draft.trim() ? "#0e0e0e" : "#555",
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </>
  );
}

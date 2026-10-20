/**
 * FriendProfileSheet — a connection's profile: their public dumps, and a
 * comment thread on each dump so friends can leave ideas. Bottom sheet, same
 * look as DMSheet / ConnectionsPanel.
 */
import { useEffect, useState } from "react";
import { X, Send, ArrowLeft, Loader } from "lucide-react";
import { getAuthHeaders } from "@/lib/supabase";

interface Person { id: string; username: string | null; avatar_icon?: string | null; avatar_color?: string | null; }
interface DumpPhoto { id: string; url: string; label: string | null; }
interface FriendDump { id: string; title: string; subtitle: string | null; photos: DumpPhoto[]; commentCount: number; }
interface Comment { id: string; body: string; created_at: string; mine: boolean; author: { username: string | null } | null; }

export default function FriendProfileSheet({ person, onClose }: { person: Person | null; onClose: () => void }) {
  var [dumps, setDumps] = useState<FriendDump[] | null>(null);
  var [error, setError] = useState("");
  var [open, setOpen] = useState<FriendDump | null>(null);
  var [comments, setComments] = useState<Comment[]>([]);
  var [text, setText] = useState("");
  var [sending, setSending] = useState(false);

  useEffect(function () {
    if (!person) return;
    setDumps(null); setError(""); setOpen(null);
    getAuthHeaders().then(function (h) {
      return fetch("/api/connections?mode=profile&userId=" + encodeURIComponent(person!.id), { headers: h });
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) { if (x.ok) setDumps(x.d.dumps || []); else setError(x.d.error || "Couldn't load this profile."); })
      .catch(function () { setError("Couldn't load this profile."); });
  }, [person && person.id]);

  function loadComments(dumpId: string) {
    getAuthHeaders().then(function (h) { return fetch("/api/dump-comments?dumpId=" + dumpId, { headers: h }); })
      .then(function (r) { return r.json(); })
      .then(function (d) { setComments(d.comments || []); });
  }

  function openDump(d: FriendDump) { setOpen(d); setComments([]); setText(""); loadComments(d.id); }

  async function send() {
    var body = text.trim();
    if (!body || !open || sending) return;
    setSending(true);
    var h = await getAuthHeaders();
    var r = await fetch("/api/dump-comments", {
      method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, h),
      body: JSON.stringify({ dumpId: open.id, body: body }),
    });
    setSending(false);
    if (r.ok) { setText(""); loadComments(open.id); }
  }

  if (!person) return null;
  var card: React.CSSProperties = { background: "#141414", border: "1px solid #232323", borderRadius: 14, padding: 12, marginBottom: 14 };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)", zIndex: 650 }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 651, background: "#0e0e0e", borderTop: "1px solid #2a2a2a",
        borderRadius: "20px 20px 0 0", overflow: "hidden", height: "88vh", display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid #1a1a1a", flexShrink: 0 }}>
          {open && (
            <button aria-label="Back" onClick={function () { setOpen(null); }} style={{ background: "transparent", border: "none", color: "#8a8a8a", cursor: "pointer", display: "flex" }}><ArrowLeft size={18} /></button>
          )}
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: person.avatar_color || "#333", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#0e0e0e" }}>
            {(person.username || "?").slice(0, 1).toUpperCase()}
          </div>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: "#fff" }}>{open ? open.title : "@" + person.username}</div>
          <button aria-label="Close" onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", background: "#1a1a1a", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8a8a8a" }}><X size={14} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {error && <div style={{ color: "#999", fontSize: 13 }}>{error}</div>}
          {!error && dumps === null && <Loader size={16} color="#666" style={{ animation: "spin 0.8s linear infinite" }} />}
          {dumps && dumps.length === 0 && !open && <div style={{ color: "#777", fontSize: 13 }}>@{person.username} hasn't shared any dumps yet.</div>}

          {!open && dumps && dumps.map(function (d) {
            return (
              <button key={d.id} onClick={function () { openDump(d); }} style={{ ...card, display: "block", width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 10 }}>
                  {d.photos.slice(0, 5).map(function (p) {
                    return <img key={p.id} src={p.url} alt={p.label || ""} loading="lazy" style={{ width: 74, height: 96, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />;
                  })}
                </div>
                <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{d.title}</div>
                {d.subtitle && <div style={{ color: "#8a8a8a", fontSize: 12 }}>{d.subtitle}</div>}
                <div style={{ color: "var(--accent)", fontSize: 11, marginTop: 6 }}>
                  {d.photos.length + " photos · " + (d.commentCount ? d.commentCount + " comment" + (d.commentCount === 1 ? "" : "s") : "Tap to comment")}
                </div>
              </button>
            );
          })}

          {open && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 18 }}>
                {open.photos.map(function (p) {
                  return <img key={p.id} src={p.url} alt={p.label || ""} loading="lazy" style={{ width: "100%", aspectRatio: "4 / 5", objectFit: "cover", borderRadius: 8 }} />;
                })}
              </div>
              <div style={{ color: "#8a8a8a", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Ideas &amp; comments</div>
              {comments.length === 0 && <div style={{ color: "#666", fontSize: 12, marginBottom: 8 }}>No comments yet — leave the first idea.</div>}
              {comments.map(function (c) {
                return (
                  <div key={c.id} style={{ marginBottom: 10, fontSize: 13, color: "#e8e8e8", lineHeight: 1.45 }}>
                    <span style={{ fontWeight: 700, color: c.mine ? "var(--accent)" : "#fff" }}>{c.mine ? "You" : "@" + (c.author && c.author.username)}</span>{" "}
                    {c.body}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {open && (
          <div style={{ display: "flex", gap: 8, padding: "12px 20px calc(12px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid #1a1a1a", flexShrink: 0 }}>
            <input value={text} maxLength={500} onChange={function (e) { setText(e.target.value); }}
              onKeyDown={function (e) { if (e.key === "Enter") send(); }}
              placeholder="Leave an idea for this dump…"
              style={{ flex: 1, padding: "11px 14px", borderRadius: 12, background: "#141414", border: "1px solid #2a2a2a", color: "#e8e8e8", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
            <button onClick={send} disabled={!text.trim() || sending} aria-label="Send comment"
              style={{ width: 44, borderRadius: 12, border: "none", background: text.trim() ? "var(--accent)" : "#1a1a1a", color: text.trim() ? "#000" : "#555", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Send size={16} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

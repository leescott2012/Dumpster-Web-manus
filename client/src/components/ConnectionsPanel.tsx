/**
 * ConnectionsPanel — search users, send/accept/decline connection requests,
 * jump into a DM thread with an accepted connection. Bottom sheet, same
 * visual pattern as AuthSheet.
 */
import { useTrackWhenOpen } from "@/lib/analytics";
import { useEffect, useRef, useState } from "react";
import { X, Search, UserPlus, Check, MessageCircle, Loader } from "lucide-react";
import { getAuthHeaders } from "@/lib/supabase";
import DMSheet from "@/components/DMSheet";
import FriendProfileSheet from "@/components/FriendProfileSheet";

interface Profile { id: string; username: string | null; avatar_icon: string | null; avatar_color: string | null; }
interface ConnectionRow {
  id: string; requester_id: string; addressee_id: string; status: string;
  other: Profile;
}

interface ConnectionsPanelProps {
  open: boolean;
  onClose: () => void;
  myUserId: string;
  /** Set by a notification tap: open this friend's thread once connections load. */
  openDmUserId?: string | null;
}

interface Conversation { other: Profile; last: { body: string; created_at: string; mine: boolean }; unread: number; }

export default function ConnectionsPanel({ open, onClose, myUserId, openDmUserId }: ConnectionsPanelProps) {
  useTrackWhenOpen(open, "feature_friends");
  var [convos, setConvos] = useState<Conversation[]>([]);
  var handledDm = useRef<string | null>(null);
  var [query, setQuery] = useState("");
  var [results, setResults] = useState<Profile[]>([]);
  var [searching, setSearching] = useState(false);
  var [searched, setSearched] = useState(""); // query the current results belong to
  var [fuzzy, setFuzzy] = useState(false);
  var [connections, setConnections] = useState<ConnectionRow[]>([]);
  var [sentTo, setSentTo] = useState<Set<string>>(new Set());
  var [dmWith, setDmWith] = useState<Profile | null>(null);
  var [viewing, setViewing] = useState<Profile | null>(null);
  var timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadConnections() {
    var headers = await getAuthHeaders();
    var res = await fetch("/api/connections?mode=list", { headers: headers });
    if (res.ok) { var data = await res.json(); setConnections(data.connections || []); }
  }

  async function loadConvos() {
    try {
      var headers = await getAuthHeaders();
      var res = await fetch("/api/dm", { headers: headers });
      if (res.ok) { var data = await res.json(); setConvos(data.conversations || []); }
    } catch { /* messages list is non-critical */ }
  }

  useEffect(function () {
    if (!open) return;
    loadConnections(); loadConvos();
    var t = setInterval(loadConvos, 15000); // near-real-time unread counts while the panel is open
    return function () { clearInterval(t); };
  }, [open]);

  // Bell tap on "new message from X": jump straight into that thread.
  useEffect(function () {
    if (!open || !openDmUserId) { handledDm.current = null; return; }
    if (handledDm.current === openDmUserId) return; // open it once, not on every refresh
    var hit = connections.find(function (c) { return c.status === "accepted" && c.other.id === openDmUserId; });
    if (hit) { handledDm.current = openDmUserId; setDmWith(hit.other); }
  }, [open, openDmUserId, connections]);

  useEffect(function () {
    if (!open) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    var q = query.trim().replace(/^@+/, "");
    if (q.length < 1) { setResults([]); setSearched(""); setFuzzy(false); setSearching(false); return; }
    setSearching(true);
    timerRef.current = setTimeout(async function () {
      var headers = await getAuthHeaders();
      var res = await fetch("/api/connections?mode=search&q=" + encodeURIComponent(q), { headers: headers });
      var data = res.ok ? await res.json() : {};
      setResults(data.results || []);
      setFuzzy(!!data.fuzzy);
      setSearched(q);
      setSearching(false);
    }, 200);
  }, [query, open]);

  if (!open) return null;

  async function sendRequest(username: string) {
    setSentTo(function (prev) { return new Set(prev).add(username); });
    var headers = await getAuthHeaders();
    await fetch("/api/connections", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, headers),
      body: JSON.stringify({ username: username }),
    });
  }

  async function respond(id: string, status: "accepted" | "declined") {
    setConnections(function (prev) { return prev.map(function (c) { return c.id === id ? { ...c, status: status } : c; }); });
    var headers = await getAuthHeaders();
    await fetch("/api/connections", {
      method: "PATCH",
      headers: Object.assign({ "Content-Type": "application/json" }, headers),
      body: JSON.stringify({ id: id, status: status }),
    });
    if (status === "declined") loadConnections();
  }

  var incoming = connections.filter(function (c) { return c.status === "pending" && c.addressee_id === myUserId; });
  var outgoing = connections.filter(function (c) { return c.status === "pending" && c.requester_id === myUserId; });
  var accepted = connections.filter(function (c) { return c.status === "accepted"; });

  function avatarDot(p: Profile) {
    return (
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: p.avatar_color || "#333",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700, color: "#0e0e0e",
      }}>
        {(p.username || "?").slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)", zIndex: 600 }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 601,
        background: "#0e0e0e", borderTop: "1px solid #2a2a2a",
        borderRadius: "20px 20px 0 0", overflow: "hidden",
        maxHeight: "85vh", display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0", flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "#333" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px 12px", borderBottom: "1px solid #1a1a1a", flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>Connections</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", background: "#1a1a1a", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8a8a8a" }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {/* Search */}
          <div style={{ position: "relative", marginBottom: 20 }}>
            <Search size={15} color="#666" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={query}
              onChange={function (e) { setQuery(e.target.value); }}
              placeholder="Search by username"
              style={{
                width: "100%", padding: "12px 14px 12px 38px", borderRadius: 12,
                background: "#141414", border: "1px solid #2a2a2a", color: "#e8e8e8",
                fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
              }}
            />
            {searching && <Loader size={14} color="#666" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", animation: "spin 0.8s linear infinite" }} />}
          </div>
          {!searching && searched && searched === query.trim().replace(/^@+/, "") && results.length === 0 && (
            <div style={{ fontSize: 12, color: "#777", padding: "0 0 20px" }}>No one found for @{searched}. Check the spelling — try fewer letters.</div>
          )}
          {results.length > 0 && fuzzy && (
            <div style={{ fontSize: 11, color: "#777", marginBottom: 6 }}>No exact match for @{searched} — did you mean:</div>
          )}
          {results.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              {results.map(function (p) {
                var already = sentTo.has(p.username || "") || connections.some(function (c) { return c.other.id === p.id; });
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                    {avatarDot(p)}
                    <div style={{ flex: 1, fontSize: 13, color: "#e8e8e8" }}>@{p.username}</div>
                    <button
                      onClick={function () { if (p.username) sendRequest(p.username); }}
                      disabled={already}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8,
                        background: already ? "#1a1a1a" : "rgba(var(--accent-rgb),0.12)",
                        border: "1px solid " + (already ? "#2a2a2a" : "rgba(var(--accent-rgb),0.3)"),
                        color: already ? "#666" : "var(--accent)", fontSize: 11, fontWeight: 600,
                        cursor: already ? "default" : "pointer",
                      }}
                    >
                      {already ? "Sent" : <><UserPlus size={12} /> Add</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Incoming requests */}
          {incoming.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#8a8a8a", letterSpacing: "0.06em", marginBottom: 10 }}>REQUESTS</div>
              {incoming.map(function (c) {
                return (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                    {avatarDot(c.other)}
                    <div style={{ flex: 1, fontSize: 13, color: "#e8e8e8" }}>@{c.other.username}</div>
                    <button onClick={function () { respond(c.id, "declined"); }} style={{ padding: "6px 10px", borderRadius: 8, background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#888", fontSize: 11, cursor: "pointer" }}>Decline</button>
                    <button onClick={function () { respond(c.id, "accepted"); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", fontSize: 11, fontWeight: 600, cursor: "pointer" }}><Check size={12} /> Accept</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Messages: latest first, unread count per friend */}
          {convos.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#8a8a8a", letterSpacing: "0.06em", marginBottom: 10 }}>MESSAGES</div>
              {convos.map(function (c) {
                return (
                  <button key={c.other.id} onClick={function () { setDmWith(c.other); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", width: "100%", background: "transparent", border: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                    {avatarDot(c.other)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "#e8e8e8", fontWeight: c.unread ? 700 : 500 }}>@{c.other.username}</div>
                      <div style={{ fontSize: 11.5, color: c.unread ? "#bbb" : "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(c.last.mine ? "You: " : "") + c.last.body}</div>
                    </div>
                    {c.unread > 0 && (
                      <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: "var(--accent)", color: "#0e0e0e", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{c.unread}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* My connections */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8a8a8a", letterSpacing: "0.06em", marginBottom: 10 }}>
              MY CONNECTIONS {accepted.length > 0 && "(" + accepted.length + ")"}
            </div>
            {accepted.length === 0 && outgoing.length === 0 && (
              <div style={{ fontSize: 12, color: "#555", padding: "8px 0" }}>No connections yet — search above to find people.</div>
            )}
            {accepted.map(function (c) {
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                  {avatarDot(c.other)}
                  <button onClick={function () { setViewing(c.other); }} style={{ flex: 1, textAlign: "left", background: "transparent", border: "none", padding: 0, fontSize: 13, color: "#e8e8e8", cursor: "pointer", fontFamily: "inherit" }}>
                    @{c.other.username}<span style={{ color: "var(--accent)", fontSize: 11, marginLeft: 8 }}>View profile</span>
                  </button>
                  <button onClick={function () { setDmWith(c.other); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#e8e8e8", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    <MessageCircle size={12} /> Message
                  </button>
                </div>
              );
            })}
            {outgoing.map(function (c) {
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", opacity: 0.5 }}>
                  {avatarDot(c.other)}
                  <div style={{ flex: 1, fontSize: 13, color: "#e8e8e8" }}>@{c.other.username}</div>
                  <div style={{ fontSize: 11, color: "#666" }}>Pending</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <FriendProfileSheet person={viewing} onClose={function () { setViewing(null); }} />
      <DMSheet open={!!dmWith} other={dmWith} onClose={function () { setDmWith(null); loadConvos(); }} />
    </>
  );
}

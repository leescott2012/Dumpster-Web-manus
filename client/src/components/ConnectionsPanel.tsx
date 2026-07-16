/**
 * ConnectionsPanel — search users, send/accept/decline connection requests,
 * jump into a DM thread with an accepted connection. Bottom sheet, same
 * visual pattern as AuthSheet.
 */
import { useEffect, useRef, useState } from "react";
import { X, Search, UserPlus, Check, MessageCircle, Loader } from "lucide-react";
import { getAuthHeaders } from "@/lib/supabase";
import DMSheet from "@/components/DMSheet";

interface Profile { id: string; username: string | null; avatar_icon: string | null; avatar_color: string | null; }
interface ConnectionRow {
  id: string; requester_id: string; addressee_id: string; status: string;
  other: Profile;
}

interface ConnectionsPanelProps {
  open: boolean;
  onClose: () => void;
  myUserId: string;
}

export default function ConnectionsPanel({ open, onClose, myUserId }: ConnectionsPanelProps) {
  var [query, setQuery] = useState("");
  var [results, setResults] = useState<Profile[]>([]);
  var [searching, setSearching] = useState(false);
  var [connections, setConnections] = useState<ConnectionRow[]>([]);
  var [sentTo, setSentTo] = useState<Set<string>>(new Set());
  var [dmWith, setDmWith] = useState<Profile | null>(null);
  var timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadConnections() {
    var headers = await getAuthHeaders();
    var res = await fetch("/api/connections?mode=list", { headers: headers });
    if (res.ok) { var data = await res.json(); setConnections(data.connections || []); }
  }

  useEffect(function () { if (open) loadConnections(); }, [open]);

  useEffect(function () {
    if (!open) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    var q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    timerRef.current = setTimeout(async function () {
      var headers = await getAuthHeaders();
      var res = await fetch("/api/connections?mode=search&q=" + encodeURIComponent(q), { headers: headers });
      var data = await res.json();
      setResults(data.results || []);
      setSearching(false);
    }, 350);
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
                  <div style={{ flex: 1, fontSize: 13, color: "#e8e8e8" }}>@{c.other.username}</div>
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

      <DMSheet open={!!dmWith} other={dmWith} onClose={function () { setDmWith(null); }} />
    </>
  );
}

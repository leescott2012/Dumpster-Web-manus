/**
 * CaptionPool — Caption library tab in the pool.
 * Ported from iOS Views/CaptionPoolView.swift.
 * Features: style chips, auto-generate from style banks, custom add, filter tabs, favorite/ban/remove.
 */
import { useState, useCallback, useMemo, useEffect } from "react";
import { Heart, Trash2, Ban, Copy, Check, Sparkles, Plus } from "lucide-react";
import {
  loadCaptions, toggleFavorite, toggleBanned, removeCaption,
  addCaption, importCaptions,
  type PoolCaption, type CaptionStyle,
} from "@/lib/captionPool";

type FilterTab = "all" | "favorites" | "banned";

const STYLES: { key: Exclude<CaptionStyle, "ai" | "custom">; label: string }[] = [
  { key: "storytelling", label: "Storytelling" },
  { key: "emoji",        label: "Emoji" },
  { key: "clean",        label: "Clean" },
  { key: "numbered",     label: "Numbered" },
];

const STYLE_BANKS: Record<string, string[]> = {
  storytelling: [
    "the kind of night you tell stories about",
    "we didn't plan this, it just happened",
    "somewhere between the chaos and the calm",
    "a collection of moments I refuse to forget",
    "the unfiltered version of last week",
    "I have receipts but no explanation",
    "real ones know",
  ],
  emoji: ["📸✨🔥", "🌙💫🖤", "🏎💨✨", "🍸🌃🤍", "👁️🌹🖤"],
  clean: ["recent.", "documented.", "filed under: good times", "no notes.", "lately."],
  numbered: ["1. showed up  2. showed out", "1/10 of why this week hit different", "ten out of ten times"],
};

export default function CaptionPool() {
  const [list, setList] = useState<PoolCaption[]>(() => loadCaptions());
  const [activeStyle, setActiveStyle] = useState<CaptionStyle | "all">("all");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [customText, setCustomText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Refresh from storage if changed elsewhere
  useEffect(() => {
    const handler = () => setList(loadCaptions());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const filtered = useMemo(() => {
    let xs = list;
    if (filterTab === "favorites") xs = xs.filter(c => c.favorited);
    else if (filterTab === "banned") xs = xs.filter(c => c.banned);
    if (activeStyle !== "all") xs = xs.filter(c => c.style === activeStyle);
    return xs;
  }, [list, filterTab, activeStyle]);

  const handleAutoGenerate = useCallback(() => {
    const styleKey = activeStyle === "all" ? "storytelling" : activeStyle;
    const bank = STYLE_BANKS[styleKey as string] || STYLE_BANKS.storytelling;
    // Pick 3 random ones not already in pool
    const existing = new Set(list.map(c => c.text.toLowerCase()));
    const fresh = bank.filter(t => !existing.has(t.toLowerCase()));
    const picks = fresh.length >= 3 ? fresh.sort(() => 0.5 - Math.random()).slice(0, 3) : fresh;
    if (picks.length === 0) return;
    const next = importCaptions(picks, styleKey as CaptionStyle);
    setList(next);
  }, [activeStyle, list]);

  const handleAddCustom = useCallback(() => {
    const t = customText.trim();
    if (!t) return;
    addCaption(t, "custom");
    setCustomText("");
    setList(loadCaptions());
  }, [customText]);

  const handleFavorite = useCallback((id: string) => setList(toggleFavorite(id)), []);
  const handleBan = useCallback((id: string) => setList(toggleBanned(id)), []);
  const handleRemove = useCallback((id: string) => setList(removeCaption(id)), []);

  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch { /* noop */ }
  }, []);

  // ── styles ────────────────────────────────────────────────────────────────

  const chipStyle = (active: boolean): React.CSSProperties => ({
    background: active ? "var(--accent, #c8a96e)" : "transparent",
    color: active ? "#000" : "#888",
    border: active ? "none" : "1px solid #2a2a2a",
    borderRadius: 100, padding: "5px 14px",
    fontSize: 11, fontWeight: active ? 700 : 500,
    letterSpacing: "0.04em", cursor: "pointer",
    fontFamily: "inherit", transition: "all 0.15s",
  });

  return (
    <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px 120px" }}>
      {/* Style chips */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setActiveStyle("all")} style={chipStyle(activeStyle === "all")}>All</button>
        {STYLES.map(s => (
          <button key={s.key} onClick={() => setActiveStyle(s.key)} style={chipStyle(activeStyle === s.key)}>
            {s.label}
          </button>
        ))}
        <button onClick={() => setActiveStyle("ai")} style={chipStyle(activeStyle === "ai")}>AI</button>
        <button onClick={() => setActiveStyle("custom")} style={chipStyle(activeStyle === "custom")}>Custom</button>
      </div>

      {/* Auto-Generate + custom add row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "stretch", flexWrap: "wrap" }}>
        <button
          onClick={handleAutoGenerate}
          disabled={activeStyle === "all" || activeStyle === "ai" || activeStyle === "custom"}
          title={(activeStyle === "all" || activeStyle === "ai" || activeStyle === "custom") ? "Pick a style chip first" : "Add 3 random " + activeStyle + " captions"}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: (activeStyle === "all" || activeStyle === "ai" || activeStyle === "custom") ? "#1a1a1a" : "var(--accent, #c8a96e)",
            color: (activeStyle === "all" || activeStyle === "ai" || activeStyle === "custom") ? "#444" : "#000",
            border: "none", borderRadius: 100,
            padding: "8px 14px", fontSize: 12, fontWeight: 700,
            cursor: (activeStyle === "all" || activeStyle === "ai" || activeStyle === "custom") ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          <Sparkles size={13} /> Auto-Generate
        </button>

        <div style={{ display: "flex", flex: 1, minWidth: 220, background: "#141414", border: "1px solid #1e1e1e", borderRadius: 100, padding: "2px 2px 2px 14px", alignItems: "center", gap: 8 }}>
          <input
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAddCustom(); }}
            placeholder="Add your own caption..."
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "#fff", fontSize: 13, fontFamily: "inherit",
            }}
          />
          <button
            onClick={handleAddCustom}
            disabled={!customText.trim()}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              background: customText.trim() ? "var(--accent, #c8a96e)" : "#1a1a1a",
              color: customText.trim() ? "#000" : "#444",
              border: "none", cursor: customText.trim() ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Plus size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, borderBottom: "1px solid #1e1e1e", paddingBottom: 12 }}>
        {(["all", "favorites", "banned"] as FilterTab[]).map(tab => {
          const active = filterTab === tab;
          const count = tab === "all" ? list.length : tab === "favorites" ? list.filter(c => c.favorited).length : list.filter(c => c.banned).length;
          return (
            <button key={tab} onClick={() => setFilterTab(tab)} style={{
              background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit",
              padding: "6px 4px", fontSize: 11, fontWeight: 700,
              color: active ? "#fff" : "#555",
              letterSpacing: "0.1em", textTransform: "uppercase",
              borderBottom: active ? "2px solid var(--accent, #c8a96e)" : "2px solid transparent",
              transition: "all 0.15s", marginRight: 12,
            }}>
              {tab} <span style={{ color: active ? "var(--accent, #c8a96e)" : "#444", fontWeight: 500 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Caption list */}
      {filtered.length === 0 ? (
        <div style={{
          padding: "40px 24px", textAlign: "center",
          color: "#555", fontSize: 13, border: "1px dashed #1e1e1e", borderRadius: 12,
        }}>
          {filterTab === "favorites" ? "No favorites yet — heart captions you love." :
           filterTab === "banned" ? "Nothing banned." :
           "No captions in this style. Pick another or auto-generate."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(c => (
            <div key={c.id} style={{
              background: c.banned ? "rgba(239,68,68,0.04)" : "#141414",
              border: c.favorited ? "1px solid rgba(200,169,110,0.4)" : c.banned ? "1px solid rgba(239,68,68,0.2)" : "1px solid #1e1e1e",
              borderRadius: 12, padding: "12px 14px",
              display: "flex", alignItems: "center", gap: 10,
              transition: "all 0.15s",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, color: c.banned ? "#666" : "#e8e8e8",
                  textDecoration: c.banned ? "line-through" : "none",
                  lineHeight: 1.55, wordBreak: "break-word" as const,
                }}>
                  {c.text}
                </div>
                <div style={{ marginTop: 4, display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: "#555",
                    letterSpacing: "0.1em", textTransform: "uppercase",
                  }}>
                    {c.style}
                  </span>
                  {c.banned && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#ef4444", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
                      NEVER USE
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={() => handleCopy(c.text, c.id)} title="Copy" style={iconBtnStyle(copiedId === c.id ? "#22c55e" : "#666")}>
                  {copiedId === c.id ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <button onClick={() => handleFavorite(c.id)} title={c.favorited ? "Unfavorite" : "Favorite"} style={iconBtnStyle(c.favorited ? "#c8a96e" : "#666")}>
                  <Heart size={14} fill={c.favorited ? "#c8a96e" : "none"} />
                </button>
                <button onClick={() => handleBan(c.id)} title={c.banned ? "Unban" : "Ban"} style={iconBtnStyle(c.banned ? "#ef4444" : "#666")}>
                  <Ban size={14} />
                </button>
                <button onClick={() => handleRemove(c.id)} title="Delete" style={iconBtnStyle("#666")}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function iconBtnStyle(color: string): React.CSSProperties {
  return {
    width: 30, height: 30, borderRadius: 8,
    background: "transparent", border: "none", cursor: "pointer",
    color, display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.15s", padding: 0,
  };
}

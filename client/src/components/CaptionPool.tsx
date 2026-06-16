/**
 * CaptionPool — Caption library tab in the pool.
 * Ported from iOS Views/CaptionPoolView.swift.
 * Features: style chips, auto-generate from style banks, custom add, filter tabs, favorite/ban/remove.
 */
import { useState, useCallback, useMemo, useEffect } from "react";
import { Heart, Trash2, Ban, Copy, Check, Sparkles, Plus, RotateCcw } from "lucide-react";
import {
  loadCaptions, toggleFavorite, toggleBanned, removeCaption,
  addCaption, importCaptions, markCaptionUsed,
  type PoolCaption, type CaptionStyle,
} from "@/lib/captionPool";

type FilterTab = "all" | "favorites" | "banned" | "used";

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
    // "Used" shows only archived captions; every other tab hides them so a used
    // caption drops off the active list ("i dont need to see it on my list").
    if (filterTab === "used") xs = xs.filter(c => c.archived);
    else {
      xs = xs.filter(c => !c.archived);
      if (filterTab === "favorites") xs = xs.filter(c => c.favorited);
      else if (filterTab === "banned") xs = xs.filter(c => c.banned);
    }
    if (activeStyle !== "all") xs = xs.filter(c => c.style === activeStyle);
    return xs;
  }, [list, filterTab, activeStyle]);

  const handleAutoGenerate = useCallback(() => {
    // "All" draws from every preset bank; a specific style draws from its own.
    // (AI/Custom have no preset bank, so the button is disabled for them.)
    const banks: [string, string[]][] =
      activeStyle === "all"
        ? Object.entries(STYLE_BANKS)
        : [[activeStyle as string, STYLE_BANKS[activeStyle as string] || []]];

    // Flatten to candidates, dropping any already in the pool.
    const existing = new Set(list.map(c => c.text.toLowerCase()));
    const candidates = banks.flatMap(([style, texts]) =>
      texts.filter(t => !existing.has(t.toLowerCase())).map(text => ({ text, style }))
    );
    if (candidates.length === 0) return;

    // Pick 3 at random, then add them grouped by their own style so each
    // caption keeps its correct style tag.
    const picks = candidates.sort(() => 0.5 - Math.random()).slice(0, 3);
    const styles = picks.map(p => p.style).filter((s, i, arr) => arr.indexOf(s) === i);
    let next = list;
    styles.forEach(style => {
      const texts = picks.filter(p => p.style === style).map(p => p.text);
      next = importCaptions(texts, style as CaptionStyle);
    });
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
      // Using a caption archives it → moves to the "Used" tab so the active
      // list stays clean. Short delay so the copied checkmark is visible first.
      setTimeout(() => setList(markCaptionUsed(id, true)), 700);
    } catch { /* noop */ }
  }, []);

  const handleRestore = useCallback((id: string) => setList(markCaptionUsed(id, false)), []);

  // ── styles ────────────────────────────────────────────────────────────────

  const chipStyle = (active: boolean): React.CSSProperties => ({
    background: active ? "var(--accent)" : "transparent",
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
          disabled={activeStyle === "ai" || activeStyle === "custom"}
          title={(activeStyle === "ai" || activeStyle === "custom") ? "Auto-generate isn't available for AI / Custom — pick a preset style or All" : activeStyle === "all" ? "Add 3 random captions across all styles" : "Add 3 random " + activeStyle + " captions"}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: (activeStyle === "ai" || activeStyle === "custom") ? "#1a1a1a" : "var(--accent)",
            color: (activeStyle === "ai" || activeStyle === "custom") ? "#444" : "#000",
            border: "none", borderRadius: 100,
            padding: "8px 14px", fontSize: 12, fontWeight: 700,
            cursor: (activeStyle === "ai" || activeStyle === "custom") ? "not-allowed" : "pointer",
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
              background: customText.trim() ? "var(--accent)" : "#1a1a1a",
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
        {(["all", "favorites", "banned", "used"] as FilterTab[]).map(tab => {
          const active = filterTab === tab;
          const activeList = list.filter(c => !c.archived);
          const count = tab === "all" ? activeList.length
            : tab === "favorites" ? activeList.filter(c => c.favorited).length
            : tab === "banned" ? activeList.filter(c => c.banned).length
            : list.filter(c => c.archived).length;
          return (
            <button key={tab} onClick={() => setFilterTab(tab)} style={{
              background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit",
              padding: "6px 4px", fontSize: 11, fontWeight: 700,
              color: active ? "#fff" : "#555",
              letterSpacing: "0.1em", textTransform: "uppercase",
              borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
              transition: "all 0.15s", marginRight: 12,
            }}>
              {tab} <span style={{ color: active ? "var(--accent)" : "#444", fontWeight: 500 }}>{count}</span>
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
           filterTab === "used" ? "Nothing used yet. Captions you copy land here." :
           "No captions in this style. Pick another or auto-generate."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(c => (
            <div key={c.id} style={{
              background: c.banned ? "rgba(239,68,68,0.04)" : "#141414",
              border: c.favorited ? "1px solid rgba(var(--accent-rgb),0.4)" : c.banned ? "1px solid rgba(239,68,68,0.2)" : "1px solid #1e1e1e",
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
                {c.archived && (
                  <button onClick={() => handleRestore(c.id)} title="Restore to active list" style={iconBtnStyle("var(--accent)")}>
                    <RotateCcw size={14} />
                  </button>
                )}
                <button onClick={() => handleCopy(c.text, c.id)} title={c.archived ? "Copy" : "Copy & mark used"} style={iconBtnStyle(copiedId === c.id ? "#22c55e" : "#666")}>
                  {copiedId === c.id ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <button onClick={() => handleFavorite(c.id)} title={c.favorited ? "Unfavorite" : "Favorite"} style={iconBtnStyle(c.favorited ? "var(--accent)" : "#666")}>
                  <Heart size={14} fill={c.favorited ? "var(--accent)" : "none"} />
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

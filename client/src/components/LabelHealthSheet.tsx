/*
 * Label Health — compact chip for the pool header + detail sheet.
 * State/logic lives in hooks/useLabelHealth.ts; metrics in lib/labelHealth.ts.
 */
import { useState } from "react";
import { X, Loader2, Wand2, Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Photo } from "@/lib/photoData";
import { LABEL_CATEGORIES, MIN_CHECKS_FOR_SCORE, isGenericLabel, type LabelHealth, type LabelHealthStore, type SuspectReason } from "@/lib/labelHealth";
import type { FixStatus } from "@/hooks/useLabelHealth";

var DOT: Record<LabelHealth["status"], string> = { green: "#22c55e", amber: "#f59e0b", red: "#ef4444" };
var REASON: Record<SuspectReason | "unlabeled", string> = {
  unlabeled: "Needs a current category + specific label",
  low_confidence: "AI wasn't sure",
  audit_disagree: "Second check disagreed",
  duplicate_generic: "Same label as many others",
};

function title(c: string) { return c ? c.charAt(0) + c.slice(1).toLowerCase() : "—"; }

function fixLabel(fix: FixStatus): string | null {
  if (fix.kind === "running") return "Fixing…";
  if (fix.kind === "paused" && Date.now() < fix.until) return fix.daily ? "Paused — daily limit" : "Paused — resumes in a few minutes";
  return null;
}

export function LabelHealthChip({ health, fix, onOpen }: { health: LabelHealth; fix: FixStatus; onOpen: () => void }) {
  var text = health.labeled + "/" + health.total + " labeled" + (health.score !== null ? " · " + health.score + "%" : "");
  var note = fixLabel(fix);
  return (
    <button onClick={onOpen}
      aria-label={"Label health: " + text + (note ? ", " + note : "") + ". Open details"}
      title={note || "Label health"}
      style={{
        background: "transparent", border: "1px solid #2a2a2a", borderRadius: "100px",
        padding: "6px 12px", fontSize: "11px", color: "#bbb", cursor: "pointer", fontFamily: "inherit",
        display: "inline-flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap",
      }}
    >
      {fix.kind === "running"
        ? <Loader2 size={10} className="animate-spin" aria-hidden="true" />
        : <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: DOT[health.status], flexShrink: 0 }} />}
      {text}
    </button>
  );
}

interface SheetProps {
  health: LabelHealth;
  store: LabelHealthStore;
  fix: FixStatus;
  photos: Photo[];
  onClose: () => void;
  onRunFix: () => void;
  onFixOne: (p: Photo) => Promise<string | null>; // resolves to an error message, null = fixed
  onVerify: (p: Photo) => void;
  onEdit: (p: Photo, category: string, label: string) => void;
  onToggleAutoFix: (on: boolean) => void;
}

export default function LabelHealthSheet(props: SheetProps) {
  var { health, store, fix, photos } = props;
  var [editing, setEditing] = useState<string | null>(null);
  var [cat, setCat] = useState("");
  var [label, setLabel] = useState("");
  var [busy, setBusy] = useState<string | null>(null);

  var byId: Record<string, Photo> = {};
  photos.forEach(function(p) { byId[p.id] = p; });
  var items = health.unlabeled.map(function(p) { return { photo: byId[p.id], reason: "unlabeled" as SuspectReason | "unlabeled" }; })
    .concat(health.suspects.map(function(s) { return { photo: byId[s.photo.id], reason: s.reason }; }))
    .filter(function(x) { return !!x.photo; });
  var shown = items.slice(0, 60); // ponytail: plain list, cap 60; virtualize if pools get huge

  var pct = Math.round(health.coverage * 100);
  var note = fixLabel(fix);
  var snaps = store.snapshots;
  var weekAgo = snaps.length > 1 ? snaps[Math.max(0, snaps.length - 8)] : null;

  var btn: React.CSSProperties = {
    background: "transparent", border: "1px solid #2a2a2a", borderRadius: "100px",
    padding: "6px 12px", fontSize: "11px", color: "#bbb", cursor: "pointer", fontFamily: "inherit",
    display: "inline-flex", alignItems: "center", gap: "5px",
  };
  var input: React.CSSProperties = {
    background: "#161616", border: "1px solid #2a2a2a", borderRadius: 8, color: "#fff",
    padding: "6px 8px", fontSize: 12, fontFamily: "inherit", minWidth: 0,
  };

  var startEdit = function(p: Photo) {
    setEditing(p.id);
    setCat(LABEL_CATEGORIES.indexOf(p.category.toUpperCase()) >= 0 ? p.category.toUpperCase() : "LIFESTYLE");
    setLabel(isGenericLabel(p.alt) ? "" : p.alt);
  };
  var fixOne = function(p: Photo) {
    setBusy(p.id);
    props.onFixOne(p).then(function(err) { if (err) toast(err); })
      .then(function() { setBusy(null); });
  };

  return (
    <>
      <div onClick={props.onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)", zIndex: 450 }} />
      <div role="dialog" aria-modal="true" aria-labelledby="label-health-title" style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 451,
        background: "#0e0e0e", borderTop: "1px solid #2a2a2a", borderRadius: "20px 20px 0 0",
        maxHeight: "90vh", overflowY: "auto", padding: "12px 20px calc(20px + env(safe-area-inset-bottom, 0px))",
        maxWidth: 720, margin: "0 auto",
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "#333" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div id="label-health-title" style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Label Health</div>
            <div style={{ fontSize: 11, color: "#8a8a8a" }}>{note || "Photos only — videos stay on this device"}</div>
          </div>
          <button onClick={props.onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer" }}><X size={20} /></button>
        </div>

        {/* Coverage */}
        <div style={{ fontSize: 12, color: "#bbb", display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span>Labeled</span>
          <span style={{ color: "#fff", fontWeight: 700 }}>{health.labeled + " of " + health.total + " (" + pct + "%)"}</span>
        </div>
        <div role="progressbar" aria-label="Photos labeled" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
          style={{ height: 6, borderRadius: 3, background: "#222", overflow: "hidden" }}>
          <div style={{ height: "100%", width: pct + "%", background: DOT[health.status] }} />
        </div>
        <div style={{ fontSize: 11, color: "#8a8a8a", marginTop: 6 }}>
          {"AI confidence: " + health.buckets.high + " high · " + health.buckets.medium + " medium · " + health.buckets.low + " low" + (health.buckets.unknown ? " · " + health.buckets.unknown + " older (no score)" : "")}
        </div>

        {/* Accuracy */}
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #2a2a2a", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#bbb" }}>Accuracy</span>
            <span style={{ fontSize: health.score !== null ? 22 : 13, fontWeight: 700, color: "#fff" }}>
              {health.score !== null ? health.score + "%" : "Not enough data yet"}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#8a8a8a", marginTop: 2 }}>
            {health.score !== null
              ? "Based on " + health.basis + " checks"
              : health.basis + " of " + MIN_CHECKS_FOR_SCORE + " checks needed"}
            {weekAgo && weekAgo.score !== null && health.score !== null ? " · was " + weekAgo.score + "% on " + weekAgo.day : ""}
          </div>
          {snaps.length > 1 && (
            <div role="img" aria-label={"Labeled share over the last " + snaps.length + " days"}
              style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 24, marginTop: 8 }}>
              {snaps.map(function(s) {
                var h = s.total ? Math.max(2, Math.round((s.labeled / s.total) * 24)) : 2;
                return <div key={s.day} title={s.day + ": " + s.labeled + "/" + s.total} style={{ flex: 1, height: h, background: "rgba(var(--accent-rgb),0.6)", borderRadius: 1 }} />;
              })}
            </div>
          )}
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer" }}>How is this scored?</summary>
            <p style={{ fontSize: 11, color: "#8a8a8a", lineHeight: 1.5, margin: "6px 0 0" }}>
              Every time you tap "Looks right" on an AI label it counts as a hit; every time you change an AI label it counts as a miss.
              Those count double. A few photos a day also get a second, independent AI look — if it picks the same category that's a hit, otherwise a miss.
              The score is hits divided by all checks. We only show it after {MIN_CHECKS_FOR_SCORE} checks so it isn't a guess.
            </p>
          </details>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 16 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#bbb", cursor: "pointer" }}>
            <input type="checkbox" role="switch" aria-checked={store.autoFix} checked={store.autoFix}
              onChange={function(e) { props.onToggleAutoFix(e.target.checked); }} />
            Auto-fix labels
          </label>
          <button onClick={props.onRunFix} disabled={fix.kind === "running"}
            style={Object.assign({}, btn, { background: "var(--accent)", color: "#000", fontWeight: 700, border: "1px solid var(--accent)", opacity: fix.kind === "running" ? 0.7 : 1 })}>
            {fix.kind === "running" ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
            {fix.kind === "running" ? "Fixing…" : "Auto-fix now"}
          </button>
        </div>

        {/* Needs attention */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "#8a8a8a", margin: "20px 0 8px" }}>
          {items.length ? "NEEDS ATTENTION (" + items.length + ")" : "ALL GOOD"}
        </div>
        {items.length === 0 && <div style={{ fontSize: 12, color: "#8a8a8a" }}>Every photo has a specific label.</div>}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map(function(it) {
            var p = it.photo;
            var conf = store.info[p.id] && store.info[p.id].confidence;
            return (
              <li key={p.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", borderBottom: "1px solid #1a1a1a", paddingBottom: 10 }}>
                <img src={p.url} alt={p.alt || "Photo"} loading="lazy" width={52} height={52}
                  style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8, flexShrink: 0, background: "#1a1a1a" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editing === p.id ? (
                    <form onSubmit={function(e) {
                      e.preventDefault();
                      if (!label.trim()) return;
                      props.onEdit(p, cat, label);
                      setEditing(null);
                    }} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      <select aria-label="Category" value={cat} onChange={function(e) { setCat(e.target.value); }} style={input}>
                        {LABEL_CATEGORIES.map(function(c) { return <option key={c} value={c}>{title(c)}</option>; })}
                      </select>
                      <input aria-label="Label" value={label} placeholder="e.g. Red G-Wagon" maxLength={60}
                        onChange={function(e) { setLabel(e.target.value); }} style={Object.assign({}, input, { flex: "1 1 120px" })} />
                      <button type="submit" style={btn}>Save</button>
                      <button type="button" onClick={function() { setEditing(null); }} style={btn}>Cancel</button>
                    </form>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {isGenericLabel(p.alt) ? "No label yet" : p.alt}
                      </div>
                      <div style={{ fontSize: 11, color: "#8a8a8a" }}>
                        {(p.category ? title(p.category.toUpperCase()) + " · " : "")
                          + REASON[it.reason]
                          + (typeof conf === "number" ? " · " + Math.round(conf * 100) + "% sure" : "")}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                        <button onClick={function() { fixOne(p); }} disabled={busy === p.id} aria-label={"Fix label now for " + (p.alt || "photo")} style={btn}>
                          {busy === p.id ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}Fix now
                        </button>
                        {it.reason !== "unlabeled" && (
                          <button onClick={function() { props.onVerify(p); }} aria-label={"Mark label as right: " + p.alt} style={btn}>
                            <Check size={11} />Looks right
                          </button>
                        )}
                        <button onClick={function() { startEdit(p); }} aria-label={"Edit label for " + (p.alt || "photo")} style={btn}>
                          <Pencil size={11} />Edit
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {items.length > shown.length && (
          <div style={{ fontSize: 11, color: "#8a8a8a", marginTop: 8 }}>{"+" + (items.length - shown.length) + " more — Auto-fix works through them in the background."}</div>
        )}
      </div>
    </>
  );
}

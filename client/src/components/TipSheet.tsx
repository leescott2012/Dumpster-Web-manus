/*
 * TipSheet — the window a daily TIP notification opens: a screenshot, 3 steps, and a
 * "Try it" button for features that have a simple opener.
 */
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { TIPS } from "@shared/notifications";
import { TIP_GUIDES } from "@/lib/tipGuides";

interface TipSheetProps {
  tipId: string | null;
  onClose: () => void;
  onTry: (what: "autogen" | "captions" | "igscrub" | "friends") => void;
}

export default function TipSheet({ tipId, onClose, onTry }: TipSheetProps) {
  var [noImg, setNoImg] = useState(false);
  useEffect(function() { setNoImg(false); }, [tipId]);
  var tip = TIPS.find(function(t) { return t.id === tipId; });
  var guide = tipId ? TIP_GUIDES[tipId] : undefined;
  if (!tip || !guide) return null;
  var title = tip.title.replace(/^TIP:\s*/, "");

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 10002, backdropFilter: "blur(4px)" }} />
      <div role="dialog" aria-label={title} style={{
        position: "fixed", zIndex: 10003, left: "50%", top: "50%", transform: "translate(-50%,-50%)",
        width: "min(92vw, 380px)", maxHeight: "88vh", overflowY: "auto",
        background: "#0e0e0e", border: "1px solid #2a2a2a", borderRadius: 18, padding: 18, color: "#e8e8e8",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.16em", color: "var(--accent)", fontWeight: 700 }}>TIP</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{title}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: "#8a8a8a", cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 13, color: "#999", margin: "6px 0 12px" }}>{tip.body}</div>

        {!noImg && (
          <img src={"/tips/" + tip.id + ".jpg"} alt={"How to: " + title} onError={function() { setNoImg(true); }}
            style={{ width: "100%", borderRadius: 12, border: "1px solid #222", display: "block", marginBottom: 14 }} />
        )}

        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          {guide.steps.map(function(s, i) {
            return (
              <li key={i} style={{ display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.45 }}>
                <span style={{ flex: "0 0 22px", height: 22, borderRadius: 11, background: "var(--accent)", color: "#000", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                <span>{s}</span>
              </li>
            );
          })}
        </ol>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid #2a2a2a", background: "#161616", color: "#ccc", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Got it</button>
          {guide.tryIt && (
            <button onClick={function() { var t = guide!.tryIt!; onClose(); onTry(t); }}
              style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "var(--accent)", color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Try it</button>
          )}
        </div>
      </div>
    </>
  );
}

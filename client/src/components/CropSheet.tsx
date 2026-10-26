/*
 * CropSheet — crop a photo from its "..." menu. Pick a shape, drag to position,
 * slide to zoom. Returns a JPEG data URL (the caller swaps it in and re-uploads).
 */
import { useEffect, useRef, useState } from "react";
import type { Photo } from "@/lib/photoData";

interface CropSheetProps {
  photo: Photo | null;
  onClose: () => void;
  onApply: (photoId: string, dataUrl: string) => void;
}

var SHAPES: { label: string; ratio: number }[] = [
  { label: "4:5", ratio: 4 / 5 },
  { label: "1:1", ratio: 1 },
  { label: "9:16", ratio: 9 / 16 },
  { label: "16:9", ratio: 16 / 9 },
];
var BOX_MAX_W = 320;
var BOX_MAX_H = 380;

export default function CropSheet({ photo, onClose, onApply }: CropSheetProps) {
  var [img, setImg] = useState<HTMLImageElement | null>(null);
  var [failed, setFailed] = useState(false);
  var [ratio, setRatio] = useState(SHAPES[0].ratio);
  var [zoom, setZoom] = useState(1);            // 1 = just covers the box
  var [pos, setPos] = useState<{ x: number; y: number } | null>(null); // image top-left inside the box, px; null = centered
  var drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Load through fetch→blob so the canvas isn't tainted by a cross-origin image.
  useEffect(function() {
    setImg(null); setFailed(false); setZoom(1); setPos(null);
    if (!photo) return;
    var revoke: string | null = null;
    var dead = false;
    fetch(photo.url).then(function(r) { return r.blob(); }).then(function(b) {
      var u = URL.createObjectURL(b); revoke = u;
      var el = new Image();
      el.onload = function() { if (!dead) setImg(el); };
      el.onerror = function() { if (!dead) setFailed(true); };
      el.src = u;
    }).catch(function() { if (!dead) setFailed(true); });
    return function() { dead = true; if (revoke) URL.revokeObjectURL(revoke); };
  }, [photo ? photo.id : null]);

  if (!photo) return null;

  var boxW = ratio >= BOX_MAX_W / BOX_MAX_H ? BOX_MAX_W : Math.round(BOX_MAX_H * ratio);
  var boxH = Math.round(boxW / ratio);
  var base = img ? Math.max(boxW / img.naturalWidth, boxH / img.naturalHeight) : 1;
  var scale = base * zoom;
  var dispW = img ? img.naturalWidth * scale : 0;
  var dispH = img ? img.naturalHeight * scale : 0;
  function clamp(x: number, y: number) {
    return { x: Math.min(0, Math.max(boxW - dispW, x)), y: Math.min(0, Math.max(boxH - dispH, y)) };
  }
  // Keep the picture covering the box when shape/zoom changes.
  var p = clamp(pos ? pos.x : (boxW - dispW) / 2, pos ? pos.y : (boxH - dispH) / 2);

  function apply() {
    if (!img || !photo) return;
    var sw = boxW / scale, sh = boxH / scale;
    var outW = Math.min(1080, Math.round(sw));
    var canvas = document.createElement("canvas");
    canvas.width = outW; canvas.height = Math.round(outW / ratio);
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, -p.x / scale, -p.y / scale, sw, sh, 0, 0, canvas.width, canvas.height);
    onApply(photo.id, canvas.toDataURL("image/jpeg", 0.9));
  }

  var btn: React.CSSProperties = { padding: "10px 18px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 10002 }} />
      <div style={{ position: "fixed", zIndex: 10003, left: "50%", top: "50%", transform: "translate(-50%,-50%)", background: "#0e0e0e", border: "1px solid #2a2a2a", borderRadius: 16, padding: 16, width: "min(92vw, 360px)", color: "#e8e8e8" }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Crop</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {SHAPES.map(function(s) {
            var on = s.ratio === ratio;
            return <button key={s.label} onClick={function() { setRatio(s.ratio); setPos(null); }}
              style={{ ...btn, padding: "6px 12px", background: on ? "var(--accent)" : "#1a1a1a", color: on ? "#000" : "#ccc" }}>{s.label}</button>;
          })}
        </div>
        <div
          style={{ width: boxW, height: boxH, margin: "0 auto", position: "relative", overflow: "hidden", background: "#000", borderRadius: 8, touchAction: "none", cursor: "grab" }}
          onPointerDown={function(e) { drag.current = { px: e.clientX, py: e.clientY, ox: p.x, oy: p.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={function(e) { var d = drag.current; if (d) setPos(clamp(d.ox + e.clientX - d.px, d.oy + e.clientY - d.py)); }}
          onPointerUp={function() { drag.current = null; }}
        >
          {img && <img src={img.src} alt="" draggable={false} style={{ position: "absolute", left: p.x, top: p.y, width: dispW, height: dispH, maxWidth: "none", userSelect: "none", pointerEvents: "none" }} />}
          {!img && <div style={{ color: "#888", fontSize: 12, padding: 20, textAlign: "center" }}>{failed ? "Couldn't load this photo." : "Loading…"}</div>}
        </div>
        <input type="range" min={1} max={3} step={0.01} value={zoom} disabled={!img} aria-label="Zoom"
          onChange={function(e) { setZoom(Number(e.target.value)); setPos(p); }}
          style={{ width: "100%", marginTop: 12 }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={onClose} style={{ ...btn, background: "#1a1a1a", color: "#ccc" }}>Cancel</button>
          <button onClick={apply} disabled={!img} style={{ ...btn, background: "var(--accent)", color: "#000", opacity: img ? 1 : 0.4 }}>Apply</button>
        </div>
      </div>
    </>
  );
}

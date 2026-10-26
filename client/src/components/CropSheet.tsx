/*
 * CropSheet — Apple-Photos-style crop editor.
 *
 * Geometry (all in "stage" px, origin = top-left of the stage):
 *   work   = source image after flip + 90° rotation (full-res canvas, w × h)
 *   f      = fit scale, work → stage (aspect-fit, centered)
 *   angle  = straighten, rotates the image about the stage center
 *   z      = coverage zoom (>= 1), grown so the crop frame never shows empty canvas
 *   rect   = crop frame (screen space). It stays put while the image moves under it.
 * Export replays the exact preview transform at full resolution, so what you see is what you get.
 * Not built: perspective correction, AUTO straighten.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { FlipHorizontal2, Lock, RotateCw, Unlock } from "lucide-react";
import type { Photo } from "@/lib/photoData";

interface CropSheetProps {
  photo: Photo | null;
  onClose: () => void;
  onApply: (photoId: string, dataUrl: string) => void;
}

type Rect = { x: number; y: number; w: number; h: number };
type Handle = "move" | "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

var MIN = 48;          // smallest crop edge, px
var MAX_WORK = 3000;   // working canvas long-side cap (memory)
var MAX_OUT = 2160;    // exported long side
var RATIOS: { label: string; ratio: number | "original" | null }[] = [
  { label: "Original", ratio: "original" }, { label: "Freeform", ratio: null }, { label: "Square", ratio: 1 },
  { label: "4:5", ratio: 4 / 5 }, { label: "5:4", ratio: 5 / 4 }, { label: "4:3", ratio: 4 / 3 },
  { label: "3:4", ratio: 3 / 4 }, { label: "16:9", ratio: 16 / 9 }, { label: "9:16", ratio: 9 / 16 },
];

function lerpRect(a: Rect, b: Rect, t: number): Rect {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t };
}

export default function CropSheet({ photo, onClose, onApply }: CropSheetProps) {
  var [src, setSrc] = useState<HTMLImageElement | null>(null);
  var [failed, setFailed] = useState(false);
  var [flip, setFlip] = useState(false);
  var [rot, setRot] = useState(0);              // quarter turns
  var [angle, setAngle] = useState(0);          // straighten, degrees
  var [z, setZ] = useState(1);
  var [ratio, setRatio] = useState<number | null>(null); // null = freeform
  var [locked, setLocked] = useState(false);
  var [menu, setMenu] = useState(false);
  var [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 1, h: 1 });
  var canvasRef = useRef<HTMLCanvasElement>(null);
  var drag = useRef<{ h: Handle; px: number; py: number; start: Rect } | null>(null);
  var rectRef = useRef(rect); rectRef.current = rect;

  // Stage = the box the image is fitted into.
  var SW = Math.min(typeof window === "undefined" ? 360 : window.innerWidth - 40, 440);
  var SH = Math.min(typeof window === "undefined" ? 520 : window.innerHeight * 0.58, 560);

  // Load through fetch→blob: a cross-origin <img> would taint the export canvas.
  useEffect(function() {
    setSrc(null); setFailed(false); setFlip(false); setRot(0); setMenu(false);
    if (!photo) return;
    var revoke: string | null = null, dead = false;
    fetch(photo.url).then(function(r) { return r.blob(); }).then(function(b) {
      revoke = URL.createObjectURL(b);
      var el = new Image();
      el.onload = function() { if (!dead) setSrc(el); };
      el.onerror = function() { if (!dead) setFailed(true); };
      el.src = revoke;
    }).catch(function() { if (!dead) setFailed(true); });
    return function() { dead = true; if (revoke) URL.revokeObjectURL(revoke); };
  }, [photo ? photo.id : null]);

  // Working image: flip first, then quarter turns (fixed order so they never fight).
  var work = useMemo(function() {
    if (!src) return null;
    var k = Math.min(1, MAX_WORK / Math.max(src.naturalWidth, src.naturalHeight));
    var sw = Math.round(src.naturalWidth * k), sh = Math.round(src.naturalHeight * k);
    var c = document.createElement("canvas");
    var swap = rot % 2 === 1;
    c.width = swap ? sh : sw; c.height = swap ? sw : sh;
    var ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate(rot * Math.PI / 2);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(src, -sw / 2, -sh / 2, sw, sh);
    return c;
  }, [src, flip, rot]);

  var w = work ? work.width : 1, h = work ? work.height : 1;
  var f = Math.min(SW / w, SH / h);
  var full: Rect = { x: SW / 2 - (w * f) / 2, y: SH / 2 - (h * f) / 2, w: w * f, h: h * f };

  // Corner offsets from stage center, un-rotated by the straighten angle.
  function cornerOffsets(r: Rect, a: number) {
    var cos = Math.cos(a * Math.PI / 180), sin = Math.sin(a * Math.PI / 180);
    return [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]].map(function(c) {
      var dx = c[0] - SW / 2, dy = c[1] - SH / 2;
      return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
    });
  }
  function neededZoom(r: Rect, a: number) {
    var m = 1;
    cornerOffsets(r, a).forEach(function(p) { m = Math.max(m, (2 * Math.abs(p.x)) / (w * f), (2 * Math.abs(p.y)) / (h * f)); });
    return m;
  }
  function covered(r: Rect, a: number, zz: number) {
    return cornerOffsets(r, a).every(function(p) { return Math.abs(p.x) <= (w * f * zz) / 2 + 0.5 && Math.abs(p.y) <= (h * f * zz) / 2 + 0.5; });
  }

  // New image / quarter turn → full frame, no straighten.
  useEffect(function() {
    if (!work) return;
    setAngle(0); setZ(1); setRect(full);
  }, [work ? rot : -1, src]);

  // Draw the preview.
  useEffect(function() {
    var c = canvasRef.current;
    if (!c || !work) return;
    var dpr = window.devicePixelRatio || 1;
    c.width = SW * dpr; c.height = SH * dpr;
    var ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SW, SH);
    ctx.translate(SW / 2, SH / 2);
    ctx.rotate(angle * Math.PI / 180);
    ctx.scale(f * z, f * z);
    ctx.drawImage(work, -w / 2, -h / 2);
  }, [work, angle, z, SW, SH]);

  function resize(hd: Handle, s: Rect, dx: number, dy: number): Rect {
    if (hd === "move") return { x: s.x + dx, y: s.y + dy, w: s.w, h: s.h };
    var l = s.x, t = s.y, r = s.x + s.w, b = s.y + s.h;
    var fixed = locked && ratio;
    if (!fixed) {
      if (hd.indexOf("w") >= 0) l = Math.min(l + dx, r - MIN);
      if (hd.indexOf("e") >= 0) r = Math.max(r + dx, l + MIN);
      if (hd.indexOf("n") >= 0) t = Math.min(t + dy, b - MIN);
      if (hd.indexOf("s") >= 0) b = Math.max(b + dy, t + MIN);
      return { x: l, y: t, w: r - l, h: b - t };
    }
    var rr = ratio as number;
    if (hd.length === 2) { // corner: opposite corner is the anchor
      var nw = Math.max(MIN, hd.indexOf("w") >= 0 ? r - (l + dx) : (r + dx) - l);
      var nh = nw / rr;
      return { x: hd.indexOf("w") >= 0 ? r - nw : l, y: hd.indexOf("n") >= 0 ? b - nh : t, w: nw, h: nh };
    }
    if (hd === "n" || hd === "s") { // edge: grow about the far edge, centered across
      var eh = Math.max(MIN / rr, hd === "n" ? b - (t + dy) : (b + dy) - t), ew = eh * rr;
      return { x: s.x + s.w / 2 - ew / 2, y: hd === "n" ? b - eh : t, w: ew, h: eh };
    }
    var fw = Math.max(MIN, hd === "w" ? r - (l + dx) : (r + dx) - l), fh = fw / rr;
    return { x: hd === "w" ? r - fw : l, y: s.y + s.h / 2 - fh / 2, w: fw, h: fh };
  }

  function onMove(e: React.PointerEvent) {
    var d = drag.current;
    if (!d) return;
    var cand = resize(d.h, d.start, e.clientX - d.px, e.clientY - d.py);
    var cur = rectRef.current;
    if (covered(cand, angle, z)) { setRect(cand); return; }
    // Hit the edge of the picture: slide to the furthest valid spot instead of freezing.
    var lo = 0, hi = 1;
    for (var i = 0; i < 8; i++) { var mid = (lo + hi) / 2; if (covered(lerpRect(cur, cand, mid), angle, z)) lo = mid; else hi = mid; }
    setRect(lerpRect(cur, cand, lo));
  }
  function begin(hd: Handle) {
    return function(e: React.PointerEvent) {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { h: hd, px: e.clientX, py: e.clientY, start: rectRef.current };
    };
  }

  // Largest frame of this shape that still sits on the picture, centered.
  function fitRatio(rr: number, a: number, zz: number): Rect {
    var cw = Math.min(w * f * zz, h * f * zz * rr), ch = cw / rr;
    var r: Rect = { x: SW / 2 - cw / 2, y: SH / 2 - ch / 2, w: cw, h: ch };
    for (var i = 0; i < 80 && !covered(r, a, zz); i++) {
      r = { x: SW / 2 - (r.w * 0.97) / 2, y: SH / 2 - (r.h * 0.97) / 2, w: r.w * 0.97, h: r.h * 0.97 };
    }
    return r;
  }
  function pickRatio(v: number | "original" | null) {
    setMenu(false);
    if (v === null) { setRatio(null); setLocked(false); return; }
    var rr = v === "original" ? w / h : v;
    setRatio(rr); setLocked(true); setRect(fitRatio(rr, angle, z));
  }
  function toggleLock() {
    if (locked) { setLocked(false); return; }
    var cur = rectRef.current;
    setRatio(ratio || cur.w / cur.h); setLocked(true);
  }
  function doFlip() { // mirror the frame about the stage center so it stays on the same part of the picture
    setFlip(!flip); setAngle(-angle);
    var r = rectRef.current; setRect({ x: SW - (r.x + r.w), y: r.y, w: r.w, h: r.h });
  }
  function onStraighten(a: number) { setAngle(a); setZ(neededZoom(rectRef.current, a)); }

  function done() {
    if (!work || !photo) return;
    var r = rectRef.current;
    var k = Math.min(1, MAX_OUT / (Math.max(r.w, r.h) / (f * z))) / (f * z); // output px per stage px (1 stage px = 1/(f*z) working px)
    var out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(r.w * k)); out.height = Math.max(1, Math.round(r.h * k));
    var ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.scale(out.width / r.w, out.height / r.h);
    ctx.translate(-r.x, -r.y);
    ctx.translate(SW / 2, SH / 2);
    ctx.rotate(angle * Math.PI / 180);
    ctx.scale(f * z, f * z);
    ctx.drawImage(work, -w / 2, -h / 2);
    onApply(photo.id, out.toDataURL("image/jpeg", 0.92));
  }

  if (!photo) return null;

  var white = "#fff";
  var pill: React.CSSProperties = { background: "rgba(30,30,30,0.92)", color: white, border: "none", borderRadius: 22, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 };
  // Invisible 44px touch target centered on (cx, cy).
  function hit(hd: Handle, cx: number, cy: number, cursor: string, bar?: React.CSSProperties) {
    return (
      <div key={hd} onPointerDown={begin(hd)} onPointerMove={onMove} onPointerUp={function() { drag.current = null; }}
        style={{ position: "absolute", left: cx - 22, top: cy - 22, width: 44, height: 44, cursor: cursor, touchAction: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {bar && <div style={Object.assign({ position: "absolute", background: white, borderRadius: 2 }, bar)} />}
      </div>
    );
  }
  function corner(hd: Handle, cx: number, cy: number, sx: number, sy: number, cursor: string) {
    var L = 20, T = 4;
    return (
      <div key={hd} onPointerDown={begin(hd)} onPointerMove={onMove} onPointerUp={function() { drag.current = null; }}
        style={{ position: "absolute", left: cx - 22, top: cy - 22, width: 44, height: 44, cursor: cursor, touchAction: "none" }}>
        <div style={{ position: "absolute", left: 22 + (sx > 0 ? -T / 2 : -L + T / 2), top: 22 - T / 2, width: L, height: T, background: white }} />
        <div style={{ position: "absolute", left: 22 - T / 2, top: 22 + (sy > 0 ? -T / 2 : -L + T / 2), width: T, height: L, background: white }} />
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10002, background: "#4b5651", display: "flex", flexDirection: "column", alignItems: "center", color: white, touchAction: "none" }}>
      <div style={{ width: "100%", maxWidth: 480, padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 0", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <button onClick={onClose} style={pill}>Cancel</button>
          <button onClick={done} disabled={!work} style={Object.assign({}, pill, { opacity: work ? 1 : 0.4, background: work ? "#facc15" : pill.background, color: work ? "#000" : white })}>Done</button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={doFlip} aria-label="Flip" style={pill}><FlipHorizontal2 size={20} /></button>
            <button onClick={function() { setRot((rot + 1) % 4); }} aria-label="Rotate" style={pill}><RotateCw size={20} /></button>
          </div>
          <button onClick={function() { setMenu(!menu); }} aria-label="Aspect ratio" style={pill}>
            {ratio === null ? "Freeform" : (RATIOS.filter(function(x) { return x.ratio === ratio; })[0] || { label: "Custom" }).label}
          </button>
          {menu && (
            <div style={{ position: "absolute", right: 0, top: 48, background: "rgba(25,25,25,0.97)", borderRadius: 14, padding: 6, zIndex: 5, minWidth: 150 }}>
              {RATIOS.map(function(x) {
                return <button key={x.label} onClick={function() { pickRatio(x.ratio); }}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", color: white, border: "none", padding: "10px 14px", fontSize: 14, cursor: "pointer", borderRadius: 8, fontFamily: "inherit" }}>{x.label}</button>;
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ position: "relative", width: SW, height: SH, marginTop: 18, clipPath: "inset(-24px)" }}>
        <canvas ref={canvasRef} style={{ width: SW, height: SH, display: "block" }} />
        {!work && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, opacity: 0.8 }}>{failed ? "Couldn't load this photo." : "Loading…"}</div>}
        {work && (
          <>
            <div onPointerDown={begin("move")} onPointerMove={onMove} onPointerUp={function() { drag.current = null; }}
              style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, boxSizing: "border-box", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 0 0 4000px rgba(0,0,0,0.5)", cursor: "move", touchAction: "none" }}>
              <button aria-label={locked ? "Unlock aspect ratio" : "Lock aspect ratio"} onPointerDown={function(e) { e.stopPropagation(); }} onClick={toggleLock}
                style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 15, border: "none", background: "rgba(0,0,0,0.45)", color: locked ? "#facc15" : white, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                {locked ? <Lock size={15} /> : <Unlock size={15} />}
              </button>
            </div>
            {hit("n", rect.x + rect.w / 2, rect.y, "ns-resize", { width: 28, height: 4 })}
            {hit("s", rect.x + rect.w / 2, rect.y + rect.h, "ns-resize", { width: 28, height: 4 })}
            {hit("w", rect.x, rect.y + rect.h / 2, "ew-resize", { width: 4, height: 28 })}
            {hit("e", rect.x + rect.w, rect.y + rect.h / 2, "ew-resize", { width: 4, height: 28 })}
            {corner("nw", rect.x, rect.y, 1, 1, "nwse-resize")}
            {corner("ne", rect.x + rect.w, rect.y, -1, 1, "nesw-resize")}
            {corner("sw", rect.x, rect.y + rect.h, 1, -1, "nesw-resize")}
            {corner("se", rect.x + rect.w, rect.y + rect.h, -1, -1, "nwse-resize")}
          </>
        )}
      </div>

      <div style={{ width: "100%", maxWidth: 440, padding: "18px 24px 0", boxSizing: "border-box", textAlign: "center" }}>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>Straighten {angle === 0 ? "" : (angle > 0 ? "+" : "") + angle.toFixed(1) + "°"}</div>
        <input type="range" min={-45} max={45} step={0.1} value={angle} disabled={!work} aria-label="Straighten"
          onChange={function(e) { onStraighten(Number(e.target.value)); }}
          onDoubleClick={function() { onStraighten(0); }}
          style={{ width: "100%", accentColor: "#facc15" }} />
      </div>
    </div>
  );
}

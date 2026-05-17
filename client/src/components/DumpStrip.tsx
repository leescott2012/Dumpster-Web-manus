/*
 * DumpStrip — horizontal scroll-snap strip with 12px gap
 * Dump header, photo cards, "+" card at end
 * Max 20 photos per dump. No HOOK label.
 */
import { useRef, useState, useEffect } from "react";
import PhotoCard from "./PhotoCard";
import { useDrag } from "@/contexts/DragContext";
import type { Dump, Photo } from "@/lib/photoData";
import { Plus, Pencil, MoreHorizontal, Heart, ChevronLeft, ChevronRight, Copy, Check } from "lucide-react";

interface DumpStripProps {
  dump: Dump;
  selectedPhotoId: string | null;
  onSelectPhoto: (photo: Photo) => void;
  onDotsClick: (photo: Photo, position: { x: number; y: number }) => void;
  onDoubleTapPhoto: (photo: Photo) => void;
  onDropPhoto: (dumpId: string, insertIndex: number) => void;
  onDeleteDump?: (dumpId: string) => void;
  onRenameDump?: (dumpId: string, title: string) => void;
  onPlusClick: (dumpId: string) => void;
  onMenuClick?: (dumpId: string) => void;
  onCaptionClick?: (dumpId: string) => void;
  isCustom?: boolean;
}

export default function DumpStrip({
  dump, selectedPhotoId, onSelectPhoto, onDotsClick, onDoubleTapPhoto,
  onDropPhoto, onDeleteDump, onRenameDump, onPlusClick, onMenuClick, onCaptionClick, isCustom = false,
}: DumpStripProps) {
  var stripRef = useRef<HTMLDivElement>(null);
  var { dragState } = useDrag();
  var [dropIndex, setDropIndex] = useState<number | null>(null);
  var [isEditing, setIsEditing] = useState(false);
  var [editTitle, setEditTitle] = useState(dump.title);
  var dropIndexRef = useRef<number | null>(null);
  var [captionIdx, setCaptionIdx] = useState(0);
  var [copied, setCopied] = useState(false);

  useEffect(function() { dropIndexRef.current = dropIndex; }, [dropIndex]);

  useEffect(function() {
    if (!dragState.isDragging) { setDropIndex(null); return; }
    var dumpId = dump.id;
    var dumpPhotosLen = dump.photos.length;

    var handleMove = function(e: TouchEvent | MouseEvent) {
      var clientX: number; var clientY: number;
      if ("touches" in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
      else { clientX = (e as MouseEvent).clientX; clientY = (e as MouseEvent).clientY; }
      if (!stripRef.current) return;
      var rect = stripRef.current.getBoundingClientRect();
      if (clientY >= rect.top - 40 && clientY <= rect.bottom + 40 && clientX >= rect.left - 20 && clientX <= rect.right + 20) {
        var cards = stripRef.current.querySelectorAll("[data-photo-id]");
        var insertIdx = dumpPhotosLen;
        for (var i = 0; i < cards.length; i++) {
          var cardRect = cards[i].getBoundingClientRect();
          var midX = cardRect.left + cardRect.width / 2;
          if (clientX < midX) { insertIdx = i; break; }
        }
        if (dragState.source && dragState.source.type === "dump" && dragState.source.dumpId === dumpId) {
          var srcIdx = dragState.source.index;
          if (insertIdx === srcIdx || insertIdx === srcIdx + 1) { setDropIndex(null); return; }
        }
        setDropIndex(insertIdx);
      } else { setDropIndex(null); }
    };

    var handleEnd = function() {
      if (dropIndexRef.current !== null) onDropPhoto(dumpId, dropIndexRef.current);
    };

    window.addEventListener("touchmove", handleMove, { passive: true });
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("touchend", handleEnd);
    window.addEventListener("mouseup", handleEnd);
    return function() {
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("mouseup", handleEnd);
    };
  }, [dragState.isDragging, dragState.source, dump.id, dump.photos.length, onDropPhoto]);

  var handleTitleSubmit = function() {
    setIsEditing(false);
    if (editTitle.trim() && editTitle !== dump.title) {
      if (onRenameDump) onRenameDump(dump.id, editTitle.trim());
    } else { setEditTitle(dump.title); }
  };

  var isOverCapacity = dump.photos.length >= 20;
  var showDropIndicator = dropIndex !== null && !isOverCapacity;
  var dumpNumStr = dump.number < 10 ? "0" + dump.number : "" + dump.number;

  return (
    <section data-dump-id={dump.id} data-tour={"dump-" + dump.number} style={{ maxWidth: "1100px", margin: "56px auto", padding: "0 32px" }}>
      {/* Dump Header */}
      <div style={{ marginBottom: "32px", paddingBottom: "24px", borderBottom: "1px solid #1e1e1e", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase" as const, color: "var(--accent)", marginBottom: "8px" }}>
            {"DUMP " + dumpNumStr}
          </div>
          {isEditing ? (
            <input value={editTitle}
              onChange={function(e) { setEditTitle(e.target.value); }}
              onBlur={handleTitleSubmit}
              onKeyDown={function(e) { if (e.key === "Enter") handleTitleSubmit(); if (e.key === "Escape") { setEditTitle(dump.title); setIsEditing(false); } }}
              autoFocus
              style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", background: "transparent", border: "none", borderBottom: "2px solid var(--accent)", borderRadius: "0", padding: "2px 0", outline: "none", width: "100%", maxWidth: "500px", fontFamily: "inherit" }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={function() { setIsEditing(true); }}>
              <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", marginBottom: "0" }}>
                {dump.title}
              </h2>
              <Pencil size={14} color="#555" style={{ flexShrink: 0, marginTop: "4px", transition: "color 0.15s" }}
                onMouseEnter={function(e) { (e.currentTarget as SVGElement).style.color = "var(--accent)"; }}
                onMouseLeave={function(e) { (e.currentTarget as SVGElement).style.color = "#555"; }}
              />
            </div>
          )}
          <div style={{ fontSize: "14px", color: "#666", fontStyle: "italic" }}>
            {dump.subtitle}
            {dump.photos.length > 0 && (
              <span style={{ marginLeft: "12px", color: "#999", fontStyle: "normal", fontSize: "12px" }}>
                {dump.photos.length + "/20 photos"}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Heart indicator — visible when dump is favorited */}
          {dump.favorited && (
            <Heart size={14} fill="#e05c7a" color="#e05c7a" style={{ flexShrink: 0 }} />
          )}
          {/* "..." menu button */}
          {onMenuClick && (
            <button
              data-tour="dump-menu"
              onClick={function() { onMenuClick(dump.id); }}
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: "transparent", border: "1px solid #2a2a2a",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#666", transition: "all 0.15s",
              }}
              onMouseEnter={function(e) { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.background = "rgba(var(--accent-rgb),0.06)"; }}
              onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#666"; e.currentTarget.style.background = "transparent"; }}
            >
              <MoreHorizontal size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Caption Bubble — shown when captions exist */}
      {dump.captions && dump.captions.length > 0 && (function() {
        var captions = dump.captions!;
        var total = captions.length;
        var current = captions[Math.min(captionIdx, total - 1)];
        var handleCopy = function(e: React.MouseEvent) {
          e.stopPropagation();
          navigator.clipboard.writeText(current).then(function() {
            setCopied(true);
            setTimeout(function() { setCopied(false); }, 1800);
          });
        };
        var handlePrev = function(e: React.MouseEvent) {
          e.stopPropagation();
          setCaptionIdx(function(i) { return (i - 1 + total) % total; });
        };
        var handleNext = function(e: React.MouseEvent) {
          e.stopPropagation();
          setCaptionIdx(function(i) { return (i + 1) % total; });
        };
        return (
          <div
            onClick={function() { if (onCaptionClick) onCaptionClick(dump.id); }}
            style={{
              marginBottom: "28px", borderLeft: "3px solid var(--accent)",
              paddingLeft: "16px", cursor: onCaptionClick ? "pointer" : "default",
            }}
          >
            {/* Vibe + index label */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: "var(--accent)", textTransform: "uppercase" as const }}>
                {dump.vibe ? dump.vibe + " · " : ""}{captionIdx + 1}/{total} captions
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                {/* Copy button */}
                <button onClick={handleCopy}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: copied ? "#22c55e" : "#555", padding: "4px", display: "flex", alignItems: "center", transition: "color 0.15s" }}
                  title="Copy caption"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
                {/* Prev / Next */}
                {total > 1 && (
                  <>
                    <button onClick={handlePrev}
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "#555", padding: "4px", display: "flex", alignItems: "center", transition: "color 0.15s" }}
                      onMouseEnter={function(e) { e.currentTarget.style.color = "var(--accent)"; }}
                      onMouseLeave={function(e) { e.currentTarget.style.color = "#555"; }}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button onClick={handleNext}
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "#555", padding: "4px", display: "flex", alignItems: "center", transition: "color 0.15s" }}
                      onMouseEnter={function(e) { e.currentTarget.style.color = "var(--accent)"; }}
                      onMouseLeave={function(e) { e.currentTarget.style.color = "#555"; }}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
            {/* Caption text */}
            <div style={{ fontSize: "14px", color: "#b0b0b0", lineHeight: 1.6, fontStyle: "italic", maxWidth: "680px" }}>
              {current}
            </div>
            {onCaptionClick && (
              <div style={{ marginTop: "8px", fontSize: "10px", color: "#444", letterSpacing: "0.06em" }}>
                tap to edit
              </div>
            )}
          </div>
        );
      })()}

      {/* Slide Strip */}
      <div ref={stripRef} style={{
        display: "flex", gap: "12px",
        overflowX: dragState.isDragging ? "hidden" : "auto",
        paddingBottom: "16px", marginBottom: "32px",
        scrollSnapType: dragState.isDragging ? "none" : "x mandatory",
        WebkitOverflowScrolling: "touch", minHeight: "264px", alignItems: "center",
        position: "relative",
        borderRadius: showDropIndicator ? "12px" : undefined,
        outline: showDropIndicator ? "2px dashed rgba(var(--accent-rgb),0.4)" : "none",
        outlineOffset: "4px", transition: "outline 0.2s",
      }}>
        {/* Empty dump during drag */}
        {dump.photos.length === 0 && dragState.isDragging && (
          <div className="dump-drop-pulse" style={{
            width: "200px", height: "260px", borderRadius: "10px", border: "2px dashed var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--accent)", fontSize: "13px", textAlign: "center", padding: "20px", flexShrink: 0,
            background: "rgba(var(--accent-rgb),0.05)",
          }}>
            Drop here
          </div>
        )}

        {/* Photo cards */}
        {dump.photos.map(function(photo, i) {
          return (
            <div key={photo.id} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              {showDropIndicator && dropIndex === i && (
                <div className="drop-line-pulse" style={{
                  width: "3px", height: "240px", background: "var(--accent)", borderRadius: "2px",
                  marginRight: "6px", boxShadow: "0 0 8px rgba(var(--accent-rgb),0.5)", flexShrink: 0,
                }} />
              )}
              <PhotoCard
                photo={photo} index={i}
                source={{ type: "dump", dumpId: dump.id }}
                isSelected={selectedPhotoId === photo.id}
                onSelect={onSelectPhoto} onDotsClick={onDotsClick} onDoubleTap={onDoubleTapPhoto}
              />
            </div>
          );
        })}

        {/* Drop indicator at end */}
        {showDropIndicator && dropIndex === dump.photos.length && (
          <div className="drop-line-pulse" style={{
            width: "3px", height: "240px", background: "var(--accent)", borderRadius: "2px",
            marginLeft: "6px", boxShadow: "0 0 8px rgba(var(--accent-rgb),0.5)", flexShrink: 0,
          }} />
        )}

        {/* "+" card at end of strip */}
        {!dragState.isDragging && !isOverCapacity && (
          <div data-tour="plus-card" onClick={function() { onPlusClick(dump.id); }}
            style={{
              width: "200px", height: "260px", borderRadius: "10px", border: "2px dashed #2a2a2a",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              color: "#666", fontSize: "13px", textAlign: "center", flexShrink: 0, cursor: "pointer",
              transition: "all 0.2s", background: "rgba(255,255,255,0.02)",
            }}
            onMouseEnter={function(e) { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.background = "rgba(var(--accent-rgb),0.05)"; }}
            onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#666"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
          >
            <Plus size={32} strokeWidth={1.5} />
            <span style={{ marginTop: "8px", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Add Photos</span>
          </div>
        )}
      </div>
    </section>
  );
}

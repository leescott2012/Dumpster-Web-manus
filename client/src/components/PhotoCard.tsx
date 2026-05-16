/*
 * PhotoCard — V4 exact: 200x260px, border-radius 10px, 2px border
 * SAFARI FIX: touchend is the ONLY tap trigger on mobile.
 * The ghost click fired by Safari 300ms after touchend is suppressed via e.preventDefault().
 * Background deselect uses a separate mechanism — it never fires on the card itself.
 * NO template literals, NO HOOK label, NO role field.
 */
import { useRef, useCallback, useState } from "react";
import { useDrag } from "@/contexts/DragContext";
import type { Photo } from "@/lib/photoData";

interface PhotoCardProps {
  photo: Photo;
  index: number;
  source: { type: "dump" | "pool"; dumpId?: string };
  isSelected?: boolean;
  onSelect?: (photo: Photo) => void;
  onDotsClick?: (photo: Photo, position: { x: number; y: number }) => void;
  onDoubleTap?: (photo: Photo) => void;
  isDragOver?: boolean;
  width?: number;
  height?: number;
  selectionMode?: boolean;
  selectionIndex?: number;
}

export default function PhotoCard({
  photo, index, source,
  isSelected = false, onSelect, onDotsClick, onDoubleTap,
  isDragOver = false, width = 200, height = 260,
  selectionMode = false, selectionIndex,
}: PhotoCardProps) {
  var { startDrag, dragState } = useDrag();

  // Touch state refs — never stored in React state to avoid re-render races
  var touchStartPos = useRef<{ x: number; y: number } | null>(null);
  var longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  var longPressTriggered = useRef(false);
  var didMoveEnough = useRef(false);
  var lastTapTime = useRef(0);
  var suppressNextClick = useRef(false);
  var [isPressed, setIsPressed] = useState(false);

  var clearLongPress = function() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  // ── TOUCH HANDLERS (mobile) ──────────────────────────────────────────────

  var handleTouchStart = useCallback(function(e: React.TouchEvent) {
    var touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    longPressTriggered.current = false;
    didMoveEnough.current = false;
    setIsPressed(true);

    var sx = touch.clientX;
    var sy = touch.clientY;

    longPressTimer.current = setTimeout(function() {
      longPressTriggered.current = true;
      startDrag(photo, { type: source.type, dumpId: source.dumpId, index: index }, { x: sx, y: sy });
      if (navigator.vibrate) navigator.vibrate(30);
      setIsPressed(false);
    }, 400);
  }, [photo, source, index, startDrag]);

  var handleTouchMove = useCallback(function(e: React.TouchEvent) {
    if (!touchStartPos.current) return;
    var touch = e.touches[0];
    var dx = Math.abs(touch.clientX - touchStartPos.current.x);
    var dy = Math.abs(touch.clientY - touchStartPos.current.y);
    if (dx > 10 || dy > 10) {
      didMoveEnough.current = true;
      if (!longPressTriggered.current) {
        clearLongPress();
        setIsPressed(false);
      }
    }
  }, []);

  var handleTouchEnd = useCallback(function(e: React.TouchEvent) {
    clearLongPress();
    setIsPressed(false);

    // Always suppress the ghost click Safari fires ~300ms after touchend
    suppressNextClick.current = true;
    setTimeout(function() { suppressNextClick.current = false; }, 600);

    // If drag is active or user moved, do nothing
    if (dragState.isDragging || longPressTriggered.current || didMoveEnough.current) {
      longPressTriggered.current = false;
      didMoveEnough.current = false;
      return;
    }

    // Stop propagation so the background deselect handler never fires on a card tap
    e.stopPropagation();

    var now = Date.now();
    var timeSinceLast = now - lastTapTime.current;

    if (timeSinceLast < 300 && timeSinceLast > 0) {
      // Double tap → lightbox
      lastTapTime.current = 0;
      if (!selectionMode && onDoubleTap) onDoubleTap(photo);
    } else {
      // Single tap → select
      lastTapTime.current = now;
      if (onSelect) onSelect(photo);
    }
  }, [dragState.isDragging, onSelect, onDoubleTap, photo, selectionMode]);

  // ── MOUSE HANDLERS (desktop) ─────────────────────────────────────────────

  var handleMouseDown = useCallback(function(e: React.MouseEvent) {
    if (e.button !== 0) return;
    touchStartPos.current = { x: e.clientX, y: e.clientY };
    longPressTriggered.current = false;
    didMoveEnough.current = false;
    setIsPressed(true);

    var sx = e.clientX;
    var sy = e.clientY;

    longPressTimer.current = setTimeout(function() {
      longPressTriggered.current = true;
      startDrag(photo, { type: source.type, dumpId: source.dumpId, index: index }, { x: sx, y: sy });
      setIsPressed(false);
    }, 400);
  }, [photo, source, index, startDrag]);

  var handleMouseUp = useCallback(function() {
    clearLongPress();
    setIsPressed(false);
  }, []);

  var handleClick = useCallback(function(e: React.MouseEvent) {
    // Suppress ghost clicks from Safari touch events
    if (suppressNextClick.current) { e.stopPropagation(); return; }
    if (dragState.isDragging || longPressTriggered.current) return;
    // Stop propagation so background deselect never fires on a card click
    e.stopPropagation();
    if (onSelect) onSelect(photo);
  }, [dragState.isDragging, onSelect, photo]);

  var handleDoubleClick = useCallback(function(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (dragState.isDragging || selectionMode) return;
    if (onDoubleTap) onDoubleTap(photo);
  }, [dragState.isDragging, onDoubleTap, photo, selectionMode]);

  // ── DOTS BUTTON ──────────────────────────────────────────────────────────

  var handleDotsTouch = useCallback(function(e: React.TouchEvent) {
    e.stopPropagation();
    e.preventDefault();
    var touch = e.changedTouches[0];
    if (onDotsClick) onDotsClick(photo, { x: touch.clientX, y: touch.clientY });
  }, [onDotsClick, photo]);

  var handleDotsClick = useCallback(function(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (onDotsClick) onDotsClick(photo, { x: e.clientX, y: e.clientY });
  }, [onDotsClick, photo]);

  // ── STYLES ───────────────────────────────────────────────────────────────

  var borderColor: string;
  if (selectionMode && isSelected) {
    borderColor = "#22c55e";
  } else if (isSelected) {
    borderColor = "#c8a96e";
  } else if (isDragOver) {
    borderColor = "#c8a96e";
  } else {
    borderColor = "#1e1e1e";
  }

  var cardTransform = isPressed ? "scale(0.97)" : isDragOver ? "scale(1.03)" : "scale(1)";
  var widthPx = width + "px";
  var heightPx = height + "px";
  var borderVal = "2px solid " + borderColor;
  var badgeLabel = (index + 1) < 10 ? "0" + (index + 1) : "" + (index + 1);
  var isBeingDragged = dragState.isDragging && dragState.photo && dragState.photo.id === photo.id;

  return (
    <div
      data-photo-id={photo.id}
      data-source-type={source.type}
      data-source-dump={source.dumpId || ""}
      data-index={index}
      className="relative flex-shrink-0 overflow-hidden select-none"
      style={{
        width: widthPx, borderRadius: "10px", border: borderVal,
        transition: "border-color 0.2s, transform 0.15s, opacity 0.15s",
        transform: cardTransform, scrollSnapAlign: "start",
        opacity: isBeingDragged ? 0.3 : 1,
        WebkitTouchCallout: "none",
        cursor: "pointer",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <img
        src={photo.url} alt={photo.alt} draggable={false} loading="lazy"
        style={{ width: widthPx, height: heightPx, objectFit: "cover", display: "block", pointerEvents: "none" }}
      />

      {/* Slide number badge — top left */}
      <div style={{
        position: "absolute", top: "8px", left: "8px",
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        color: "#fff", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em",
        padding: "3px 8px", borderRadius: "4px", pointerEvents: "none",
      }}>
        {badgeLabel}
      </div>

      {/* Gold star badge — when favorited */}
      {photo.isFavorite && (
        <div style={{
          position: "absolute", top: "32px", left: "8px",
          width: "22px", height: "22px", borderRadius: "50%",
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#c8a96e" stroke="none">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </div>
      )}

      {/* "..." dots button — appears when selected (not in pool selection mode) */}
      {isSelected && !selectionMode && (
        <div
          onTouchEnd={handleDotsTouch}
          onClick={handleDotsClick}
          style={{
            position: "absolute", top: "6px", right: "6px",
            width: "28px", height: "28px", borderRadius: "50%",
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", zIndex: 10,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="4" cy="8" r="1.5" fill="#c8a96e" />
            <circle cx="8" cy="8" r="1.5" fill="#c8a96e" />
            <circle cx="12" cy="8" r="1.5" fill="#c8a96e" />
          </svg>
        </div>
      )}

      {/* Green selection index badge — pool selection mode */}
      {selectionMode && isSelected && selectionIndex !== undefined && (
        <div style={{
          position: "absolute", top: "8px", right: "8px",
          width: "24px", height: "24px", borderRadius: "50%",
          background: "#22c55e", color: "#fff", fontSize: "11px", fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          {selectionIndex + 1}
        </div>
      )}

      {/* Category label — bottom gradient */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
        padding: "24px 10px 8px", fontSize: "9px", fontWeight: 500,
        letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#999",
        pointerEvents: "none",
      }}>
        {photo.category}
      </div>
    </div>
  );
}

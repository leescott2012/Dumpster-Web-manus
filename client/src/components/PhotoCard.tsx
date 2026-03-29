/*
 * PhotoCard — V4 exact: 200x260px, border-radius 10px, 2px border
 * Tap = yellow highlight + dots, Double tap = lightbox, Hold+move = drag
 * Star badge in top-left when favorited. Huji red border.
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
  var longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  var touchStartPos = useRef<{ x: number; y: number } | null>(null);
  var longPressTriggered = useRef(false);
  var didMove = useRef(false);
  var tapCount = useRef(0);
  var tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  var [isPressed, setIsPressed] = useState(false);

  // Border color logic
  var borderColor: string;
  if (selectionMode && isSelected) {
    borderColor = "#22c55e";
  } else if (isSelected) {
    borderColor = "#c8a96e";
  } else if (isDragOver) {
    borderColor = "#c8a96e";
  } else if (photo.isHuji) {
    borderColor = "#e74c3c";
  } else {
    borderColor = "#1e1e1e";
  }

  var cardTransform = isPressed ? "scale(0.97)" : isDragOver ? "scale(1.03)" : "scale(1)";
  var widthPx = width + "px";
  var heightPx = height + "px";
  var borderVal = "2px solid " + borderColor;
  var badgeLabel = (index + 1) < 10 ? "0" + (index + 1) : "" + (index + 1);
  var isBeingDragged = dragState.isDragging && dragState.photo && dragState.photo.id === photo.id;

  var clearLongPress = function() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  var handleTouchStart = useCallback(function(e: React.TouchEvent) {
    if (selectionMode) return;
    var touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    longPressTriggered.current = false;
    didMove.current = false;
    setIsPressed(true);
    var sx = touch.clientX; var sy = touch.clientY;
    longPressTimer.current = setTimeout(function() {
      longPressTriggered.current = true;
      startDrag(photo, { type: source.type, dumpId: source.dumpId, index: index }, { x: sx, y: sy });
      if (navigator.vibrate) navigator.vibrate(30);
    }, 400);
  }, [photo, source, index, startDrag, selectionMode]);

  var handleTouchMove = useCallback(function(e: React.TouchEvent) {
    if (!touchStartPos.current) return;
    var touch = e.touches[0];
    var dx = Math.abs(touch.clientX - touchStartPos.current.x);
    var dy = Math.abs(touch.clientY - touchStartPos.current.y);
    if (dx > 8 || dy > 8) {
      if (!longPressTriggered.current) { clearLongPress(); setIsPressed(false); }
      else { didMove.current = true; }
    }
  }, []);

  var handleTouchEnd = useCallback(function(_e: React.TouchEvent) {
    clearLongPress();
    setIsPressed(false);
    if (dragState.isDragging) return;
    if (longPressTriggered.current) { longPressTriggered.current = false; didMove.current = false; return; }
    if (selectionMode) { if (onSelect) onSelect(photo); return; }
    tapCount.current++;
    if (tapCount.current === 1) {
      tapTimer.current = setTimeout(function() {
        if (tapCount.current === 1 && onSelect) onSelect(photo);
        tapCount.current = 0;
      }, 280);
    } else if (tapCount.current >= 2) {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      tapCount.current = 0;
      if (onDoubleTap) onDoubleTap(photo);
    }
  }, [dragState.isDragging, onSelect, onDoubleTap, photo, selectionMode]);

  var handleMouseDown = useCallback(function(e: React.MouseEvent) {
    if (e.button !== 0 || selectionMode) return;
    touchStartPos.current = { x: e.clientX, y: e.clientY };
    longPressTriggered.current = false; didMove.current = false; setIsPressed(true);
    var sx = e.clientX; var sy = e.clientY;
    longPressTimer.current = setTimeout(function() {
      longPressTriggered.current = true;
      startDrag(photo, { type: source.type, dumpId: source.dumpId, index: index }, { x: sx, y: sy });
    }, 400);
  }, [photo, source, index, startDrag, selectionMode]);

  var handleMouseMove = useCallback(function(e: React.MouseEvent) {
    if (!touchStartPos.current) return;
    var dx = Math.abs(e.clientX - touchStartPos.current.x);
    var dy = Math.abs(e.clientY - touchStartPos.current.y);
    if (dx > 8 || dy > 8) {
      if (!longPressTriggered.current) { clearLongPress(); setIsPressed(false); }
      else { didMove.current = true; }
    }
  }, []);

  var handleMouseUp = useCallback(function() { clearLongPress(); setIsPressed(false); }, []);

  var handleClick = useCallback(function() {
    if (dragState.isDragging || longPressTriggered.current) return;
    if (selectionMode) { if (onSelect) onSelect(photo); return; }
    if (onSelect) onSelect(photo);
  }, [dragState.isDragging, onSelect, photo, selectionMode]);

  var handleDoubleClick = useCallback(function(e: React.MouseEvent) {
    e.preventDefault();
    if (dragState.isDragging || selectionMode) return;
    if (onDoubleTap) onDoubleTap(photo);
  }, [dragState.isDragging, onDoubleTap, photo, selectionMode]);

  var handleDotsClick = useCallback(function(e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation(); e.preventDefault();
    var cx: number; var cy: number;
    if ("touches" in e) { cx = (e as React.TouchEvent).changedTouches[0].clientX; cy = (e as React.TouchEvent).changedTouches[0].clientY; }
    else { cx = (e as React.MouseEvent).clientX; cy = (e as React.MouseEvent).clientY; }
    if (onDotsClick) onDotsClick(photo, { x: cx, y: cy });
  }, [onDotsClick, photo]);

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
      }}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
      onClick={handleClick} onDoubleClick={handleDoubleClick}
    >
      <img src={photo.url} alt={photo.alt} draggable={false} loading="lazy"
        style={{ width: widthPx, height: heightPx, objectFit: "cover", display: "block", pointerEvents: "none" }}
      />

      {/* Slide number badge — top left */}
      <div style={{
        position: "absolute", top: "8px", left: "8px",
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        color: "#fff", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em",
        padding: "3px 8px", borderRadius: "4px",
      }}>
        {badgeLabel}
      </div>

      {/* Gold star badge — top left below number, when favorited */}
      {photo.isFavorite && (
        <div style={{
          position: "absolute", top: "32px", left: "8px",
          width: "22px", height: "22px", borderRadius: "50%",
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#c8a96e" stroke="none">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </div>
      )}

      {/* Huji badge — top right (when NOT selected and not in selection mode) */}
      {photo.isHuji && !isSelected && !selectionMode && (
        <div style={{
          position: "absolute", top: "8px", right: "8px",
          background: "#e74c3c", color: "#fff", fontSize: "8px", fontWeight: 700,
          letterSpacing: "0.1em", padding: "2px 6px", borderRadius: "4px",
        }}>
          HUJI
        </div>
      )}

      {/* "..." dots button — appears when selected (not in pool selection mode) */}
      {isSelected && !selectionMode && (
        <div onClick={handleDotsClick} onTouchEnd={handleDotsClick}
          style={{
            position: "absolute", top: "6px", right: "6px",
            width: "28px", height: "28px", borderRadius: "50%",
            background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", zIndex: 10,
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
      }}>
        {photo.category}
      </div>
    </div>
  );
}

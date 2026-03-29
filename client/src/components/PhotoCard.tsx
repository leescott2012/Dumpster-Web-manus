/*
 * PhotoCard — V4 exact: 200x260px, border-radius 10px, 2px border
 * First card gets gold border (#c8a96e), Huji gets red (#e74c3c)
 *
 * Interaction model:
 * - Tap         -> yellow highlight + "..." dots icon (onSelect)
 * - Double tap  -> lightbox (onDoubleTap)
 * - Long press + move -> drag to rearrange
 * - "..." dots  -> opens menu (handled by parent via onDotsClick)
 *
 * NO template literals — plain string concat for Safari compatibility
 */
import { useRef, useCallback, useState } from "react";
import { useDrag } from "@/contexts/DragContext";
import type { Photo } from "@/lib/photoData";

interface PhotoCardProps {
  photo: Photo;
  index: number;
  isFirst?: boolean;
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
  photo,
  index,
  isFirst = false,
  source,
  isSelected = false,
  onSelect,
  onDotsClick,
  onDoubleTap,
  isDragOver = false,
  width = 200,
  height = 260,
  selectionMode = false,
  selectionIndex,
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
    borderColor = "#22c55e"; // green for pool selection mode
  } else if (isSelected) {
    borderColor = "#c8a96e"; // yellow/gold for tap-selected in dump
  } else if (isDragOver) {
    borderColor = "#c8a96e";
  } else if (isFirst && source.type === "dump") {
    borderColor = "#c8a96e";
  } else if (photo.isHuji) {
    borderColor = "#e74c3c";
  } else {
    borderColor = "#1e1e1e";
  }

  var cardTransform: string;
  if (isPressed) {
    cardTransform = "scale(0.97)";
  } else if (isDragOver) {
    cardTransform = "scale(1.03)";
  } else {
    cardTransform = "scale(1)";
  }

  var widthPx = width + "px";
  var heightPx = height + "px";
  var borderVal = "2px solid " + borderColor;

  var badgeLabel: string;
  if (isFirst && source.type === "dump") {
    badgeLabel = "HOOK";
  } else {
    var n = index + 1;
    badgeLabel = n < 10 ? "0" + n : "" + n;
  }

  var isBeingDragged = dragState.isDragging && dragState.photo && dragState.photo.id === photo.id;

  var clearLongPress = function() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // ── Touch events (mobile) ──
  var handleTouchStart = useCallback(
    function(e: React.TouchEvent) {
      if (selectionMode) return; // in selection mode, just use tap
      var touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      longPressTriggered.current = false;
      didMove.current = false;
      setIsPressed(true);

      var startX = touch.clientX;
      var startY = touch.clientY;

      longPressTimer.current = setTimeout(function() {
        longPressTriggered.current = true;
        startDrag(photo, { type: source.type, dumpId: source.dumpId, index: index }, {
          x: startX,
          y: startY,
        });
        if (navigator.vibrate) navigator.vibrate(30);
      }, 400);
    },
    [photo, source, index, startDrag, selectionMode]
  );

  var handleTouchMove = useCallback(
    function(_e: React.TouchEvent) {
      if (!touchStartPos.current) return;
      var touch = _e.touches[0];
      var dx = Math.abs(touch.clientX - touchStartPos.current.x);
      var dy = Math.abs(touch.clientY - touchStartPos.current.y);

      if (dx > 8 || dy > 8) {
        if (!longPressTriggered.current) {
          clearLongPress();
          setIsPressed(false);
        } else {
          didMove.current = true;
        }
      }
    },
    []
  );

  var handleTouchEnd = useCallback(
    function(_e: React.TouchEvent) {
      clearLongPress();
      setIsPressed(false);

      if (dragState.isDragging) return;
      if (longPressTriggered.current) {
        longPressTriggered.current = false;
        didMove.current = false;
        return; // long press ended — don't fire tap
      }

      // In selection mode, single tap = select/deselect
      if (selectionMode) {
        if (onSelect) onSelect(photo);
        return;
      }

      // Double tap detection for lightbox
      tapCount.current++;
      if (tapCount.current === 1) {
        tapTimer.current = setTimeout(function() {
          if (tapCount.current === 1) {
            // Single tap: select this photo (yellow highlight + dots)
            if (onSelect) onSelect(photo);
          }
          tapCount.current = 0;
        }, 280);
      } else if (tapCount.current >= 2) {
        if (tapTimer.current) clearTimeout(tapTimer.current);
        tapCount.current = 0;
        if (onDoubleTap) onDoubleTap(photo);
      }
    },
    [dragState.isDragging, onSelect, onDoubleTap, photo, selectionMode]
  );

  // ── Mouse events (desktop) ──
  var handleMouseDown = useCallback(
    function(e: React.MouseEvent) {
      if (e.button !== 0 || selectionMode) return;
      touchStartPos.current = { x: e.clientX, y: e.clientY };
      longPressTriggered.current = false;
      didMove.current = false;
      setIsPressed(true);

      var startX = e.clientX;
      var startY = e.clientY;

      longPressTimer.current = setTimeout(function() {
        longPressTriggered.current = true;
        startDrag(photo, { type: source.type, dumpId: source.dumpId, index: index }, {
          x: startX,
          y: startY,
        });
      }, 400);
    },
    [photo, source, index, startDrag, selectionMode]
  );

  var handleMouseMove = useCallback(
    function(e: React.MouseEvent) {
      if (!touchStartPos.current) return;
      var dx = Math.abs(e.clientX - touchStartPos.current.x);
      var dy = Math.abs(e.clientY - touchStartPos.current.y);
      if (dx > 8 || dy > 8) {
        if (!longPressTriggered.current) {
          clearLongPress();
          setIsPressed(false);
        } else {
          didMove.current = true;
        }
      }
    },
    []
  );

  var handleMouseUp = useCallback(
    function(_e: React.MouseEvent) {
      clearLongPress();
      setIsPressed(false);
    },
    []
  );

  var handleClick = useCallback(
    function(_e: React.MouseEvent) {
      if (dragState.isDragging) return;
      if (longPressTriggered.current) return;
      if (selectionMode) {
        if (onSelect) onSelect(photo);
        return;
      }
      // Desktop single click = select
      if (onSelect) onSelect(photo);
    },
    [dragState.isDragging, onSelect, photo, selectionMode]
  );

  var handleDoubleClick = useCallback(
    function(e: React.MouseEvent) {
      e.preventDefault();
      if (dragState.isDragging) return;
      if (selectionMode) return;
      if (onDoubleTap) onDoubleTap(photo);
    },
    [dragState.isDragging, onDoubleTap, photo, selectionMode]
  );

  var handleDotsClick = useCallback(
    function(e: React.MouseEvent | React.TouchEvent) {
      e.stopPropagation();
      e.preventDefault();
      var clientX: number;
      var clientY: number;
      if ("touches" in e) {
        clientX = (e as React.TouchEvent).changedTouches[0].clientX;
        clientY = (e as React.TouchEvent).changedTouches[0].clientY;
      } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
      }
      if (onDotsClick) onDotsClick(photo, { x: clientX, y: clientY });
    },
    [onDotsClick, photo]
  );

  return (
    <div
      data-photo-id={photo.id}
      data-source-type={source.type}
      data-source-dump={source.dumpId || ""}
      data-index={index}
      className="relative flex-shrink-0 overflow-hidden select-none"
      style={{
        width: widthPx,
        borderRadius: "10px",
        border: borderVal,
        transition: "border-color 0.2s, transform 0.15s, opacity 0.15s",
        transform: cardTransform,
        scrollSnapAlign: "start",
        opacity: isBeingDragged ? 0.3 : 1,
        WebkitTouchCallout: "none",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <img
        src={photo.url}
        alt={photo.alt}
        draggable={false}
        loading="lazy"
        style={{
          width: widthPx,
          height: heightPx,
          objectFit: "cover",
          display: "block",
          pointerEvents: "none",
        }}
      />

      {/* Slide number badge — top left */}
      <div
        style={{
          position: "absolute",
          top: "8px",
          left: "8px",
          background: (isFirst && source.type === "dump") ? "#c8a96e" : "rgba(0,0,0,0.75)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          color: (isFirst && source.type === "dump") ? "#000" : "#fff",
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          padding: "3px 8px",
          borderRadius: "4px",
          textTransform: "uppercase" as const,
        }}
      >
        {badgeLabel}
      </div>

      {/* Huji badge — top right (only when NOT selected, or always show) */}
      {photo.isHuji && !isSelected && (
        <div
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            background: "#e74c3c",
            color: "#fff",
            fontSize: "8px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            padding: "2px 6px",
            borderRadius: "3px",
            textTransform: "uppercase" as const,
          }}
        >
          HUJI
        </div>
      )}

      {/* "..." dots button — appears when selected (not in pool selection mode) */}
      {isSelected && !selectionMode && (
        <div
          onClick={handleDotsClick}
          onTouchEnd={handleDotsClick}
          style={{
            position: "absolute",
            top: "6px",
            right: "6px",
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 10,
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
        <div
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: "#22c55e",
            color: "#fff",
            fontSize: "11px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selectionIndex + 1}
        </div>
      )}

      {/* Role label — bottom gradient */}
      {photo.role && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
            padding: "24px 10px 8px",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase" as const,
            color: "#c8a96e",
          }}
        >
          {photo.role}
        </div>
      )}

      {/* Category label for pool photos */}
      {!photo.role && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
            padding: "24px 10px 8px",
            fontSize: "9px",
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
            color: "#999",
          }}
        >
          {photo.category}
        </div>
      )}
    </div>
  );
}

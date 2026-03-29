/*
 * PhotoCard — V4 exact: 200×260px, border-radius 10px, 2px border
 * First card gets gold border (#c8a96e), Huji gets red (#e74c3c)
 * Badge top-left "HOOK" for first in dump, role label bottom gradient overlay
 *
 * Interactions:
 * - Single tap/click → lightbox
 * - Double tap/click → context menu
 * - Long press (400ms) → start drag
 * - Right-click → context menu
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
  onTap?: (photo: Photo) => void;
  onDoubleTap?: (photo: Photo) => void;
  isDragOver?: boolean;
  width?: number;
  height?: number;
}

export default function PhotoCard({
  photo,
  index,
  isFirst = false,
  source,
  onTap,
  onDoubleTap,
  isDragOver = false,
  width = 200,
  height = 260,
}: PhotoCardProps) {
  const { startDrag, dragState } = useDrag();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const didDrag = useRef(false);
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPressed, setIsPressed] = useState(false);

  var borderColor: string;
  if (isDragOver) {
    borderColor = "#c8a96e";
  } else if (isFirst) {
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

  const clearLongPress = function() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // ── Touch events (mobile) ──
  const handleTouchStart = useCallback(
    function(e: React.TouchEvent) {
      var touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      didDrag.current = false;
      setIsPressed(true);

      var touchX = touch.clientX;
      var touchY = touch.clientY;

      longPressTimer.current = setTimeout(function() {
        didDrag.current = true;
        startDrag(photo, { type: source.type, dumpId: source.dumpId, index: index }, {
          x: touchX,
          y: touchY,
        });
        if (navigator.vibrate) navigator.vibrate(30);
      }, 400);
    },
    [photo, source, index, startDrag]
  );

  const handleTouchMove = useCallback(
    function(e: React.TouchEvent) {
      if (!touchStartPos.current) return;
      var touch = e.touches[0];
      var dx = Math.abs(touch.clientX - touchStartPos.current.x);
      var dy = Math.abs(touch.clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) {
        clearLongPress();
        setIsPressed(false);
      }
    },
    []
  );

  const handleTouchEnd = useCallback(
    function(e: React.TouchEvent) {
      clearLongPress();
      setIsPressed(false);

      if (didDrag.current || dragState.isDragging) return;

      // Double tap = lightbox, single tap = nothing
      tapCount.current++;
      if (tapCount.current === 1) {
        tapTimer.current = setTimeout(function() {
          // single tap: do nothing
          tapCount.current = 0;
        }, 280);
      } else if (tapCount.current >= 2) {
        if (tapTimer.current) clearTimeout(tapTimer.current);
        tapCount.current = 0;
        if (onTap) onTap(photo);
      }
    },
    [dragState.isDragging, onTap, onDoubleTap, photo]
  );

  // ── Mouse events (desktop) ──
  const handleMouseDown = useCallback(
    function(e: React.MouseEvent) {
      if (e.button !== 0) return;
      touchStartPos.current = { x: e.clientX, y: e.clientY };
      didDrag.current = false;
      setIsPressed(true);

      var mouseX = e.clientX;
      var mouseY = e.clientY;

      longPressTimer.current = setTimeout(function() {
        didDrag.current = true;
        startDrag(photo, { type: source.type, dumpId: source.dumpId, index: index }, {
          x: mouseX,
          y: mouseY,
        });
      }, 400);
    },
    [photo, source, index, startDrag]
  );

  const handleMouseUp = useCallback(function() {
    clearLongPress();
    setIsPressed(false);
  }, []);

  const handleClick = useCallback(
    function(e: React.MouseEvent) {
      // single click does nothing — double click opens lightbox
    },
    []
  );

  const handleDoubleClick = useCallback(
    function(e: React.MouseEvent) {
      e.preventDefault();
      if (didDrag.current || dragState.isDragging) return;
      if (onTap) onTap(photo);
    },
    [dragState.isDragging, onTap, photo]
  );

  const handleContextMenu = useCallback(
    function(e: React.MouseEvent) {
      e.preventDefault();
      if (onDoubleTap) onDoubleTap(photo);
    },
    [onDoubleTap, photo]
  );

  var isBeingDragged = dragState.isDragging && dragState.photo && dragState.photo.id === photo.id;

  var badgeLabel: string;
  if (isFirst && source.type === "dump") {
    badgeLabel = "HOOK";
  } else {
    var n = index + 1;
    badgeLabel = n < 10 ? "0" + n : "" + n;
  }

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
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
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
          background: isFirst ? "#c8a96e" : "rgba(0,0,0,0.75)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          color: isFirst ? "#000" : "#fff",
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

      {/* Huji badge — top right */}
      {photo.isHuji && (
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

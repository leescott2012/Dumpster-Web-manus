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

  const getBorderColor = () => {
    if (isDragOver) return "#c8a96e";
    if (isFirst) return "#c8a96e";
    if (photo.isHuji) return "#e74c3c";
    return "#1e1e1e";
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // ── Touch events (mobile) ──
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      didDrag.current = false;
      setIsPressed(true);

      longPressTimer.current = setTimeout(() => {
        didDrag.current = true;
        startDrag(photo, { ...source, index }, {
          x: touch.clientX,
          y: touch.clientY,
        });
        if (navigator.vibrate) navigator.vibrate(30);
      }, 400);
    },
    [photo, source, index, startDrag]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartPos.current) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) {
        clearLongPress();
        setIsPressed(false);
      }
    },
    []
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      clearLongPress();
      setIsPressed(false);

      if (didDrag.current || dragState.isDragging) return;

      // Tap detection with double-tap support
      tapCount.current++;
      if (tapCount.current === 1) {
        tapTimer.current = setTimeout(() => {
          if (tapCount.current === 1) {
            onTap?.(photo);
          }
          tapCount.current = 0;
        }, 250);
      } else if (tapCount.current >= 2) {
        if (tapTimer.current) clearTimeout(tapTimer.current);
        tapCount.current = 0;
        onDoubleTap?.(photo);
      }
    },
    [dragState.isDragging, onTap, onDoubleTap, photo]
  );

  // ── Mouse events (desktop) ──
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // only left click
      touchStartPos.current = { x: e.clientX, y: e.clientY };
      didDrag.current = false;
      setIsPressed(true);

      longPressTimer.current = setTimeout(() => {
        didDrag.current = true;
        startDrag(photo, { ...source, index }, {
          x: e.clientX,
          y: e.clientY,
        });
      }, 400);
    },
    [photo, source, index, startDrag]
  );

  const handleMouseUp = useCallback(() => {
    clearLongPress();
    setIsPressed(false);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (didDrag.current || dragState.isDragging) return;
      onTap?.(photo);
    },
    [dragState.isDragging, onTap, photo]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onDoubleTap?.(photo);
    },
    [onDoubleTap, photo]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onDoubleTap?.(photo);
    },
    [onDoubleTap, photo]
  );

  const isBeingDragged = dragState.isDragging && dragState.photo?.id === photo.id;

  return (
    <div
      data-photo-id={photo.id}
      data-source-type={source.type}
      data-source-dump={source.dumpId || ""}
      data-index={index}
      className="relative flex-shrink-0 overflow-hidden select-none"
      style={{
        width: `${width}px`,
        borderRadius: "10px",
        border: `2px solid ${getBorderColor()}`,
        transition: "border-color 0.2s, transform 0.15s, opacity 0.15s",
        transform: isPressed ? "scale(0.97)" : isDragOver ? "scale(1.03)" : "scale(1)",
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
          width: `${width}px`,
          height: `${height}px`,
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
          color: isFirst ? "#000" : "#fff",
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          padding: "3px 8px",
          borderRadius: "4px",
          textTransform: "uppercase" as const,
        }}
      >
        {isFirst && source.type === "dump" ? "HOOK" : String(index + 1).padStart(2, "0")}
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

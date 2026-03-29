/*
 * DumpStrip — V4 exact: horizontal scroll-snap strip with 12px gap
 * Dump header with number, title, subtitle
 * Drop zone for receiving dragged photos
 * Shows gold insertion line between cards during drag
 */
import { useRef, useState, useEffect, useCallback } from "react";
import PhotoCard from "./PhotoCard";
import { useDrag } from "@/contexts/DragContext";
import type { Dump, Photo } from "@/lib/photoData";
import { Trash2 } from "lucide-react";

interface DumpStripProps {
  dump: Dump;
  onTapPhoto: (photo: Photo) => void;
  onDoubleTapPhoto: (photo: Photo) => void;
  onDropPhoto: (dumpId: string, insertIndex: number) => void;
  onDeleteDump?: (dumpId: string) => void;
  onRenameDump?: (dumpId: string, title: string) => void;
  isCustom?: boolean;
}

export default function DumpStrip({
  dump,
  onTapPhoto,
  onDoubleTapPhoto,
  onDropPhoto,
  onDeleteDump,
  onRenameDump,
  isCustom = false,
}: DumpStripProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const { dragState } = useDrag();
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(dump.title);
  const dropIndexRef = useRef<number | null>(null);

  // Keep ref in sync
  useEffect(() => {
    dropIndexRef.current = dropIndex;
  }, [dropIndex]);

  // Track drop position during drag
  useEffect(() => {
    if (!dragState.isDragging) {
      setDropIndex(null);
      return;
    }

    const handleMove = (e: TouchEvent | MouseEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      if (!stripRef.current) return;
      const rect = stripRef.current.getBoundingClientRect();

      // Check if cursor is over this strip (with some vertical tolerance)
      if (
        clientY >= rect.top - 40 &&
        clientY <= rect.bottom + 40 &&
        clientX >= rect.left - 20 &&
        clientX <= rect.right + 20
      ) {
        const cards = stripRef.current.querySelectorAll("[data-photo-id]");
        let insertIdx = dump.photos.length;

        for (let i = 0; i < cards.length; i++) {
          const cardRect = cards[i].getBoundingClientRect();
          const midX = cardRect.left + cardRect.width / 2;
          if (clientX < midX) {
            insertIdx = i;
            break;
          }
        }

        // Don't allow dropping on self at same position
        if (
          dragState.source?.type === "dump" &&
          dragState.source.dumpId === dump.id
        ) {
          const srcIdx = dragState.source.index;
          if (insertIdx === srcIdx || insertIdx === srcIdx + 1) {
            setDropIndex(null);
            return;
          }
        }

        setDropIndex(insertIdx);
      } else {
        setDropIndex(null);
      }
    };

    const handleEnd = () => {
      if (dropIndexRef.current !== null) {
        onDropPhoto(dump.id, dropIndexRef.current);
      }
    };

    window.addEventListener("touchmove", handleMove, { passive: true });
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("touchend", handleEnd);
    window.addEventListener("mouseup", handleEnd);

    return () => {
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("mouseup", handleEnd);
    };
  }, [dragState.isDragging, dragState.source, dump.id, dump.photos.length, onDropPhoto]);

  const handleTitleSubmit = () => {
    setIsEditing(false);
    if (editTitle.trim() && editTitle !== dump.title) {
      onRenameDump?.(dump.id, editTitle.trim());
    } else {
      setEditTitle(dump.title);
    }
  };

  const isOverCapacity = dump.photos.length >= 7;
  const showDropIndicator = dropIndex !== null && !isOverCapacity;

  return (
    <section
      style={{
        maxWidth: "1100px",
        margin: "56px auto",
        padding: "0 32px",
      }}
    >
      {/* Dump Header — V4 exact */}
      <div
        style={{
          marginBottom: "32px",
          paddingBottom: "24px",
          borderBottom: "1px solid #1e1e1e",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.25em",
              textTransform: "uppercase" as const,
              color: "#c8a96e",
              marginBottom: "8px",
            }}
          >
            DUMP {String(dump.number).padStart(2, "0")}
          </div>
          {isEditing ? (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSubmit()}
              autoFocus
              style={{
                fontSize: "clamp(24px, 3vw, 36px)",
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-0.02em",
                background: "transparent",
                border: "1px solid #c8a96e",
                borderRadius: "4px",
                padding: "2px 8px",
                outline: "none",
                width: "100%",
                maxWidth: "400px",
                fontFamily: "inherit",
              }}
            />
          ) : (
            <h2
              style={{
                fontSize: "clamp(24px, 3vw, 36px)",
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-0.02em",
                marginBottom: "4px",
                cursor: isCustom ? "pointer" : "default",
              }}
              onClick={() => isCustom && setIsEditing(true)}
            >
              {dump.title}
            </h2>
          )}
          <div
            style={{
              fontSize: "14px",
              color: "#666",
              fontStyle: "italic",
            }}
          >
            {dump.subtitle}
            {dump.photos.length > 0 && (
              <span style={{ marginLeft: "12px", color: "#999", fontStyle: "normal", fontSize: "12px" }}>
                {dump.photos.length}/7 photos
              </span>
            )}
          </div>
        </div>
        {isCustom && onDeleteDump && (
          <button
            onClick={() => onDeleteDump(dump.id)}
            style={{
              background: "transparent",
              border: "1px solid #2a2a2a",
              borderRadius: "6px",
              padding: "6px 10px",
              color: "#666",
              cursor: "pointer",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#e74c3c";
              e.currentTarget.style.color = "#e74c3c";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#2a2a2a";
              e.currentTarget.style.color = "#666";
            }}
          >
            <Trash2 size={12} />
            Delete
          </button>
        )}
      </div>

      {/* Slide Strip — V4 exact */}
      <div
        ref={stripRef}
        style={{
          display: "flex",
          gap: "12px",
          overflowX: dragState.isDragging ? "hidden" : "auto",
          paddingBottom: "16px",
          marginBottom: "32px",
          scrollSnapType: dragState.isDragging ? "none" : "x mandatory",
          WebkitOverflowScrolling: "touch",
          minHeight: "264px",
          alignItems: "center",
          position: "relative",
          borderRadius: showDropIndicator ? "12px" : undefined,
          outline: showDropIndicator ? "2px dashed rgba(200,169,110,0.4)" : "none",
          outlineOffset: "4px",
          transition: "outline 0.2s",
        }}
      >
        {dump.photos.length === 0 && !dragState.isDragging && (
          <div
            style={{
              width: "200px",
              height: "260px",
              borderRadius: "10px",
              border: "2px dashed #2a2a2a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#666",
              fontSize: "13px",
              textAlign: "center",
              padding: "20px",
              flexShrink: 0,
            }}
          >
            Drag photos here
          </div>
        )}

        {dump.photos.length === 0 && dragState.isDragging && (
          <div
            style={{
              width: "200px",
              height: "260px",
              borderRadius: "10px",
              border: "2px dashed #c8a96e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#c8a96e",
              fontSize: "13px",
              textAlign: "center",
              padding: "20px",
              flexShrink: 0,
              background: "rgba(200,169,110,0.05)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          >
            Drop here
          </div>
        )}

        {dump.photos.map((photo, i) => (
          <div key={photo.id} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            {/* Drop insertion line before this card */}
            {showDropIndicator && dropIndex === i && (
              <div
                style={{
                  width: "3px",
                  height: "240px",
                  background: "#c8a96e",
                  borderRadius: "2px",
                  marginRight: "6px",
                  boxShadow: "0 0 8px rgba(200,169,110,0.5)",
                  animation: "pulse 1s ease-in-out infinite",
                  flexShrink: 0,
                }}
              />
            )}
            <PhotoCard
              photo={photo}
              index={i}
              isFirst={i === 0}
              source={{ type: "dump", dumpId: dump.id }}
              onTap={onTapPhoto}
              onDoubleTap={onDoubleTapPhoto}
            />
          </div>
        ))}

        {/* Drop insertion line at the end */}
        {showDropIndicator && dropIndex === dump.photos.length && (
          <div
            style={{
              width: "3px",
              height: "240px",
              background: "#c8a96e",
              borderRadius: "2px",
              marginLeft: "6px",
              boxShadow: "0 0 8px rgba(200,169,110,0.5)",
              animation: "pulse 1s ease-in-out infinite",
              flexShrink: 0,
            }}
          />
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </section>
  );
}

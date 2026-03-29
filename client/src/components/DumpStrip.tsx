/*
 * DumpStrip — V4 exact: horizontal scroll-snap strip with 12px gap
 * Dump header with number, title, subtitle
 * Drop zone for receiving dragged photos
 * "+" card at end of every strip for pool selection flow
 * NO template literals — plain string concat for Safari compatibility
 */
import { useRef, useState, useEffect } from "react";
import PhotoCard from "./PhotoCard";
import { useDrag } from "@/contexts/DragContext";
import type { Dump, Photo } from "@/lib/photoData";
import { Trash2, Plus } from "lucide-react";

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
  isCustom?: boolean;
}

export default function DumpStrip({
  dump,
  selectedPhotoId,
  onSelectPhoto,
  onDotsClick,
  onDoubleTapPhoto,
  onDropPhoto,
  onDeleteDump,
  onRenameDump,
  onPlusClick,
  isCustom = false,
}: DumpStripProps) {
  var stripRef = useRef<HTMLDivElement>(null);
  var { dragState } = useDrag();
  var [dropIndex, setDropIndex] = useState<number | null>(null);
  var [isEditing, setIsEditing] = useState(false);
  var [editTitle, setEditTitle] = useState(dump.title);
  var dropIndexRef = useRef<number | null>(null);

  useEffect(function() {
    dropIndexRef.current = dropIndex;
  }, [dropIndex]);

  // Track drop position during drag
  useEffect(function() {
    if (!dragState.isDragging) {
      setDropIndex(null);
      return;
    }

    var dumpId = dump.id;
    var dumpPhotosLen = dump.photos.length;

    var handleMove = function(e: TouchEvent | MouseEvent) {
      var clientX: number;
      var clientY: number;
      if ("touches" in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }

      if (!stripRef.current) return;
      var rect = stripRef.current.getBoundingClientRect();

      if (
        clientY >= rect.top - 40 &&
        clientY <= rect.bottom + 40 &&
        clientX >= rect.left - 20 &&
        clientX <= rect.right + 20
      ) {
        var cards = stripRef.current.querySelectorAll("[data-photo-id]");
        var insertIdx = dumpPhotosLen;

        for (var i = 0; i < cards.length; i++) {
          var cardRect = cards[i].getBoundingClientRect();
          var midX = cardRect.left + cardRect.width / 2;
          if (clientX < midX) {
            insertIdx = i;
            break;
          }
        }

        if (
          dragState.source &&
          dragState.source.type === "dump" &&
          dragState.source.dumpId === dumpId
        ) {
          var srcIdx = dragState.source.index;
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

    var handleEnd = function() {
      if (dropIndexRef.current !== null) {
        onDropPhoto(dumpId, dropIndexRef.current);
      }
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
    } else {
      setEditTitle(dump.title);
    }
  };

  var isOverCapacity = dump.photos.length >= 7;
  var showDropIndicator = dropIndex !== null && !isOverCapacity;

  var dumpNumStr = dump.number < 10 ? "0" + dump.number : "" + dump.number;

  return (
    <section
      data-dump-id={dump.id}
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
            {"DUMP " + dumpNumStr}
          </div>
          {isEditing ? (
            <input
              value={editTitle}
              onChange={function(e) { setEditTitle(e.target.value); }}
              onBlur={handleTitleSubmit}
              onKeyDown={function(e) { if (e.key === "Enter") handleTitleSubmit(); }}
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
              onClick={function() { if (isCustom) setIsEditing(true); }}
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
                {dump.photos.length + "/7 photos"}
              </span>
            )}
          </div>
        </div>
        {isCustom && onDeleteDump && (
          <button
            onClick={function() { if (onDeleteDump) onDeleteDump(dump.id); }}
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
            onMouseEnter={function(e) {
              e.currentTarget.style.borderColor = "#e74c3c";
              e.currentTarget.style.color = "#e74c3c";
            }}
            onMouseLeave={function(e) {
              e.currentTarget.style.borderColor = "#2a2a2a";
              e.currentTarget.style.color = "#666";
            }}
          >
            <Trash2 size={12} />
            Delete
          </button>
        )}
      </div>

      {/* Slide Strip */}
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
        {/* Empty dump during drag */}
        {dump.photos.length === 0 && dragState.isDragging && (
          <div
            className="dump-drop-pulse"
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
            }}
          >
            Drop here
          </div>
        )}

        {/* Photo cards */}
        {dump.photos.map(function(photo, i) {
          return (
            <div key={photo.id} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              {showDropIndicator && dropIndex === i && (
                <div
                  className="drop-line-pulse"
                  style={{
                    width: "3px",
                    height: "240px",
                    background: "#c8a96e",
                    borderRadius: "2px",
                    marginRight: "6px",
                    boxShadow: "0 0 8px rgba(200,169,110,0.5)",
                    flexShrink: 0,
                  }}
                />
              )}
              <PhotoCard
                photo={photo}
                index={i}
                isFirst={i === 0}
                source={{ type: "dump", dumpId: dump.id }}
                isSelected={selectedPhotoId === photo.id}
                onSelect={onSelectPhoto}
                onDotsClick={onDotsClick}
                onDoubleTap={onDoubleTapPhoto}
              />
            </div>
          );
        })}

        {/* Drop indicator at end */}
        {showDropIndicator && dropIndex === dump.photos.length && (
          <div
            className="drop-line-pulse"
            style={{
              width: "3px",
              height: "240px",
              background: "#c8a96e",
              borderRadius: "2px",
              marginLeft: "6px",
              boxShadow: "0 0 8px rgba(200,169,110,0.5)",
              flexShrink: 0,
            }}
          />
        )}

        {/* "+" card at end of strip */}
        {!dragState.isDragging && !isOverCapacity && (
          <div
            onClick={function() { onPlusClick(dump.id); }}
            style={{
              width: "200px",
              height: "260px",
              borderRadius: "10px",
              border: "2px dashed #2a2a2a",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#666",
              fontSize: "13px",
              textAlign: "center",
              flexShrink: 0,
              cursor: "pointer",
              transition: "all 0.2s",
              background: "rgba(255,255,255,0.02)",
            }}
            onMouseEnter={function(e) {
              e.currentTarget.style.borderColor = "#c8a96e";
              e.currentTarget.style.color = "#c8a96e";
              e.currentTarget.style.background = "rgba(200,169,110,0.05)";
            }}
            onMouseLeave={function(e) {
              e.currentTarget.style.borderColor = "#2a2a2a";
              e.currentTarget.style.color = "#666";
              e.currentTarget.style.background = "rgba(255,255,255,0.02)";
            }}
          >
            <Plus size={32} strokeWidth={1.5} />
            <span style={{ marginTop: "8px", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
              Add Photos
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

/*
 * PhotoPool — Bottom section showing unused photos
 * Grid layout, same card styling, Huji red outlines
 * Drop zone for returning photos from dumps
 * Selection mode: green outlines, multi-select, confirm button
 */
import { useRef, useEffect, useState } from "react";
import PhotoCard from "./PhotoCard";
import { useDrag } from "@/contexts/DragContext";
import type { Photo } from "@/lib/photoData";

interface PhotoPoolProps {
  photos: Photo[];
  onDoubleTapPhoto: (photo: Photo) => void;
  onDropToPool: () => void;
  selectionMode: boolean;
  selectedIds: string[];
  onTogglePoolSelection: (photo: Photo) => void;
  onConfirmSelection: () => void;
  onCancelSelection: () => void;
  targetDumpId: string | null;
}

export default function PhotoPool({
  photos,
  onDoubleTapPhoto,
  onDropToPool,
  selectionMode,
  selectedIds,
  onTogglePoolSelection,
  onConfirmSelection,
  onCancelSelection,
  targetDumpId,
}: PhotoPoolProps) {
  var poolRef = useRef<HTMLDivElement>(null);
  var { dragState } = useDrag();
  var [isOver, setIsOver] = useState(false);
  var isOverRef = useRef(false);

  useEffect(function() {
    isOverRef.current = isOver;
  }, [isOver]);

  useEffect(function() {
    if (!dragState.isDragging) {
      setIsOver(false);
      return;
    }

    if (dragState.source?.type !== "dump") return;

    var handleMove = function(e: TouchEvent | MouseEvent) {
      var clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      if (!poolRef.current) return;
      var rect = poolRef.current.getBoundingClientRect();
      var over = clientY >= rect.top - 60 && clientY <= rect.bottom + 60;
      setIsOver(over);
    };

    var handleEnd = function() {
      if (isOverRef.current) {
        onDropToPool();
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
  }, [dragState.isDragging, dragState.source, onDropToPool]);

  return (
    <section
      ref={poolRef}
      id="photo-pool"
      style={{
        maxWidth: "1100px",
        margin: "56px auto",
        padding: "0 32px 120px",
        position: "relative",
      }}
    >
      {/* Section Header */}
      <div
        style={{
          marginBottom: "32px",
          paddingBottom: "24px",
          borderBottom: "1px solid #1e1e1e",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.25em",
            textTransform: "uppercase" as const,
            color: selectionMode ? "#22c55e" : "#c8a96e",
            marginBottom: "8px",
            transition: "color 0.3s",
          }}
        >
          {selectionMode ? "SELECT PHOTOS" : "PHOTO POOL"}
        </div>
        <h2
          style={{
            fontSize: "clamp(20px, 2.5vw, 28px)",
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.02em",
            marginBottom: "4px",
          }}
        >
          {selectionMode ? "Tap photos to add them" : "Available Photos"}
        </h2>
        <div
          style={{
            fontSize: "14px",
            color: "#666",
            fontStyle: "italic",
          }}
        >
          {selectionMode
            ? selectedIds.length + " selected \u00B7 Tap to select/deselect \u00B7 Confirm when ready"
            : photos.length + " photos available \u00B7 Drag into dumps above"
          }
        </div>
        {selectionMode && (
          <button
            onClick={onCancelSelection}
            style={{
              marginTop: "12px",
              background: "transparent",
              border: "1px solid #2a2a2a",
              borderRadius: "6px",
              padding: "6px 16px",
              color: "#999",
              fontSize: "12px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
        )}
      </div>

      {/* Photo Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "12px",
          outline: isOver ? "2px dashed rgba(200,169,110,0.5)" : "none",
          outlineOffset: "8px",
          borderRadius: "12px",
          transition: "all 0.2s",
          padding: isOver ? "8px" : "0",
          background: isOver ? "rgba(200,169,110,0.03)" : "transparent",
        }}
      >
        {photos.map(function(photo, i) {
          var selIdx = selectedIds.indexOf(photo.id);
          return (
            <PhotoCard
              key={photo.id}
              photo={photo}
              index={i}
              source={{ type: "pool" }}
              isSelected={selIdx >= 0}
              onSelect={selectionMode ? onTogglePoolSelection : undefined}
              onDoubleTap={selectionMode ? undefined : onDoubleTapPhoto}
              width={140}
              height={180}
              selectionMode={selectionMode}
              selectionIndex={selIdx >= 0 ? selIdx : undefined}
            />
          );
        })}
        {photos.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: "40px",
              color: "#666",
              fontSize: "14px",
              border: "1px dashed #2a2a2a",
              borderRadius: "10px",
            }}
          >
            All photos are in dumps
          </div>
        )}
      </div>

      {/* Floating Confirm Button — appears in selection mode */}
      {selectionMode && selectedIds.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 5000,
            display: "flex",
            gap: "12px",
          }}
        >
          <button
            onClick={onConfirmSelection}
            style={{
              background: "#22c55e",
              color: "#fff",
              border: "none",
              borderRadius: "12px",
              padding: "14px 32px",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              letterSpacing: "0.04em",
              boxShadow: "0 8px 32px rgba(34,197,94,0.4)",
              transition: "all 0.2s",
            }}
          >
            {"Confirm (" + selectedIds.length + ")"}
          </button>
        </div>
      )}
    </section>
  );
}

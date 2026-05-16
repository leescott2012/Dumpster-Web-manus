/*
 * PhotoPool — Bottom section: unused photos grid
 * Sort/filter: Starred first, Huji only
 * Upload "+" card at end
 * Full dots menu for pool photos (same as dump)
 * Selection mode: green outlines, multi-select, confirm
 */
import { useRef, useEffect, useState } from "react";
import PhotoCard from "./PhotoCard";
import { useDrag } from "@/contexts/DragContext";
import type { Photo } from "@/lib/photoData";
import { Plus } from "lucide-react";

interface PhotoPoolProps {
  photos: Photo[];
  onSelectPhoto: (photo: Photo) => void;
  onDotsClick: (photo: Photo, position: { x: number; y: number }) => void;
  onDoubleTapPhoto: (photo: Photo) => void;
  onDropToPool: () => void;
  onUploadPhotos: (files: FileList) => void;
  selectionMode: boolean;
  selectedIds: string[];
  onTogglePoolSelection: (photo: Photo) => void;
  onConfirmSelection: () => void;
  onCancelSelection: () => void;
  targetDumpId: string | null;
  selectedPhotoId: string | null;
}

export default function PhotoPool({
  photos, onSelectPhoto, onDotsClick, onDoubleTapPhoto, onDropToPool, onUploadPhotos,
  selectionMode, selectedIds, onTogglePoolSelection, onConfirmSelection, onCancelSelection,
  targetDumpId, selectedPhotoId,
}: PhotoPoolProps) {
  var poolRef = useRef<HTMLDivElement>(null);
  var fileInputRef = useRef<HTMLInputElement>(null);
  var { dragState } = useDrag();
  var [isOver, setIsOver] = useState(false);
  var isOverRef = useRef(false);
  var [sortBy, setSortBy] = useState<"all" | "starred">("all");

  useEffect(function() { isOverRef.current = isOver; }, [isOver]);

  useEffect(function() {
    if (!dragState.isDragging) { setIsOver(false); return; }
    if (dragState.source && dragState.source.type !== "dump") return;
    var handleMove = function(e: TouchEvent | MouseEvent) {
      var clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      if (!poolRef.current) return;
      var rect = poolRef.current.getBoundingClientRect();
      setIsOver(clientY >= rect.top - 60 && clientY <= rect.bottom + 60);
    };
    var handleEnd = function() { if (isOverRef.current) onDropToPool(); };
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

  // Filter/sort photos
  var displayPhotos: Photo[];
  if (sortBy === "starred") {
    displayPhotos = photos.filter(function(p) { return p.isFavorite; });
  } else {
    // Default: starred first, then rest
    var starred: Photo[] = [];
    var rest: Photo[] = [];
    for (var i = 0; i < photos.length; i++) {
      if (photos[i].isFavorite) starred.push(photos[i]);
      else rest.push(photos[i]);
    }
    displayPhotos = starred.concat(rest);
  }

  var handleUploadClick = function() {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  var handleFileChange = function(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      onUploadPhotos(e.target.files);
      e.target.value = "";
    }
  };

  var filterBtnStyle = function(active: boolean): React.CSSProperties {
    return {
      background: active ? "rgba(200,169,110,0.15)" : "transparent",
      border: active ? "1px solid #c8a96e" : "1px solid #2a2a2a",
      borderRadius: "100px", padding: "5px 14px", fontSize: "11px",
      color: active ? "#c8a96e" : "#666", cursor: "pointer",
      fontFamily: "inherit", letterSpacing: "0.04em", fontWeight: active ? 600 : 400,
      transition: "all 0.2s",
    };
  };

  return (
    <section ref={poolRef} style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 32px 120px", position: "relative" }}>
      {/* Selection-mode banner */}
      {selectionMode && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase" as const, color: "#22c55e", marginBottom: "6px" }}>
            SELECT PHOTOS
          </div>
          <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", marginBottom: "4px" }}>
            Tap photos to add them
          </h3>
          <div style={{ fontSize: "13px", color: "#666", fontStyle: "italic" }}>
            {selectedIds.length + " selected \u00B7 Tap to select/deselect \u00B7 Confirm when ready"}
          </div>
          <button onClick={onCancelSelection}
            style={{ marginTop: "12px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "6px 16px", color: "#999", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Sort/Filter bar — only when NOT in selection mode */}
      {!selectionMode && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
          <button onClick={function() { setSortBy("all"); }} style={filterBtnStyle(sortBy === "all")}>All</button>
          <button onClick={function() { setSortBy("starred"); }} style={filterBtnStyle(sortBy === "starred")}>
            <span style={{ marginRight: "4px" }}>{"\u2605"}</span>Starred
          </button>
        </div>
      )}

      {/* Photo Grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px",
        outline: isOver ? "2px dashed rgba(200,169,110,0.5)" : "none", outlineOffset: "8px",
        borderRadius: "12px", transition: "all 0.2s",
        padding: isOver ? "8px" : "0", background: isOver ? "rgba(200,169,110,0.03)" : "transparent",
      }}>
        {displayPhotos.map(function(photo, i) {
          var selIdx = selectedIds.indexOf(photo.id);
          return (
            <PhotoCard key={photo.id} photo={photo} index={i}
              source={{ type: "pool" }}
              isSelected={selectionMode ? selIdx >= 0 : selectedPhotoId === photo.id}
              onSelect={selectionMode ? onTogglePoolSelection : onSelectPhoto}
              onDotsClick={selectionMode ? undefined : onDotsClick}
              onDoubleTap={selectionMode ? undefined : onDoubleTapPhoto}
              width={140} height={180}
              selectionMode={selectionMode}
              selectionIndex={selIdx >= 0 ? selIdx : undefined}
            />
          );
        })}

        {/* Upload "+" card at end of pool — matches photo card 140×180 exactly */}
        {!selectionMode && (
          <div onClick={handleUploadClick}
            style={{
              width: "140px", height: "184px", flexShrink: 0,
              borderRadius: "10px", border: "2px dashed #2a2a2a",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              color: "#666", fontSize: "13px", textAlign: "center", cursor: "pointer",
              transition: "all 0.2s", background: "rgba(255,255,255,0.02)",
              boxSizing: "border-box",
            }}
            onMouseEnter={function(e) { e.currentTarget.style.borderColor = "#c8a96e"; e.currentTarget.style.color = "#c8a96e"; }}
            onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#666"; }}
          >
            <Plus size={28} strokeWidth={1.5} />
            <span style={{ marginTop: "6px", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Add Photos</span>
          </div>
        )}

        {displayPhotos.length === 0 && !selectionMode && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px", color: "#666", fontSize: "14px", border: "1px dashed #2a2a2a", borderRadius: "10px" }}>
            {sortBy === "starred" ? "No starred photos yet" : "All photos are in dumps"}
          </div>
        )}
      </div>

      {/* Hidden file input for upload */}
      <input ref={fileInputRef} type="file" accept="image/*" multiple
        style={{ display: "none" }} onChange={handleFileChange}
      />

      {/* Floating Confirm Button — selection mode */}
      {selectionMode && selectedIds.length > 0 && (
        <div style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", zIndex: 5000, display: "flex", gap: "12px" }}>
          <button onClick={onConfirmSelection}
            style={{
              background: "#22c55e", color: "#fff", border: "none", borderRadius: "12px",
              padding: "14px 32px", fontSize: "15px", fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", letterSpacing: "0.04em",
              boxShadow: "0 8px 32px rgba(34,197,94,0.4)", transition: "all 0.2s",
            }}
          >
            {"Confirm (" + selectedIds.length + ")"}
          </button>
        </div>
      )}
    </section>
  );
}

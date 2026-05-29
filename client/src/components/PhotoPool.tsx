/*
 * PhotoPool — Bottom section: unused photos grid
 * Sort/filter: All, Starred, Used (in dumps), Videos
 * Upload "+" card at end
 * Full dots menu for pool photos (same as dump)
 * Selection mode: green outlines, multi-select, confirm
 */
import { useRef, useEffect, useState } from "react";
import PhotoCard from "./PhotoCard";
import { useDrag } from "@/contexts/DragContext";
import type { Dump, Photo } from "@/lib/photoData";
import { Plus, Play, Trash2 } from "lucide-react";

type FilterMode = "all" | "starred" | "used" | "videos";

interface PhotoPoolProps {
  photos: Photo[];
  dumps?: Dump[];           // for "Used" filter — photos in dumps
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
  deleteMode: boolean;
  selectedDeleteIds: string[];
  onEnterDeleteMode: () => void;
  onToggleDeleteSelection: (photo: Photo) => void;
  onConfirmDelete: () => void;
  onCancelDeleteMode: () => void;
}

export default function PhotoPool({
  photos, dumps = [], onSelectPhoto, onDotsClick, onDoubleTapPhoto, onDropToPool, onUploadPhotos,
  selectionMode, selectedIds, onTogglePoolSelection, onConfirmSelection, onCancelSelection,
  targetDumpId, selectedPhotoId,
  deleteMode, selectedDeleteIds, onEnterDeleteMode, onToggleDeleteSelection, onConfirmDelete, onCancelDeleteMode,
}: PhotoPoolProps) {
  var poolRef = useRef<HTMLDivElement>(null);
  var fileInputRef = useRef<HTMLInputElement>(null);
  var { dragState } = useDrag();
  var [isOver, setIsOver] = useState(false);
  var isOverRef = useRef(false);
  var [filter, setFilter] = useState<FilterMode>("all");

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

  // Build "used" data — photos in dumps with their dump number label
  var usedPhotos: Photo[] = [];
  var usedDumpLabel: Record<string, string> = {};
  for (var di = 0; di < dumps.length; di++) {
    var dumpNum = String(dumps[di].number).padStart(2, "0");
    for (var pi = 0; pi < dumps[di].photos.length; pi++) {
      var up = dumps[di].photos[pi];
      usedPhotos.push(up);
      usedDumpLabel[up.id] = "DUMP " + dumpNum;
    }
  }

  // Filter/sort pool photos
  var displayPhotos: Photo[];
  if (filter === "starred") {
    displayPhotos = photos.filter(function(p) { return p.isFavorite; });
  } else if (filter === "videos") {
    displayPhotos = photos.filter(function(p) { return p.category === "Video"; });
  } else {
    // "all" — starred first, then rest
    var starred: Photo[] = [];
    var rest: Photo[] = [];
    for (var i = 0; i < photos.length; i++) {
      if (photos[i].isFavorite) starred.push(photos[i]);
      else rest.push(photos[i]);
    }
    displayPhotos = starred.concat(rest);
  }

  // Counts for chip badges
  var starredCount = photos.filter(function(p) { return p.isFavorite; }).length;
  var videoCount = photos.filter(function(p) { return p.category === "Video"; }).length;
  var usedCount = usedPhotos.length;

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
      background: active ? "rgba(var(--accent-rgb),0.15)" : "transparent",
      border: active ? "1px solid var(--accent)" : "1px solid #2a2a2a",
      borderRadius: "100px", padding: "5px 14px", fontSize: "11px",
      color: active ? "var(--accent)" : "#666", cursor: "pointer",
      fontFamily: "inherit", letterSpacing: "0.04em", fontWeight: active ? 600 : 400,
      transition: "all 0.2s", display: "inline-flex", alignItems: "center",
    };
  };

  return (
    <section ref={poolRef} data-tour="pool-section" style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 32px 120px", position: "relative" }}>
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
            {selectedIds.length + " selected · Tap to select/deselect · Confirm when ready"}
          </div>
          <button onClick={onCancelSelection}
            style={{ marginTop: "12px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "6px 16px", color: "#999", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Delete-mode banner */}
      {deleteMode && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase" as const, color: "#ef4444", marginBottom: "6px" }}>
            DELETE PHOTOS
          </div>
          <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", marginBottom: "4px" }}>
            Tap photos to select for deletion
          </h3>
          <div style={{ fontSize: "13px", color: "#666", fontStyle: "italic" }}>
            {selectedDeleteIds.length + " selected · Tap to select/deselect · Confirm to delete permanently"}
          </div>
          <button onClick={onCancelDeleteMode}
            style={{ marginTop: "12px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "6px 16px", color: "#999", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Sort/Filter bar — only when NOT in selection or delete mode */}
      {!selectionMode && !deleteMode && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" as const, alignItems: "center" }}>
          <button onClick={function() { setFilter("all"); }} style={filterBtnStyle(filter === "all")}>All</button>
          <button onClick={function() { setFilter("starred"); }} style={filterBtnStyle(filter === "starred")}>
            <span style={{ marginRight: "4px" }}>{"★"}</span>Starred
            {starredCount > 0 && (
              <span style={{ marginLeft: "5px", background: "rgba(var(--accent-rgb),0.2)", borderRadius: "100px", padding: "1px 6px", fontSize: "10px" }}>
                {starredCount}
              </span>
            )}
          </button>
          <button onClick={function() { setFilter("used"); }} style={filterBtnStyle(filter === "used")}>
            <span style={{ marginRight: "4px" }}>{"✓"}</span>Used
            {usedCount > 0 && (
              <span style={{ marginLeft: "5px", background: filter === "used" ? "rgba(var(--accent-rgb),0.2)" : "rgba(255,255,255,0.08)", borderRadius: "100px", padding: "1px 6px", fontSize: "10px" }}>
                {usedCount}
              </span>
            )}
          </button>
          {videoCount > 0 && (
            <button onClick={function() { setFilter("videos"); }} style={filterBtnStyle(filter === "videos")}>
              <Play size={10} style={{ marginRight: "4px" }} />Videos
              <span style={{ marginLeft: "5px", background: filter === "videos" ? "rgba(var(--accent-rgb),0.2)" : "rgba(255,255,255,0.08)", borderRadius: "100px", padding: "1px 6px", fontSize: "10px" }}>
                {videoCount}
              </span>
            </button>
          )}
          {photos.length > 0 && (
            <button
              onClick={onEnterDeleteMode}
              style={{
                marginLeft: "auto", background: "transparent", border: "1px solid #2a2a2a",
                borderRadius: "100px", padding: "5px 12px", fontSize: "11px", color: "#666",
                cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.04em",
                display: "inline-flex", alignItems: "center", gap: "5px", transition: "all 0.2s",
              }}
              onMouseEnter={function(e) { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
              onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#666"; }}
            >
              <Trash2 size={11} />Select to Delete
            </button>
          )}
        </div>
      )}

      {/* Used filter — read-only grid of photos already placed in dumps */}
      {filter === "used" && !selectionMode && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px" }}>
          {usedPhotos.map(function(photo, i) {
            return (
              <div key={photo.id + "-used-" + i} style={{ position: "relative" }}>
                <PhotoCard photo={photo} index={i}
                  source={{ type: "pool" }}
                  isSelected={false}
                  onSelect={function() {}}
                  width={140} height={180}
                />
                <div style={{
                  position: "absolute", top: "6px", left: "6px",
                  background: "rgba(var(--accent-rgb),0.9)", borderRadius: "4px",
                  padding: "2px 6px", fontSize: "8px", fontWeight: 700,
                  letterSpacing: "0.08em", color: "#0a0a0a", pointerEvents: "none",
                }}>
                  {usedDumpLabel[photo.id]}
                </div>
              </div>
            );
          })}
          {usedPhotos.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px", color: "#666", fontSize: "14px", border: "1px dashed #2a2a2a", borderRadius: "10px" }}>
              No photos in dumps yet
            </div>
          )}
        </div>
      )}

      {/* Photo Grid — all / starred / videos */}
      {filter !== "used" && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px",
          outline: isOver ? "2px dashed rgba(var(--accent-rgb),0.5)" : "none", outlineOffset: "8px",
          borderRadius: "12px", transition: "all 0.2s",
          padding: isOver ? "8px" : "0", background: isOver ? "rgba(var(--accent-rgb),0.03)" : "transparent",
        }}>
          {displayPhotos.map(function(photo, i) {
            var selIdx = selectedIds.indexOf(photo.id);
            var delIdx = selectedDeleteIds.indexOf(photo.id);
            var anyMode = selectionMode || deleteMode;
            return (
              <PhotoCard key={photo.id} photo={photo} index={i}
                source={{ type: "pool" }}
                isSelected={selectionMode ? selIdx >= 0 : deleteMode ? delIdx >= 0 : selectedPhotoId === photo.id}
                onSelect={selectionMode ? onTogglePoolSelection : deleteMode ? onToggleDeleteSelection : onSelectPhoto}
                onDotsClick={anyMode ? undefined : onDotsClick}
                onDoubleTap={anyMode ? undefined : onDoubleTapPhoto}
                width={140} height={180}
                selectionMode={anyMode}
                selectionIndex={selectionMode && selIdx >= 0 ? selIdx : undefined}
                deleteMode={deleteMode}
                isDeleteSelected={delIdx >= 0}
              />
            );
          })}

          {/* Upload "+" card at end of pool */}
          {!selectionMode && !deleteMode && (
            <div data-tour="upload-card" onClick={handleUploadClick}
              style={{
                width: "140px", height: "184px", flexShrink: 0,
                borderRadius: "10px", border: "2px dashed #2a2a2a",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                color: "#666", fontSize: "13px", textAlign: "center", cursor: "pointer",
                transition: "all 0.2s", background: "rgba(255,255,255,0.02)",
                boxSizing: "border-box" as const,
              }}
              onMouseEnter={function(e) { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#666"; }}
            >
              <Plus size={28} strokeWidth={1.5} />
              <span style={{ marginTop: "6px", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Add Photos</span>
            </div>
          )}

          {displayPhotos.length === 0 && !selectionMode && filter !== "all" && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px", color: "#666", fontSize: "14px", border: "1px dashed #2a2a2a", borderRadius: "10px" }}>
              {filter === "starred" ? "No starred photos yet" : "No videos yet — upload one"}
            </div>
          )}

          {/* Prominent empty-pool onboarding state — only when filter is 'all' and pool is empty */}
          {displayPhotos.length === 0 && !selectionMode && filter === "all" && (
            <div
              onClick={handleUploadClick}
              style={{
                gridColumn: "1 / -1",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "56px 32px",
                borderRadius: "14px",
                border: "1.5px dashed rgba(var(--accent-rgb),0.35)",
                background: "rgba(var(--accent-rgb),0.04)",
                cursor: "pointer", transition: "all 0.2s",
                textAlign: "center",
              }}
              onMouseEnter={function(e) { e.currentTarget.style.background = "rgba(var(--accent-rgb),0.08)"; e.currentTarget.style.borderColor = "var(--accent)"; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = "rgba(var(--accent-rgb),0.04)"; e.currentTarget.style.borderColor = "rgba(var(--accent-rgb),0.35)"; }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: "rgba(var(--accent-rgb),0.12)",
                border: "1px solid rgba(var(--accent-rgb),0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 18, color: "var(--accent)",
              }}>
                <Plus size={28} strokeWidth={1.8} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "var(--accent)", marginBottom: 10 }}>
                Get Started
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: 8 }}>
                Build your photo pool
              </h3>
              <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, maxWidth: 380, marginBottom: 22 }}>
                Upload photos and videos to start sequencing carousels. Tap any photo later to drop it into a dump.
              </p>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "var(--accent)", color: "#000",
                padding: "12px 24px", borderRadius: 10,
                fontSize: 13, fontWeight: 800, letterSpacing: "0.04em",
              }}>
                <Plus size={16} strokeWidth={2.5} />
                Upload Photos
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden file input — accepts images and videos. id used by Home.tsx to trigger upload from anywhere on the page. */}
      <input id="pool-upload-input" ref={fileInputRef} type="file" accept="image/*,video/*" multiple
        style={{ display: "none" }} onChange={handleFileChange}
      />

      {/* Floating Confirm Button — add-to-dump selection mode */}
      {selectionMode && selectedIds.length > 0 && (
        <div style={{ position: "fixed", bottom: "calc(24px + env(safe-area-inset-bottom, 0px))", left: "50%", transform: "translateX(-50%)", zIndex: 5000, display: "flex", gap: "12px" }}>
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

      {/* Floating Delete Button — delete mode */}
      {deleteMode && selectedDeleteIds.length > 0 && (
        <div style={{ position: "fixed", bottom: "calc(24px + env(safe-area-inset-bottom, 0px))", left: "50%", transform: "translateX(-50%)", zIndex: 5000, display: "flex", gap: "12px" }}>
          <button onClick={onConfirmDelete}
            style={{
              background: "#ef4444", color: "#fff", border: "none", borderRadius: "12px",
              padding: "14px 32px", fontSize: "15px", fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", letterSpacing: "0.04em",
              boxShadow: "0 8px 32px rgba(239,68,68,0.4)", transition: "all 0.2s",
              display: "flex", alignItems: "center", gap: "8px",
            }}
          >
            <Trash2 size={16} />{"Delete (" + selectedDeleteIds.length + ")"}
          </button>
        </div>
      )}
    </section>
  );
}

/*
 * Home — Main page assembling all carousel builder components
 * V4 design: dark theme, gold accents, scroll-snap strips
 *
 * Interaction model:
 * - Tap photo = yellow highlight + "..." dots
 * - "..." dots = context menu (Mark Huji, Remove)
 * - "+" card at end of dump = pool selection mode
 * - Double tap = lightbox
 * - Hold + move = drag
 * - Tap elsewhere = deselect
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { DragProvider, useDrag } from "@/contexts/DragContext";
import { useCarouselState } from "@/hooks/useCarouselState";
import DumpStrip from "@/components/DumpStrip";
import PhotoPool from "@/components/PhotoPool";
import PhotoLightbox from "@/components/PhotoLightbox";
import PhotoContextMenu from "@/components/PhotoContextMenu";
import DragGhost from "@/components/DragGhost";
import OnboardingHint from "@/components/OnboardingHint";
import type { Photo } from "@/lib/photoData";
import { Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

function HomeContent() {
  var {
    dumps,
    pool,
    resetAll,
    movePhotoWithinDump,
    movePhotoBetweenDumps,
    movePhotoFromPoolToDump,
    movePhotoFromDumpToPool,
    createNewDump,
    deleteDump,
    toggleHuji,
    renameDump,
  } = useCarouselState();

  var { dragState, updateDragPosition, endDrag } = useDrag();

  // Selected photo (tap to highlight + show dots)
  var [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  // Lightbox
  var [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);

  // Context menu (from dots click)
  var [contextMenu, setContextMenu] = useState<{
    photo: Photo;
    position: { x: number; y: number };
    dumpId?: string;
  } | null>(null);

  // Pool selection mode
  var [selectionMode, setSelectionMode] = useState(false);
  var [selectionTargetDumpId, setSelectionTargetDumpId] = useState<string | null>(null);
  var [selectedPoolPhotoIds, setSelectedPoolPhotoIds] = useState<string[]>([]);

  // Ref for scroll-back after confirm
  var scrollBackRef = useRef<string | null>(null);

  // Global touch/mouse move for drag ghost positioning
  useEffect(function() {
    if (!dragState.isDragging) return;

    var handleMove = function(e: TouchEvent | MouseEvent) {
      if ("touches" in e) {
        e.preventDefault();
        updateDragPosition({
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        });
      } else {
        updateDragPosition({ x: e.clientX, y: e.clientY });
      }
    };

    var handleEnd = function() {
      setTimeout(function() { endDrag(); }, 100);
    };

    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("touchend", handleEnd);
    window.addEventListener("mouseup", handleEnd);

    document.body.style.overflow = "hidden";
    document.body.classList.add("dragging");

    return function() {
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("mouseup", handleEnd);
      document.body.style.overflow = "";
      document.body.classList.remove("dragging");
    };
  }, [dragState.isDragging, updateDragPosition, endDrag]);

  // ── Tap to select photo (yellow highlight + dots) ──
  var handleSelectPhoto = useCallback(function(photo: Photo) {
    setSelectedPhotoId(function(prev) {
      return prev === photo.id ? null : photo.id;
    });
    // Close context menu if open
    setContextMenu(null);
  }, []);

  // ── Dots click → open context menu ──
  var handleDotsClick = useCallback(function(photo: Photo, position: { x: number; y: number }) {
    var dump = dumps.find(function(d) {
      return d.photos.some(function(p) { return p.id === photo.id; });
    });
    setContextMenu({
      photo: photo,
      position: position,
      dumpId: dump ? dump.id : undefined,
    });
  }, [dumps]);

  // ── Double tap → lightbox ──
  var handleDoubleTapPhoto = useCallback(function(photo: Photo) {
    setLightboxPhoto(photo);
    setSelectedPhotoId(null);
    setContextMenu(null);
  }, []);

  // ── "+" card click → enter pool selection mode ──
  var handlePlusClick = useCallback(function(dumpId: string) {
    setSelectionMode(true);
    setSelectionTargetDumpId(dumpId);
    setSelectedPoolPhotoIds([]);
    setSelectedPhotoId(null);
    setContextMenu(null);

    // Scroll to pool
    setTimeout(function() {
      var poolEl = document.getElementById("photo-pool");
      if (poolEl) {
        poolEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);

    // Remember which dump to scroll back to
    scrollBackRef.current = dumpId;
  }, []);

  // ── Toggle pool photo selection ──
  var handleTogglePoolSelection = useCallback(function(photo: Photo) {
    setSelectedPoolPhotoIds(function(prev) {
      var idx = prev.indexOf(photo.id);
      if (idx >= 0) {
        return prev.filter(function(id) { return id !== photo.id; });
      }
      return prev.concat([photo.id]);
    });
  }, []);

  // ── Confirm pool selection → add photos to dump ──
  var handleConfirmSelection = useCallback(function() {
    if (!selectionTargetDumpId || selectedPoolPhotoIds.length === 0) return;

    var targetDumpId = selectionTargetDumpId;
    var photoIds = selectedPoolPhotoIds.slice();

    // Find the target dump to get current photo count
    var targetDump = dumps.find(function(d) { return d.id === targetDumpId; });
    if (!targetDump) return;

    var available = 7 - targetDump.photos.length;
    var toAdd = photoIds.slice(0, available);

    // Add each photo in order
    for (var i = 0; i < toAdd.length; i++) {
      var insertIdx = targetDump.photos.length + i;
      movePhotoFromPoolToDump(toAdd[i], targetDumpId, insertIdx);
    }

    if (toAdd.length < photoIds.length) {
      toast("Added " + toAdd.length + " photos (dump max is 7)");
    } else {
      toast("Added " + toAdd.length + " photos to dump");
    }

    // Exit selection mode
    setSelectionMode(false);
    setSelectionTargetDumpId(null);
    setSelectedPoolPhotoIds([]);

    // Scroll back to the target dump
    var scrollTarget = scrollBackRef.current;
    if (scrollTarget) {
      setTimeout(function() {
        var dumpEl = document.querySelector("[data-dump-id='" + scrollTarget + "']");
        if (dumpEl) {
          dumpEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 200);
    }
  }, [selectionTargetDumpId, selectedPoolPhotoIds, dumps, movePhotoFromPoolToDump]);

  // ── Cancel pool selection ──
  var handleCancelSelection = useCallback(function() {
    setSelectionMode(false);
    setSelectionTargetDumpId(null);
    setSelectedPoolPhotoIds([]);

    // Scroll back
    var scrollTarget = scrollBackRef.current;
    if (scrollTarget) {
      setTimeout(function() {
        var dumpEl = document.querySelector("[data-dump-id='" + scrollTarget + "']");
        if (dumpEl) {
          dumpEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 200);
    }
  }, []);

  // ── Drop handlers ──
  var handleDropOnDump = useCallback(
    function(targetDumpId: string, insertIndex: number) {
      if (!dragState.isDragging || !dragState.source || !dragState.photo) return;

      var source = dragState.source;

      if (source.type === "pool") {
        movePhotoFromPoolToDump(dragState.photo.id, targetDumpId, insertIndex);
        toast("Photo added to dump");
      } else if (source.type === "dump" && source.dumpId === targetDumpId) {
        movePhotoWithinDump(targetDumpId, source.index, insertIndex);
      } else if (source.type === "dump" && source.dumpId !== targetDumpId) {
        movePhotoBetweenDumps(source.dumpId!, source.index, targetDumpId, insertIndex);
        toast("Photo moved between dumps");
      }
    },
    [dragState, movePhotoFromPoolToDump, movePhotoWithinDump, movePhotoBetweenDumps]
  );

  var handleDropToPool = useCallback(function() {
    if (!dragState.isDragging || !dragState.source || dragState.source.type !== "dump") return;
    movePhotoFromDumpToPool(dragState.source.dumpId!, dragState.source.index);
    toast("Photo returned to pool");
  }, [dragState, movePhotoFromDumpToPool]);

  // ── Remove from dump (via context menu) ──
  var handleRemoveFromDump = useCallback(
    function(photoId: string) {
      if (!contextMenu || !contextMenu.dumpId) return;
      var dumpId = contextMenu.dumpId;
      var dump = dumps.find(function(d) { return d.id === dumpId; });
      if (!dump) return;
      var idx = dump.photos.findIndex(function(p) { return p.id === photoId; });
      if (idx >= 0) {
        movePhotoFromDumpToPool(dumpId, idx);
        toast("Photo returned to pool");
      }
      setSelectedPhotoId(null);
    },
    [contextMenu, dumps, movePhotoFromDumpToPool]
  );

  var handleReset = useCallback(function() {
    resetAll();
    setSelectedPhotoId(null);
    setContextMenu(null);
    setSelectionMode(false);
    setSelectedPoolPhotoIds([]);
    toast("Reset to original state");
  }, [resetAll]);

  var handleCreateDump = useCallback(function() {
    createNewDump();
    toast("New dump created \u2014 tap + to add photos");
  }, [createNewDump]);

  var handleDeleteDump = useCallback(
    function(dumpId: string) {
      deleteDump(dumpId);
      toast("Dump deleted \u2014 photos returned to pool");
    },
    [deleteDump]
  );

  // ── Click on empty space → deselect ──
  var handleBackgroundClick = useCallback(function(e: React.MouseEvent) {
    var target = e.target as HTMLElement;
    // Only deselect if clicking on the page background, not on a card or button
    if (target.closest("[data-photo-id]") || target.closest("button") || target.closest("[data-dump-id]")) return;
    setSelectedPhotoId(null);
    setContextMenu(null);
  }, []);

  var originalDumpIds = ["dump-1", "dump-2", "dump-3"];

  return (
    <div style={{ minHeight: "100vh" }} onClick={handleBackgroundClick}>
      {/* Dimming overlay when in selection mode */}
      {selectionMode && (
        <div
          id="selection-dimmer"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 100,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Header — V4 exact */}
      <header
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "60px 32px 40px",
          borderBottom: "1px solid #1e1e1e",
          position: "relative",
          zIndex: selectionMode ? 50 : "auto",
          opacity: selectionMode ? 0.3 : 1,
          transition: "opacity 0.3s",
          pointerEvents: selectionMode ? "none" : "auto",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            letterSpacing: "0.25em",
            textTransform: "uppercase" as const,
            color: "#c8a96e",
            marginBottom: "16px",
            fontWeight: 500,
          }}
        >
          Carousel Dump Builder
        </div>
        <h1
          style={{
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            color: "#fff",
            marginBottom: "16px",
          }}
        >
          Build Your <span style={{ color: "#c8a96e" }}>Dumps</span>
        </h1>
        <p
          style={{
            fontSize: "15px",
            color: "#666",
            maxWidth: "640px",
            lineHeight: 1.7,
          }}
        >
          Rearrange photos, build new dumps, and experiment with different flows.
          Tap a photo to select it. Tap + to add from the pool. Changes reset on refresh.
        </p>
        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: "24px",
            flexWrap: "wrap",
          }}
        >
          {[
            { label: "Dumps", value: dumps.length },
            { label: "Photos Used", value: dumps.reduce(function(s, d) { return s + d.photos.length; }, 0) },
            { label: "In Pool", value: pool.length },
          ].map(function(pill) {
            return (
              <span
                key={pill.label}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #1e1e1e",
                  borderRadius: "100px",
                  padding: "5px 14px",
                  fontSize: "11px",
                  color: "#666",
                  letterSpacing: "0.04em",
                }}
              >
                <strong style={{ color: "#e8e8e8", fontWeight: 600 }}>{pill.value}</strong> {pill.label}
              </span>
            );
          })}
          <span
            style={{
              background: "#1a1a1a",
              border: "1px solid #1e1e1e",
              borderRadius: "100px",
              padding: "5px 14px",
              fontSize: "11px",
              color: "#666",
              letterSpacing: "0.04em",
            }}
          >
            Playground <strong style={{ color: "#e8e8e8", fontWeight: 600 }}>Mode</strong>
          </span>
        </div>
      </header>

      {/* Rules — V4 exact */}
      <section
        style={{
          maxWidth: "1100px",
          margin: "40px auto",
          padding: "0 32px",
          position: "relative",
          zIndex: selectionMode ? 50 : "auto",
          opacity: selectionMode ? 0.3 : 1,
          transition: "opacity 0.3s",
          pointerEvents: selectionMode ? "none" : "auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
          }}
        >
          {[
            { num: "01", text: "Slide 1 is THE HOOK \u2014 must stop the scroll" },
            { num: "02", text: "Max 1-2 portraits per dump" },
            { num: "03", text: "Same car family within a dump" },
            { num: "04", text: "Match edit styles \u2014 flag Huji mismatches" },
            { num: "05", text: "Night stays night, day stays day" },
            { num: "06", text: "3-7 photos per dump, zero duplicates" },
            { num: "07", text: "Flow is the #1 priority above everything" },
            { num: "08", text: "Every dump tells a story" },
          ].map(function(rule) {
            return (
              <div
                key={rule.num}
                style={{
                  background: "#151515",
                  border: "1px solid #1e1e1e",
                  borderRadius: "10px",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#c8a96e",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase" as const,
                    marginBottom: "6px",
                  }}
                >
                  {"RULE " + rule.num}
                </div>
                <div style={{ fontSize: "13px", color: "#999", lineHeight: 1.5 }}>
                  {rule.text}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Divider */}
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "0 32px",
          opacity: selectionMode ? 0.3 : 1,
          transition: "opacity 0.3s",
        }}
      >
        <hr style={{ border: "none", borderTop: "1px solid #1e1e1e" }} />
      </div>

      {/* Dump Strips */}
      {dumps.map(function(dump) {
        return (
          <div
            key={dump.id}
            style={{
              position: "relative",
              zIndex: selectionMode ? 50 : "auto",
              opacity: selectionMode ? 0.3 : 1,
              transition: "opacity 0.3s",
              pointerEvents: selectionMode ? "none" : "auto",
            }}
          >
            <DumpStrip
              dump={dump}
              selectedPhotoId={selectedPhotoId}
              onSelectPhoto={handleSelectPhoto}
              onDotsClick={handleDotsClick}
              onDoubleTapPhoto={handleDoubleTapPhoto}
              onDropPhoto={handleDropOnDump}
              onDeleteDump={!originalDumpIds.includes(dump.id) ? handleDeleteDump : undefined}
              onRenameDump={renameDump}
              onPlusClick={handlePlusClick}
              isCustom={!originalDumpIds.includes(dump.id)}
            />
          </div>
        );
      })}

      {/* Action Buttons */}
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "0 32px",
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          position: "relative",
          zIndex: selectionMode ? 50 : "auto",
          opacity: selectionMode ? 0.3 : 1,
          transition: "opacity 0.3s",
          pointerEvents: selectionMode ? "none" : "auto",
        }}
      >
        <button
          onClick={handleCreateDump}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "#151515",
            border: "1px solid #2a2a2a",
            borderRadius: "10px",
            padding: "12px 20px",
            color: "#c8a96e",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s",
            fontFamily: "inherit",
            letterSpacing: "0.04em",
          }}
          onMouseEnter={function(e) {
            e.currentTarget.style.borderColor = "#c8a96e";
            e.currentTarget.style.background = "rgba(200,169,110,0.08)";
          }}
          onMouseLeave={function(e) {
            e.currentTarget.style.borderColor = "#2a2a2a";
            e.currentTarget.style.background = "#151515";
          }}
        >
          <Plus size={16} />
          New Dump
        </button>
        <button
          onClick={handleReset}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "#151515",
            border: "1px solid #2a2a2a",
            borderRadius: "10px",
            padding: "12px 20px",
            color: "#999",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.2s",
            fontFamily: "inherit",
            letterSpacing: "0.04em",
          }}
          onMouseEnter={function(e) {
            e.currentTarget.style.borderColor = "#666";
          }}
          onMouseLeave={function(e) {
            e.currentTarget.style.borderColor = "#2a2a2a";
          }}
        >
          <RotateCcw size={14} />
          Reset All
        </button>
      </div>

      {/* Divider */}
      <div
        style={{
          maxWidth: "1100px",
          margin: "40px auto 0",
          padding: "0 32px",
          opacity: selectionMode ? 0.3 : 1,
          transition: "opacity 0.3s",
        }}
      >
        <hr style={{ border: "none", borderTop: "1px solid #1e1e1e" }} />
      </div>

      {/* Photo Pool — elevated z-index in selection mode */}
      <div style={{ position: "relative", zIndex: selectionMode ? 200 : "auto" }}>
        <PhotoPool
          photos={pool}
          onDoubleTapPhoto={handleDoubleTapPhoto}
          onDropToPool={handleDropToPool}
          selectionMode={selectionMode}
          selectedIds={selectedPoolPhotoIds}
          onTogglePoolSelection={handleTogglePoolSelection}
          onConfirmSelection={handleConfirmSelection}
          onCancelSelection={handleCancelSelection}
          targetDumpId={selectionTargetDumpId}
        />
      </div>

      {/* Footer */}
      <footer
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "40px 32px",
          textAlign: "center",
          color: "#666",
          fontSize: "12px",
          borderTop: "1px solid #1e1e1e",
        }}
      >
        Carousel Dump Builder \u00B7 Playground Mode \u00B7 Changes reset on refresh
      </footer>

      {/* Overlays */}
      <DragGhost />
      <PhotoLightbox photo={lightboxPhoto} onClose={function() { setLightboxPhoto(null); }} />
      <PhotoContextMenu
        photo={contextMenu ? contextMenu.photo : null}
        position={contextMenu ? contextMenu.position : null}
        onClose={function() { setContextMenu(null); setSelectedPhotoId(null); }}
        onRemoveFromDump={handleRemoveFromDump}
        onToggleHuji={toggleHuji}
        isInDump={contextMenu ? !!contextMenu.dumpId : false}
      />
      <OnboardingHint />
    </div>
  );
}

export default function Home() {
  return (
    <DragProvider>
      <HomeContent />
    </DragProvider>
  );
}

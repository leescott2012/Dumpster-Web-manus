/*
 * Home — Main page assembling all carousel builder components
 * V4 design: dark theme, gold accents, scroll-snap strips
 * Interactive: drag-and-drop, lightbox, context menu, new dump creation
 * Playground mode: changes reset on refresh
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
  const {
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

  const { dragState, updateDragPosition, endDrag } = useDrag();

  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    photo: Photo;
    position: { x: number; y: number };
    dumpId?: string;
  } | null>(null);

  // Global touch/mouse move for drag ghost positioning
  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleMove = (e: TouchEvent | MouseEvent) => {
      if ("touches" in e) {
        // Prevent page scroll/rubber-banding while dragging
        e.preventDefault();
        updateDragPosition({
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        });
      } else {
        updateDragPosition({ x: e.clientX, y: e.clientY });
      }
    };

    const handleEnd = () => {
      // Delay to let drop handlers fire first
      setTimeout(() => endDrag(), 100);
    };

    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("touchend", handleEnd);
    window.addEventListener("mouseup", handleEnd);

    // Prevent page scrolling during drag
    document.body.style.overflow = "hidden";
    document.body.classList.add("dragging");

    return () => {
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("mouseup", handleEnd);
      document.body.style.overflow = "";
      document.body.classList.remove("dragging");
    };
  }, [dragState.isDragging, updateDragPosition, endDrag]);

  const handleTapPhoto = useCallback((photo: Photo) => {
    setLightboxPhoto(photo);
  }, []);

  const handleDoubleTapPhoto = useCallback(
    (photo: Photo) => {
      const dump = dumps.find((d) => d.photos.some((p) => p.id === photo.id));
      setContextMenu({
        photo,
        position: { x: window.innerWidth / 2 - 90, y: window.innerHeight / 2 - 80 },
        dumpId: dump?.id,
      });
    },
    [dumps]
  );

  const handleDropOnDump = useCallback(
    (targetDumpId: string, insertIndex: number) => {
      if (!dragState.isDragging || !dragState.source || !dragState.photo) return;

      const { source } = dragState;

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

  const handleDropToPool = useCallback(() => {
    if (!dragState.isDragging || !dragState.source || dragState.source.type !== "dump") return;
    movePhotoFromDumpToPool(dragState.source.dumpId!, dragState.source.index);
    toast("Photo returned to pool");
  }, [dragState, movePhotoFromDumpToPool]);

  const handleRemoveFromDump = useCallback(
    (photoId: string) => {
      if (!contextMenu?.dumpId) return;
      const dump = dumps.find((d) => d.id === contextMenu.dumpId);
      if (!dump) return;
      const idx = dump.photos.findIndex((p) => p.id === photoId);
      if (idx >= 0) {
        movePhotoFromDumpToPool(contextMenu.dumpId, idx);
        toast("Photo returned to pool");
      }
    },
    [contextMenu, dumps, movePhotoFromDumpToPool]
  );

  const handleReset = useCallback(() => {
    resetAll();
    toast("Reset to original state");
  }, [resetAll]);

  const handleCreateDump = useCallback(() => {
    createNewDump();
    toast("New dump created — drag photos into it");
  }, [createNewDump]);

  const handleDeleteDump = useCallback(
    (dumpId: string) => {
      deleteDump(dumpId);
      toast("Dump deleted — photos returned to pool");
    },
    [deleteDump]
  );

  const originalDumpIds = ["dump-1", "dump-2", "dump-3"];

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header — V4 exact */}
      <header
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "60px 32px 40px",
          borderBottom: "1px solid #1e1e1e",
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
          Long press to pick up a photo. Swipe to browse. Changes reset on refresh.
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
            { label: "Photos Used", value: dumps.reduce((s, d) => s + d.photos.length, 0) },
            { label: "In Pool", value: pool.length },
          ].map((pill) => (
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
          ))}
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
      <section style={{ maxWidth: "1100px", margin: "40px auto", padding: "0 32px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
          }}
        >
          {[
            { num: "01", text: "Slide 1 is THE HOOK — must stop the scroll" },
            { num: "02", text: "Max 1-2 portraits per dump" },
            { num: "03", text: "Same car family within a dump" },
            { num: "04", text: "Match edit styles — flag Huji mismatches" },
            { num: "05", text: "Night stays night, day stays day" },
            { num: "06", text: "3-7 photos per dump, zero duplicates" },
            { num: "07", text: "Flow is the #1 priority above everything" },
            { num: "08", text: "Every dump tells a story" },
          ].map((rule) => (
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
                RULE {rule.num}
              </div>
              <div style={{ fontSize: "13px", color: "#999", lineHeight: 1.5 }}>
                {rule.text}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 32px" }}>
        <hr style={{ border: "none", borderTop: "1px solid #1e1e1e" }} />
      </div>

      {/* Dump Strips */}
      {dumps.map((dump) => (
        <DumpStrip
          key={dump.id}
          dump={dump}
          onTapPhoto={handleTapPhoto}
          onDoubleTapPhoto={handleDoubleTapPhoto}
          onDropPhoto={handleDropOnDump}
          onDeleteDump={!originalDumpIds.includes(dump.id) ? handleDeleteDump : undefined}
          onRenameDump={renameDump}
          isCustom={!originalDumpIds.includes(dump.id)}
        />
      ))}

      {/* Action Buttons */}
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "0 32px",
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
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
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#c8a96e";
            e.currentTarget.style.background = "rgba(200,169,110,0.08)";
          }}
          onMouseLeave={(e) => {
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
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#666";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#2a2a2a";
          }}
        >
          <RotateCcw size={14} />
          Reset All
        </button>
      </div>

      {/* Divider */}
      <div style={{ maxWidth: "1100px", margin: "40px auto 0", padding: "0 32px" }}>
        <hr style={{ border: "none", borderTop: "1px solid #1e1e1e" }} />
      </div>

      {/* Photo Pool */}
      <PhotoPool
        photos={pool}
        onTapPhoto={handleTapPhoto}
        onDoubleTapPhoto={handleDoubleTapPhoto}
        onDropToPool={handleDropToPool}
      />

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
        Carousel Dump Builder · Playground Mode · Changes reset on refresh
      </footer>

      {/* Overlays */}
      <DragGhost />
      <PhotoLightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
      <PhotoContextMenu
        photo={contextMenu?.photo || null}
        position={contextMenu?.position || null}
        onClose={() => setContextMenu(null)}
        onRemoveFromDump={handleRemoveFromDump}
        onToggleHuji={toggleHuji}
        onViewLarger={(photo) => setLightboxPhoto(photo)}
        isInDump={!!contextMenu?.dumpId}
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

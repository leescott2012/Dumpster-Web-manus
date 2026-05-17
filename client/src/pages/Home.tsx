/*
 * Home — Dumpster main page
 * Tap = yellow highlight + dots, Dots = menu (Favorite/Remove)
 * "+" card = pool selection mode, Double tap = lightbox, Hold+move = drag
 * No rules, no onboarding hints. App name: Dumpster.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { DragProvider, useDrag } from "@/contexts/DragContext";
import { useCarouselState } from "@/hooks/useCarouselState";
import DumpStrip from "@/components/DumpStrip";
import PhotoPool from "@/components/PhotoPool";
import PhotoLightbox from "@/components/PhotoLightbox";
import PhotoContextMenu from "@/components/PhotoContextMenu";
import DragGhost from "@/components/DragGhost";
import type { Photo } from "@/lib/photoData";
import { Plus, RotateCcw, Sparkles, Menu } from "lucide-react";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import AISuggestSheet, { type SuggestedCluster } from "@/components/AISuggestSheet";
import CaptionSheet from "@/components/CaptionSheet";
import DumpShareSheet from "@/components/DumpShareSheet";
import DumpActionSheet from "@/components/DumpActionSheet";
import MainMenu, { initAccent } from "@/components/MainMenu";
import IGScrubSheet from "@/components/IGScrubSheet";
import DumpChatSheet from "@/components/DumpChatSheet";
import RecycleSheet from "@/components/RecycleSheet";
import PoolPill, { type PoolTab } from "@/components/PoolPill";
import CaptionPool from "@/components/CaptionPool";
import AuthSheet from "@/components/AuthSheet";
import CreditsSheet from "@/components/CreditsSheet";
import CreditsBadge from "@/components/CreditsBadge";
import WelcomeOverlay from "@/components/WelcomeOverlay";
import DemoBanner from "@/components/DemoBanner";
import GuidedTour, { isTourCompleted } from "@/components/GuidedTour";
import { AuthProvider } from "@/contexts/AuthContext";
import { loadCaptions } from "@/lib/captionPool";

function HomeContent() {
  var {
    dumps, pool, resetAll,
    movePhotoWithinDump, movePhotoBetweenDumps,
    movePhotoFromPoolToDump, movePhotoFromDumpToPool,
    removePhotoFromPool, createNewDump, deleteDump,
    toggleFavorite, toggleDumpFavorite, addUploadedPhotos, renameDump,
    createDumpsFromSuggestions, setDumpCaptions,
    reorderDumpPhotos, setDumpVibe, rateDump, swapPhoto,
  } = useCarouselState();

  var { dragState, updateDragPosition, endDrag } = useDrag();

  var [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  var [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  var [contextMenu, setContextMenu] = useState<{
    photo: Photo; position: { x: number; y: number }; dumpId?: string;
  } | null>(null);
  var [menuOpen, setMenuOpen] = useState(false);
  var [poolTab, setPoolTab] = useState<PoolTab>("photos");
  var [captionCount, setCaptionCount] = useState<number>(function() { return loadCaptions().length; });
  // Refresh caption count when the tab changes (in case caps were added)
  useEffect(function() { setCaptionCount(loadCaptions().length); }, [poolTab]);
  // Detect if user has uploaded any of their own photos (not stock)
  var hasUserPhotos = pool.some(function(p) { return p.id.startsWith("upload-"); })
    || dumps.some(function(d) { return d.photos.some(function(p) { return p.id.startsWith("upload-"); }); });

  // Scroll to pool and focus the upload area
  var scrollToPoolUpload = useCallback(function() {
    var poolEl = document.getElementById("photo-pool");
    if (poolEl) poolEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Guided tour
  var [tourActive, setTourActive] = useState(false);
  var startTour = useCallback(function() { setTourActive(true); }, []);
  var endTour = useCallback(function() { setTourActive(false); }, []);

  var [aiSheetOpen, setAiSheetOpen] = useState(false);
  var [igScrubOpen, setIGScrubOpen] = useState(false);
  var [captionSheetOpen, setCaptionSheetOpen] = useState(false);
  var [captionInitialDumpId, setCaptionInitialDumpId] = useState<string | null>(null);
  var [shareSheetDumpId, setShareSheetDumpId] = useState<string | null>(null);
  var [actionSheetDumpId, setActionSheetDumpId] = useState<string | null>(null);
  var [chatDumpId, setChatDumpId] = useState<string | null>(null);
  var [chatInitialMsg, setChatInitialMsg] = useState<string | null>(null);
  var [recyclePhotoId, setRecyclePhotoId] = useState<string | null>(null);
  var [recycleDumpId, setRecycleDumpId] = useState<string | null>(null);
  var [authSheetOpen, setAuthSheetOpen] = useState(false);
  var [creditsSheetOpen, setCreditsSheetOpen] = useState(false);
  var [selectionMode, setSelectionMode] = useState(false);
  var [selectionTargetDumpId, setSelectionTargetDumpId] = useState<string | null>(null);
  var [selectedPoolPhotoIds, setSelectedPoolPhotoIds] = useState<string[]>([]);
  var scrollBackRef = useRef<string | null>(null);

  // Init accent color from localStorage on mount
  useEffect(function() { initAccent(); }, []);

  // Global drag ghost positioning
  useEffect(function() {
    if (!dragState.isDragging) return;
    var handleMove = function(e: TouchEvent | MouseEvent) {
      if ("touches" in e) {
        e.preventDefault();
        updateDragPosition({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      } else {
        updateDragPosition({ x: e.clientX, y: e.clientY });
      }
    };
    var handleEnd = function() { setTimeout(function() { endDrag(); }, 100); };
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

  // Tap to select
  var handleSelectPhoto = useCallback(function(photo: Photo) {
    setSelectedPhotoId(function(prev) { return prev === photo.id ? null : photo.id; });
    setContextMenu(null);
  }, []);

  // Dots click -> context menu
  var handleDotsClick = useCallback(function(photo: Photo, position: { x: number; y: number }) {
    var foundDump: string | undefined;
    for (var i = 0; i < dumps.length; i++) {
      for (var j = 0; j < dumps[i].photos.length; j++) {
        if (dumps[i].photos[j].id === photo.id) { foundDump = dumps[i].id; break; }
      }
      if (foundDump) break;
    }
    setContextMenu({ photo: photo, position: position, dumpId: foundDump });
  }, [dumps]);

  // Double tap -> lightbox
  var handleDoubleTapPhoto = useCallback(function(photo: Photo) {
    setLightboxPhoto(photo);
    setSelectedPhotoId(null);
    setContextMenu(null);
  }, []);

  // "+" card -> pool selection mode
  var handlePlusClick = useCallback(function(dumpId: string) {
    setSelectionMode(true);
    setSelectionTargetDumpId(dumpId);
    setSelectedPoolPhotoIds([]);
    setSelectedPhotoId(null);
    setContextMenu(null);
    setTimeout(function() {
      var poolEl = document.getElementById("photo-pool");
      if (poolEl) poolEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    scrollBackRef.current = dumpId;
  }, []);

  // Toggle pool photo selection
  var handleTogglePoolSelection = useCallback(function(photo: Photo) {
    setSelectedPoolPhotoIds(function(prev) {
      var idx = prev.indexOf(photo.id);
      if (idx >= 0) return prev.filter(function(id) { return id !== photo.id; });
      return prev.concat([photo.id]);
    });
  }, []);

  // Confirm pool selection
  var handleConfirmSelection = useCallback(function() {
    if (!selectionTargetDumpId || selectedPoolPhotoIds.length === 0) return;
    var targetDumpId = selectionTargetDumpId;
    var photoIds = selectedPoolPhotoIds.slice();
    var targetDump: { photos: Photo[] } | null = null;
    for (var i = 0; i < dumps.length; i++) {
      if (dumps[i].id === targetDumpId) { targetDump = dumps[i]; break; }
    }
    if (!targetDump) return;
    var available = 20 - targetDump.photos.length;
    var toAdd = photoIds.slice(0, available);
    for (var j = 0; j < toAdd.length; j++) {
      movePhotoFromPoolToDump(toAdd[j], targetDumpId, targetDump.photos.length + j);
    }
    if (toAdd.length < photoIds.length) {
      toast("Added " + toAdd.length + " photos (dump max is 20)");
    } else {
      toast("Added " + toAdd.length + " photos to dump");
    }
    setSelectionMode(false);
    setSelectionTargetDumpId(null);
    setSelectedPoolPhotoIds([]);
    var scrollTarget = scrollBackRef.current;
    if (scrollTarget) {
      setTimeout(function() {
        var dumpEl = document.querySelector("[data-dump-id='" + scrollTarget + "']");
        if (dumpEl) dumpEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    }
  }, [selectionTargetDumpId, selectedPoolPhotoIds, dumps, movePhotoFromPoolToDump]);

  // Cancel pool selection
  var handleCancelSelection = useCallback(function() {
    setSelectionMode(false);
    setSelectionTargetDumpId(null);
    setSelectedPoolPhotoIds([]);
    var scrollTarget = scrollBackRef.current;
    if (scrollTarget) {
      setTimeout(function() {
        var dumpEl = document.querySelector("[data-dump-id='" + scrollTarget + "']");
        if (dumpEl) dumpEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    }
  }, []);

  // Drop handlers
  var handleDropOnDump = useCallback(function(targetDumpId: string, insertIndex: number) {
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
  }, [dragState, movePhotoFromPoolToDump, movePhotoWithinDump, movePhotoBetweenDumps]);

  var handleDropToPool = useCallback(function() {
    if (!dragState.isDragging || !dragState.source || dragState.source.type !== "dump") return;
    movePhotoFromDumpToPool(dragState.source.dumpId!, dragState.source.index);
    toast("Photo returned to pool");
  }, [dragState, movePhotoFromDumpToPool]);

  // Remove from context menu — works for both dump and pool photos
  var handleRemove = useCallback(function(photoId: string) {
    if (!contextMenu) return;
    if (contextMenu.dumpId) {
      // Photo is in a dump — move to pool
      var dumpId = contextMenu.dumpId;
      var dump: { photos: Photo[] } | null = null;
      for (var i = 0; i < dumps.length; i++) {
        if (dumps[i].id === dumpId) { dump = dumps[i]; break; }
      }
      if (dump) {
        var idx = -1;
        for (var j = 0; j < dump.photos.length; j++) {
          if (dump.photos[j].id === photoId) { idx = j; break; }
        }
        if (idx >= 0) {
          movePhotoFromDumpToPool(dumpId, idx);
          toast("Photo returned to pool");
        }
      }
    } else {
      // Photo is in pool — remove entirely
      removePhotoFromPool(photoId);
      toast("Photo removed");
    }
    setSelectedPhotoId(null);
  }, [contextMenu, dumps, movePhotoFromDumpToPool, removePhotoFromPool]);

  // Upload photos/videos from device
  var handleUploadPhotos = useCallback(function(files: FileList) {
    var newPhotos: Photo[] = [];
    var processed = 0;
    var total = files.length;
    for (var i = 0; i < total; i++) {
      (function(file: File) {
        var isVideo = file.type.startsWith("video/");
        if (isVideo) {
          // Videos: use createObjectURL for instant preview
          var url = URL.createObjectURL(file);
          newPhotos.push({
            id: "upload-" + nanoid(8),
            url: url,
            alt: file.name,
            isFavorite: false,
            category: "Video",
          });
          processed++;
          if (processed === total) {
            addUploadedPhotos(newPhotos);
            toast("Added " + newPhotos.length + (newPhotos.length === 1 ? " item" : " items") + " to pool");
          }
        } else {
          var reader = new FileReader();
          reader.onload = function(e) {
            if (e.target && e.target.result) {
              newPhotos.push({
                id: "upload-" + nanoid(8),
                url: e.target.result as string,
                alt: file.name,
                isFavorite: false,
                category: "Uploaded",
              });
            }
            processed++;
            if (processed === total) {
              addUploadedPhotos(newPhotos);
              toast("Added " + newPhotos.length + (newPhotos.length === 1 ? " item" : " items") + " to pool");
            }
          };
          reader.readAsDataURL(file);
        }
      })(files[i]);
    }
  }, [addUploadedPhotos]);

  var handleAICreateDumps = useCallback(function(clusters: SuggestedCluster[]) {
    createDumpsFromSuggestions(clusters);
    toast("Created " + clusters.length + " AI-suggested dump" + (clusters.length !== 1 ? "s" : ""));
  }, [createDumpsFromSuggestions]);

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

  var handleDeleteDump = useCallback(function(dumpId: string) {
    deleteDump(dumpId);
    toast("Dump deleted \u2014 photos returned to pool");
  }, [deleteDump]);

  // Tap/click on empty space -> deselect
  // SAFARI FIX: We use a ref to track whether a card touchend just fired.
  // If it did, the background touchend/click must be ignored.
  var cardTappedRef = useRef(false);

  var handleBackgroundTouch = useCallback(function(e: React.TouchEvent) {
    var target = e.target as HTMLElement;
    // If touch ended on a card or button, don't deselect
    if (target.closest("[data-photo-id]") || target.closest("button")) return;
    // Small delay to let card's own touchend fire first
    setTimeout(function() {
      setSelectedPhotoId(null);
      setContextMenu(null);
    }, 50);
  }, []);

  var handleBackgroundClick = useCallback(function(e: React.MouseEvent) {
    var target = e.target as HTMLElement;
    if (target.closest("[data-photo-id]") || target.closest("button")) return;
    setSelectedPhotoId(null);
    setContextMenu(null);
  }, []);

  var originalDumpIds = ["dump-1", "dump-2", "dump-3"];

  return (
    <div style={{ minHeight: "100vh", paddingTop: "52px" }} onClick={handleBackgroundClick} onTouchEnd={handleBackgroundTouch}>
      {/* Fixed top navbar */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 52, zIndex: 300,
        background: "rgba(5,5,5,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #1a1a1a",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px",
      }}>
        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.3em", color: "var(--accent)", textTransform: "uppercase" as const }}>
          DUMPSTER
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CreditsBadge
            onCreditsClick={function() { setCreditsSheetOpen(true); }}
            onAuthClick={function() { setAuthSheetOpen(true); }}
          />
          <button
            onClick={function(e) { e.stopPropagation(); setMenuOpen(true); }}
            style={{
              width: 36, height: 36, borderRadius: 9,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#e8e8e8", transition: "all 0.15s",
            }}
            onMouseEnter={function(e) { e.currentTarget.style.background = "rgba(var(--accent-rgb),0.12)"; e.currentTarget.style.borderColor = "rgba(var(--accent-rgb),0.3)"; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
          >
            <Menu size={17} />
          </button>
        </div>
      </nav>
      {/* Dimming overlay when in selection mode */}
      {selectionMode && (
        <div id="selection-dimmer" style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", zIndex: 100, pointerEvents: "none",
        }} />
      )}

      {/* Header */}
      <header style={{
        maxWidth: "1100px", margin: "0 auto", padding: "60px 32px 40px",
        borderBottom: "1px solid #1e1e1e", position: "relative",
        zIndex: selectionMode ? 50 : "auto",
        opacity: selectionMode ? 0.3 : 1, transition: "opacity 0.3s",
        pointerEvents: selectionMode ? "none" : "auto",
      }}>
        <div style={{ fontSize: "11px", letterSpacing: "0.25em", textTransform: "uppercase" as const, color: "var(--accent)", marginBottom: "16px", fontWeight: 500 }}>
          Dumpster
        </div>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1, color: "#fff", marginBottom: "16px" }}>
          Build Your <span style={{ color: "var(--accent)" }}>Dumps</span>
        </h1>
        <p style={{ fontSize: "15px", color: "#666", maxWidth: "640px", lineHeight: 1.7 }}>
          Rearrange photos, build new dumps, and experiment with different flows.
          Tap a photo to select it. Tap + to add from the pool.
        </p>
        <div style={{ display: "flex", gap: "16px", marginTop: "24px", flexWrap: "wrap" }}>
          {[
            { label: "Dumps", value: dumps.length },
            { label: "Photos Used", value: dumps.reduce(function(s, d) { return s + d.photos.length; }, 0) },
            { label: "In Pool", value: pool.length },
          ].map(function(pill) {
            return (
              <span key={pill.label} style={{
                background: "#1a1a1a", border: "1px solid #1e1e1e", borderRadius: "100px",
                padding: "5px 14px", fontSize: "11px", color: "#666", letterSpacing: "0.04em",
              }}>
                <strong style={{ color: "#e8e8e8", fontWeight: 600 }}>{pill.value}</strong> {pill.label}
              </span>
            );
          })}
        </div>
      </header>

      {/* Dump Strips */}
      {dumps.map(function(dump) {
        return (
          <div key={dump.id} style={{
            position: "relative",
            zIndex: selectionMode ? 50 : "auto",
            opacity: selectionMode ? 0.3 : 1,
            transition: "opacity 0.3s",
            pointerEvents: selectionMode ? "none" : "auto",
          }}>
            <DumpStrip
              dump={dump} selectedPhotoId={selectedPhotoId}
              onSelectPhoto={handleSelectPhoto} onDotsClick={handleDotsClick}
              onDoubleTapPhoto={handleDoubleTapPhoto} onDropPhoto={handleDropOnDump}
              onDeleteDump={!originalDumpIds.includes(dump.id) ? handleDeleteDump : undefined}
              onRenameDump={renameDump} onPlusClick={handlePlusClick}
              onMenuClick={function(dumpId) { setActionSheetDumpId(dumpId); }}
              onCaptionClick={function(dumpId) { setCaptionInitialDumpId(dumpId); setCaptionSheetOpen(true); }}
              isCustom={!originalDumpIds.includes(dump.id)}
            />
          </div>
        );
      })}

      {/* Action Buttons */}
      <div style={{
        maxWidth: "1100px", margin: "0 auto", padding: "0 32px",
        display: "flex", gap: "12px", flexWrap: "wrap", position: "relative",
        zIndex: selectionMode ? 50 : "auto",
        opacity: selectionMode ? 0.3 : 1, transition: "opacity 0.3s",
        pointerEvents: selectionMode ? "none" : "auto",
      }}>
        <button
          data-tour="ai-suggest"
          onClick={function() { setAiSheetOpen(true); }}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: "rgba(var(--accent-rgb),0.1)", border: "1px solid rgba(var(--accent-rgb),0.3)", borderRadius: "10px",
            padding: "12px 20px", color: "var(--accent)", fontSize: "13px", fontWeight: 700,
            cursor: "pointer", transition: "all 0.2s", fontFamily: "inherit", letterSpacing: "0.04em",
          }}
          onMouseEnter={function(e) { e.currentTarget.style.background = "rgba(var(--accent-rgb),0.18)"; e.currentTarget.style.borderColor = "var(--accent)"; }}
          onMouseLeave={function(e) { e.currentTarget.style.background = "rgba(var(--accent-rgb),0.1)"; e.currentTarget.style.borderColor = "rgba(var(--accent-rgb),0.3)"; }}
        >
          <Sparkles size={15} /> AI Suggest
        </button>
        <button data-tour="new-dump" onClick={handleCreateDump} style={{
          display: "flex", alignItems: "center", gap: "8px",
          background: "#151515", border: "1px solid #2a2a2a", borderRadius: "10px",
          padding: "12px 20px", color: "var(--accent)", fontSize: "13px", fontWeight: 600,
          cursor: "pointer", transition: "all 0.2s", fontFamily: "inherit", letterSpacing: "0.04em",
        }}
          onMouseEnter={function(e) { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "rgba(var(--accent-rgb),0.08)"; }}
          onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.background = "#151515"; }}
        >
          <Plus size={16} /> New Dump
        </button>
        <button onClick={handleReset} style={{
          display: "flex", alignItems: "center", gap: "8px",
          background: "#151515", border: "1px solid #2a2a2a", borderRadius: "10px",
          padding: "12px 20px", color: "#999", fontSize: "13px", fontWeight: 500,
          cursor: "pointer", transition: "all 0.2s", fontFamily: "inherit", letterSpacing: "0.04em",
        }}
          onMouseEnter={function(e) { e.currentTarget.style.borderColor = "#666"; }}
          onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#2a2a2a"; }}
        >
          <RotateCcw size={14} /> Reset All
        </button>
      </div>

      {/* Divider */}
      <div style={{ maxWidth: "1100px", margin: "40px auto 0", padding: "0 32px", opacity: selectionMode ? 0.3 : 1, transition: "opacity 0.3s" }}>
        <hr style={{ border: "none", borderTop: "1px solid #1e1e1e" }} />
      </div>

      {/* Pool Section — pill toggle + Photos or Captions tab */}
      <div id="photo-pool" style={{ position: "relative", zIndex: selectionMode ? 200 : "auto", paddingTop: 40 }}>
        {/* Centered POOL divider — matches iOS native */}
        <div style={{
          maxWidth: 1100, margin: "0 auto 18px", padding: "0 32px",
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <div style={{ flex: 1, height: 1, background: "#1e1e1e" }} />
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.35em",
            textTransform: "uppercase" as const, color: "#666",
            flexShrink: 0,
          }}>
            POOL
          </div>
          <div style={{ flex: 1, height: 1, background: "#1e1e1e" }} />
        </div>

        <PoolPill
          active={poolTab}
          onChange={function(t) { setPoolTab(t); }}
          photoCount={pool.length}
          captionCount={captionCount}
        />

        {/* Sub-section header — left aligned below pill */}
        <div style={{ maxWidth: 1100, margin: "8px auto 18px", padding: "0 32px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase" as const, color: "var(--accent)", marginBottom: 6 }}>
            {poolTab === "photos" ? "PHOTO POOL" : "CAPTION POOL"}
          </div>
          <h2 style={{ fontSize: "clamp(20px, 2.5vw, 28px)", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", marginBottom: 4 }}>
            {poolTab === "photos" ? "Available Photos" : "Caption Library"}
          </h2>
          <div style={{ fontSize: 14, color: "#666", fontStyle: "italic" as const }}>
            {poolTab === "photos"
              ? pool.length + " available · " + dumps.reduce(function(s, d) { return s + d.photos.length; }, 0) + " in dumps"
              : captionCount + " captions in library"
            }
          </div>
        </div>

        {poolTab === "photos" ? (
          <PhotoPool
            photos={pool}
            dumps={dumps}
            selectedPhotoId={selectedPhotoId}
            onSelectPhoto={handleSelectPhoto}
            onDotsClick={handleDotsClick}
            onDoubleTapPhoto={handleDoubleTapPhoto}
            onDropToPool={handleDropToPool}
            onUploadPhotos={handleUploadPhotos}
            selectionMode={selectionMode}
            selectedIds={selectedPoolPhotoIds}
            onTogglePoolSelection={handleTogglePoolSelection}
            onConfirmSelection={handleConfirmSelection}
            onCancelSelection={handleCancelSelection}
            targetDumpId={selectionTargetDumpId}
          />
        ) : (
          <CaptionPool />
        )}
      </div>

      {/* Footer */}
      <footer style={{
        maxWidth: "1100px", margin: "0 auto", padding: "40px 32px",
        textAlign: "center", color: "#666", fontSize: "12px", borderTop: "1px solid #1e1e1e",
      }}>
        Dumpster \u00B7 Carousel Dump Builder
      </footer>

      {/* Overlays */}
      <MainMenu
        open={menuOpen}
        onClose={function() { setMenuOpen(false); }}
        onAISuggest={function() { setAiSheetOpen(true); }}
        onCaptions={function() { setCaptionInitialDumpId(null); setCaptionSheetOpen(true); }}
        onIGScrub={function() { setIGScrubOpen(true); }}
        onReset={handleReset}
        onTour={startTour}
        dumpCount={dumps.length}
        poolCount={pool.length}
      />
      <IGScrubSheet
        open={igScrubOpen}
        onClose={function() { setIGScrubOpen(false); }}
        onAddToPool={function(photos) { addUploadedPhotos(photos); toast("Added " + photos.length + " item" + (photos.length !== 1 ? "s" : "") + " to pool"); }}
      />
      <CaptionSheet
        open={captionSheetOpen}
        onClose={function() { setCaptionSheetOpen(false); }}
        dumps={dumps}
        initialDumpId={captionInitialDumpId}
        onCaptionsGenerated={function(dumpId, captions, vibe) { setDumpCaptions(dumpId, captions, vibe); }}
      />
      <AISuggestSheet
        open={aiSheetOpen}
        onClose={function() { setAiSheetOpen(false); }}
        poolPhotos={pool}
        onCreateDumps={handleAICreateDumps}
      />
      <DumpActionSheet
        open={actionSheetDumpId !== null}
        dump={actionSheetDumpId ? (dumps.find(function(d) { return d.id === actionSheetDumpId; }) || null) : null}
        onClose={function() { setActionSheetDumpId(null); }}
        onHeart={function(dumpId) { toggleDumpFavorite(dumpId); }}
        onChat={function(dumpId) { setChatInitialMsg(null); setChatDumpId(dumpId); }}
        onRate={function(dumpId, rating) { rateDump(dumpId, rating); }}
        onThumbsDown={function(dumpId) {
          setChatInitialMsg("I rated this dump thumbs down. What could be better about it? Ask me what I don't like.");
          setChatDumpId(dumpId);
        }}
        onCaptions={function(dumpId) { setCaptionInitialDumpId(dumpId); setCaptionSheetOpen(true); }}
        onExport={function(dumpId) { setShareSheetDumpId(dumpId); }}
        onDelete={function(dumpId) { handleDeleteDump(dumpId); }}
      />
      <DumpShareSheet
        open={shareSheetDumpId !== null}
        dump={shareSheetDumpId ? (dumps.find(function(d) { return d.id === shareSheetDumpId; }) || null) : null}
        onClose={function() { setShareSheetDumpId(null); }}
      />
      <DumpChatSheet
        open={chatDumpId !== null}
        dump={chatDumpId ? (dumps.find(function(d) { return d.id === chatDumpId; }) || null) : null}
        pool={pool}
        onClose={function() { setChatDumpId(null); setChatInitialMsg(null); }}
        onReorder={reorderDumpPhotos}
        onSwapIn={movePhotoFromPoolToDump}
        onSwapOut={movePhotoFromDumpToPool}
        onUpdateVibe={setDumpVibe}
        initialMessage={chatInitialMsg}
      />
      <DragGhost />
      <PhotoLightbox photo={lightboxPhoto} onClose={function() { setLightboxPhoto(null); }} />
      <PhotoContextMenu
        photo={contextMenu ? contextMenu.photo : null}
        position={contextMenu ? contextMenu.position : null}
        dumpId={contextMenu ? contextMenu.dumpId : undefined}
        onClose={function() { setContextMenu(null); setSelectedPhotoId(null); }}
        onRemove={handleRemove}
        onToggleFavorite={toggleFavorite}
        onRecycle={function(photoId, dumpId) { setRecyclePhotoId(photoId); setRecycleDumpId(dumpId); setContextMenu(null); setSelectedPhotoId(null); }}
      />
      <RecycleSheet
        open={recyclePhotoId !== null}
        photoId={recyclePhotoId}
        dumpId={recycleDumpId}
        dumps={dumps}
        pool={pool}
        onClose={function() { setRecyclePhotoId(null); setRecycleDumpId(null); }}
        onSwap={function(dumpId, oldPhotoId, newPhotoId) { swapPhoto(dumpId, oldPhotoId, newPhotoId); toast("Photo swapped"); }}
      />
      <WelcomeOverlay onUploadClick={scrollToPoolUpload} onTourClick={startTour} />
      <DemoBanner hasUserPhotos={hasUserPhotos} onUploadClick={scrollToPoolUpload} />
      <GuidedTour active={tourActive} onEnd={endTour} />
      <AuthSheet open={authSheetOpen} onClose={function() { setAuthSheetOpen(false); }} />
      <CreditsSheet
        open={creditsSheetOpen}
        onClose={function() { setCreditsSheetOpen(false); }}
        onNeedAuth={function() { setCreditsSheetOpen(false); setAuthSheetOpen(true); }}
      />
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <DragProvider>
        <HomeContent />
      </DragProvider>
    </AuthProvider>
  );
}

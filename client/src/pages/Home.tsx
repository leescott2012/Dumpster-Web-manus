/*
 * Home — Dumpster main page
 * Tap = yellow highlight + dots, Dots = menu (Favorite/Remove)
 * "+" card = pool selection mode, Double tap = lightbox, Hold+move = drag
 * No rules, no onboarding hints. App name: Dumpster.
 */
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DragProvider, useDrag } from "@/contexts/DragContext";
import { useCarouselState } from "@/hooks/useCarouselState";
import DumpStrip from "@/components/DumpStrip";
import PhotoPool from "@/components/PhotoPool";
import PhotoLightbox from "@/components/PhotoLightbox";
import PhotoContextMenu from "@/components/PhotoContextMenu";
import FindOriginalSheet from "@/components/FindOriginalSheet";
import DragGhost from "@/components/DragGhost";
import type { Photo } from "@/lib/photoData";
import { Plus, Sparkles, Menu, Users } from "lucide-react";
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
import PhoneGate, { phoneSkipped } from "@/components/PhoneGate";
import PinGate from "@/components/PinGate";
import OnboardingFlow from "@/components/OnboardingFlow";
import NotificationBell from "@/components/NotificationBell";
import { NAV_EVENT } from "@/lib/appNav";
import type { NavTarget } from "@shared/notifications";
import ConnectionsPanel from "@/components/ConnectionsPanel";
import CreditsSheet from "@/components/CreditsSheet";
import BugReportButton from "@/components/BugReportButton";
import CreditsBadge from "@/components/CreditsBadge";
import WelcomeOverlay from "@/components/WelcomeOverlay";
import DemoBanner from "@/components/DemoBanner";
import GuidedTour, { isTourCompleted } from "@/components/GuidedTour";
import OutOfCreditsOverlay from "@/components/OutOfCreditsOverlay";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { loadCaptions, archiveCaptionsByText } from "@/lib/captionPool";
import { findDuplicatePhotoIds, hashMissingPhotos } from "@/lib/photoDupes";
import { downscaleImageFile, HEIC_UNSUPPORTED } from "@/lib/imageDownscale";
import { createLimiter, yieldToUI, isLowMemoryDevice } from "@/lib/uploadQueue";
import { extractPhotoMeta } from "@/lib/exif";
import { syncAIProfileOnSignIn, flushAIProfileSave } from "@/lib/aiProfileSync";
import { loadWorkspace, scheduleWorkspaceSave, flushWorkspaceSave, uploadPhotoToCloud, loadArchivedDumpIds, scheduleArchivedDumpIdsSave, flushArchivedDumpIdsSave, setDumpPublic } from "@/lib/workspaceSync";
import { scanPhotos } from "@/lib/aiLabel";
import { CREDIT_COSTS } from "@/lib/credits";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { track } from "@/lib/analytics";
import { logBug } from "@/lib/bugLogger";
import { saveVideo, listVideos, deleteVideo, setVideoTags, setVideoTrim, notVideo, type VideoMeta } from "@/lib/videoStore";
import VideoSheet from "@/components/VideoSheet";
import LabelHealthSheet, { LabelHealthChip } from "@/components/LabelHealthSheet";
import { useLabelHealth } from "@/hooks/useLabelHealth";

// Category taxonomy mirror (of server/aiLabel.ts CATEGORIES) lives in lib/labelHealth.ts.

// Shared across uploads so two quick selections can't double the memory load.
var LOW_MEM = isLowMemoryDevice();
var photoLimit = createLimiter(LOW_MEM ? 2 : 4);
var uploadLimit = createLimiter(LOW_MEM ? 2 : 4);
var PHOTO_MAX_DIM = LOW_MEM ? 1600 : 2048;
var MAX_PHOTO_BYTES = 40 * 1024 * 1024;

function HomeContent() {
  var {
    dumps, pool, clearDemoContent, replaceState,
    movePhotoWithinDump, movePhotoBetweenDumps,
    movePhotoFromPoolToDump, movePhotoFromDumpToPool,
    removePhotoFromPool, removeMultiplePhotosFromPool, createNewDump, deleteDump,
    toggleFavorite, toggleDumpFavorite, setDumpPublicFlag, addUploadedPhotos, replacePhotoUrl, applyPhotoLabels, renameDump,
    createDumpsFromSuggestions, setDumpCaptions,
    reorderDumpPhotos, setDumpVibe, rateDump, swapPhoto, setDumpChatHistory,
    archivedDumpIds, archiveDump, unarchiveDump, mergeArchivedDumpIds,
    dupeDismissedIds, dismissDuplicate, attachVideos,
  } = useCarouselState();

  // ── Device-only Video Pool ─────────────────────────────────────────────────
  // videos are device-only by owner decision: bytes live in videoStore
  // (IndexedDB) and get a fresh blob: URL each load. Meta (thumb, duration,
  // tags, trim) is kept here, keyed by photo id; blobs are never sent anywhere.
  var [videos, setVideos] = useState<Record<string, VideoMeta>>({});
  var videoUrls = useRef<Record<string, string>>({});
  var [videoSheetId, setVideoSheetId] = useState<string | null>(null);
  useEffect(function() {
    listVideos().then(function(recs) {
      // Runs even with zero records so dead blob: videos from older sessions get dropped.
      var meta: Record<string, VideoMeta> = {};
      var list = recs.map(function(r) {
        var url = URL.createObjectURL(r.blob);
        videoUrls.current[r.id] = url;
        meta[r.id] = r;
        return { id: r.id, url: url, name: r.name };
      });
      setVideos(function(prev) { return Object.assign({}, meta, prev); });
      attachVideos(list);
    });
  }, [attachVideos]);
  var forgetVideos = useCallback(function(ids: string[]) {
    var hit = ids.filter(function(id) { return videoUrls.current[id] || videos[id]; });
    if (hit.length === 0) return;
    for (var i = 0; i < hit.length; i++) {
      void deleteVideo(hit[i]);
      if (videoUrls.current[hit[i]]) URL.revokeObjectURL(videoUrls.current[hit[i]]);
      delete videoUrls.current[hit[i]];
    }
    setVideos(function(prev) {
      var next = Object.assign({}, prev);
      for (var j = 0; j < hit.length; j++) delete next[hit[j]];
      return next;
    });
  }, [videos]);
  var patchVideo = useCallback(function(id: string, patch: Partial<VideoMeta>) {
    setVideos(function(prev) {
      if (!prev[id]) return prev;
      var next = Object.assign({}, prev);
      next[id] = Object.assign({}, prev[id], patch);
      return next;
    });
    if ("tags" in patch) void setVideoTags(id, patch.tags || []);
    if ("trimStart" in patch || "trimEnd" in patch) void setVideoTrim(id, patch.trimStart, patch.trimEnd);
  }, []);

  // Split dumps into the active list (shown up top) and the archived list
  // (collapsed below). Archived dumps stay in `dumps` so nothing is lost.
  var archivedIdSet = useMemo(function() { return new Set(archivedDumpIds); }, [archivedDumpIds]);
  var activeDumps = useMemo(function() { return dumps.filter(function(d) { return !archivedIdSet.has(d.id); }); }, [dumps, archivedIdSet]);
  var archivedDumps = useMemo(function() { return dumps.filter(function(d) { return archivedIdSet.has(d.id); }); }, [dumps, archivedIdSet]);
  var [showArchived, setShowArchived] = useState(false);

  // Archive a dump and tuck away any caption-pool entries it used, so a saved
  // dump and its captions both drop off the active lists in one move.
  var handleArchiveDump = useCallback(function(dumpId: string) {
    if (archivedIdSet.has(dumpId)) {
      unarchiveDump(dumpId);
      toast("Dump restored");
      return;
    }
    var d = dumps.find(function(x) { return x.id === dumpId; });
    archiveDump(dumpId);
    if (d && d.captions && d.captions.length > 0) archiveCaptionsByText(d.captions, dumpId);
    toast("Dump archived");
  }, [dumps, archivedIdSet, archiveDump, unarchiveDump]);

  // Possible-duplicate photo ids, computed across the whole workspace (pool +
  // every dump) so a re-uploaded photo is flagged wherever it sits. EXIF
  // byte-signature matches are instant; perceptual (aHash) matches land a
  // moment later as photos are hashed in the background (catches re-encoded
  // uploads whose bytes differ — mobile Safari does this on every upload).
  var hashCache = useRef<Map<string, string>>(new Map());
  var [hashVersion, setHashVersion] = useState(0);
  var allWorkspacePhotos = useMemo(function() {
    var all = pool.slice();
    for (var i = 0; i < dumps.length; i++) all = all.concat(dumps[i].photos);
    return all;
  }, [pool, dumps]);
  useEffect(function() {
    var cancelled = false;
    hashMissingPhotos(allWorkspacePhotos, hashCache.current).then(function(added) {
      if (added && !cancelled) setHashVersion(function(v) { return v + 1; });
    });
    return function() { cancelled = true; };
  }, [allWorkspacePhotos]);
  var duplicatePhotoIds = useMemo(function() {
    var raw = findDuplicatePhotoIds(allWorkspacePhotos, hashCache.current);
    for (var i = 0; i < dupeDismissedIds.length; i++) raw.delete(dupeDismissedIds[i]);
    return raw;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allWorkspacePhotos, hashVersion, dupeDismissedIds]);

  var { dragState, updateDragPosition, endDrag } = useDrag();

  var [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  var [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  var [contextMenu, setContextMenu] = useState<{
    photo: Photo; position: { x: number; y: number }; dumpId?: string;
  } | null>(null);
  var [menuOpen, setMenuOpen] = useState(false);
  var [connectionsOpen, setConnectionsOpen] = useState(false);
  var [dmTargetId, setDmTargetId] = useState<string | null>(null); // bell tap -> open this friend's thread
  var [poolTab, setPoolTab] = useState<PoolTab>("photos");
  var [captionCount, setCaptionCount] = useState<number>(function() { return loadCaptions().length; });
  // Refresh caption count when the tab changes (in case caps were added)
  useEffect(function() { setCaptionCount(loadCaptions().length); }, [poolTab]);

  // Lock body scroll when any full-screen overlay is open (fixes mobile menu bug)
  useEffect(function() {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.top = "-" + window.scrollY + "px";
    } else {
      var scrollY = document.body.style.top;
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
      window.scrollTo(0, parseInt(scrollY || "0") * -1);
    }
  }, [menuOpen]);
  // Bell taps (see lib/appNav.ts) open the right sheet.
  useEffect(function() {
    function onNav(e: Event) {
      var t = (e as CustomEvent<NavTarget>).detail;
      if (!t) return;
      if (t.to === "connections") setConnectionsOpen(true);
      else if (t.to === "dm") { setDmTargetId(t.userId); setConnectionsOpen(true); }
      else if (t.to === "taste") setMenuOpen(true); // MainMenu listens too and scrolls to the box
      else if (t.to === "credits") setCreditsSheetOpen(true);
    }
    window.addEventListener(NAV_EVENT, onNav);
    return function() { window.removeEventListener(NAV_EVENT, onNav); };
  }, []);
  // Detect if the user has any real (non-stock) photos — uploads OR cloud-synced
  // owner photos (which have UUID ids, not the "upload-" prefix). Used to hide
  // the "Demo photos" banner once real content is present.
  var isRealPhoto = function(p: Photo) { return !p.id.startsWith("stock-"); };
  var hasUserPhotos = pool.some(isRealPhoto)
    || dumps.some(function(d) { return d.photos.some(isRealPhoto); });

  // Scroll to pool and focus the upload area
  var scrollToPoolUpload = useCallback(function() {
    var poolEl = document.getElementById("photo-pool");
    if (poolEl) poolEl.scrollIntoView({ behavior: "smooth", block: "start" });
    // Open the device file picker after scroll settles
    setTimeout(function() {
      var input = document.getElementById("pool-upload-input") as HTMLInputElement | null;
      if (input) input.click();
    }, 380);
  }, []);

  // Guided tour
  var [tourActive, setTourActive] = useState(false);
  var startTour = useCallback(function() { setTourActive(true); }, []);
  var endTour = useCallback(function() { setTourActive(false); }, []);
  // Onboarding -> phone verify -> tour. The tour waits until the optional phone step is verified or skipped.
  var [pendingTour, setPendingTour] = useState(false);
  var [phoneTick, setPhoneTick] = useState(0);

  var [aiSheetOpen, setAiSheetOpen] = useState(false);
  var [igScrubOpen, setIGScrubOpen] = useState(false);
  var [captionSheetOpen, setCaptionSheetOpen] = useState(false);
  var [scanning, setScanning] = useState(false);
  var [findOriginalPhoto, setFindOriginalPhoto] = useState<Photo | null>(null);
  var [captionInitialDumpId, setCaptionInitialDumpId] = useState<string | null>(null);
  var [shareSheetDumpId, setShareSheetDumpId] = useState<string | null>(null);
  var [actionSheetDumpId, setActionSheetDumpId] = useState<string | null>(null);
  var [chatDumpId, setChatDumpId] = useState<string | null>(null);
  var [chatInitialMsg, setChatInitialMsg] = useState<string | null>(null);
  var [recyclePhotoId, setRecyclePhotoId] = useState<string | null>(null);
  var [recycleDumpId, setRecycleDumpId] = useState<string | null>(null);
  var [authSheetOpen, setAuthSheetOpen] = useState(false);
  var [creditsSheetOpen, setCreditsSheetOpen] = useState(false);
  var [outOfCreditsAction, setOutOfCreditsAction] = useState<string | null>(null);
  var [demoBannerVisible, setDemoBannerVisible] = useState(false);
  var { user, profile, canAfford, refreshProfile, totalCredits } = useAuth();
  var labelHealth = useLabelHealth({ photos: allWorkspacePhotos, signedIn: !!user, applyPhotoLabels: applyPhotoLabels });
  var [labelHealthOpen, setLabelHealthOpen] = useState(false);

  // ── AI profile sync — merge captions/taste/rules from cloud on sign-in.
  // Photos and workspace (dumps + pool) are device-local for beta.
  useEffect(function() {
    if (!user) return;
    track("session_start");
    syncAIProfileOnSignIn(user.id).catch(function(err) {
      console.warn("[aiProfileSync] sign-in sync failed:", err);
    });
    // Flush any pending debounced AI-profile save before the tab closes so
    // caption/taste edits made within the 2s window aren't lost.
    var handleUnload = function() { flushAIProfileSave(); };
    window.addEventListener("beforeunload", handleUnload);
    return function() { window.removeEventListener("beforeunload", handleUnload); };
  // Keyed on the id, not the object: Supabase hands back a new `user` object on
  // every token refresh, which re-fired session_start (and the sync) hourly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Cloud photo sync (beta) ────────────────────────────────────────────────
  // On sign-in, pull THIS user's workspace from the DB (RLS scopes to their own
  // rows) so the same photos/dumps show on every device — no special URL needed,
  // just log in. Users with no cloud workspace get null and keep device-local
  // state. Runs once per user; fully fail-safe.
  var workspaceLoadedRef = useRef<string | null>(null);
  useEffect(function () {
    if (!user) return;
    if (workspaceLoadedRef.current === user.id) return;
    workspaceLoadedRef.current = user.id;
    loadWorkspace(user.id).then(function (ws) {
      if (ws) replaceState(ws.dumps, ws.pool);
    }).catch(function () { /* stay device-local */ });
    // Archive state syncs separately (small id list in user_workspaces) so
    // archived dumps stay archived across re-sign-ins and devices.
    loadArchivedDumpIds(user.id).then(function (ids) {
      if (ids) mergeArchivedDumpIds(ids);
    }).catch(function () { /* stay device-local */ });
  }, [user, replaceState, mergeArchivedDumpIds]);

  // Push workspace changes to the cloud (debounced) + flush on tab close.
  useEffect(function () {
    if (!user) return;
    // Skip the very first run so we don't immediately re-save what we just
    // loaded; only edits after mount schedule a save.
    if (workspaceLoadedRef.current !== user.id) return;
    scheduleWorkspaceSave(user.id, dumps, pool);
    var onUnload = function () { flushWorkspaceSave(); };
    window.addEventListener("beforeunload", onUnload);
    return function () { window.removeEventListener("beforeunload", onUnload); };
  }, [user, dumps, pool]);

  // Push archive-state changes (debounced full-list replace, so unarchive
  // propagates too). ponytail: last-write-wins across devices; per-id merge if
  // simultaneous multi-device archiving ever matters.
  useEffect(function () {
    if (!user) return;
    var uid = user.id;
    if (workspaceLoadedRef.current !== uid) return;
    scheduleArchivedDumpIdsSave(uid, archivedDumpIds);
    var onUnload = function () { flushArchivedDumpIdsSave(); };
    window.addEventListener("beforeunload", onUnload);
    return function () { window.removeEventListener("beforeunload", onUnload); };
  }, [user, archivedDumpIds]);

  // ── Clear demo/stock content on sign-in.
  // All users share the same localStorage keys (IS_OWNER is build-time, not
  // per-user), so demo content from browsing as a guest persists into the
  // signed-in session. Clear it once per user ID so a new user starts fresh
  // but keeps any photos they uploaded before signing in.
  var clearedForUserRef = useRef<string | null>(null);
  useEffect(function() {
    if (!user) return;
    if (clearedForUserRef.current === user.id) return;
    clearedForUserRef.current = user.id;
    clearDemoContent();
  }, [user, clearDemoContent]);

  // First-run setup gate — open until the profile carries a completion stamp.
  // Existing accounts were backfilled when the column was added, so only new
  // signups see it.
  var onboardingOpen = !!user && !!profile && !profile.onboarding_completed_at;

  // Start the tour once onboarding is done AND the phone step is resolved (verified or skipped).
  // Also a safety net: a recent account that finished onboarding but never saw the tour (other device/session,
  // or before the per-account flag) gets it on sign-in — once per tab session; Skip/finish marks it done.
  useEffect(function() {
    if (!user || !profile || onboardingOpen || !profile.username || tourActive) return;
    if (!(user.phone || phoneSkipped(user.id))) return; // phone prompt still showing: tour comes right after it
    var start = pendingTour;
    if (!start) {
      if (isTourCompleted()) return;
      var created = profile.created_at ? Date.parse(profile.created_at) : 0;
      if (!created || Date.now() - created > 3 * 24 * 60 * 60 * 1000) return;
      try { if (sessionStorage.getItem("dumpster_tour_auto") === user.id) return; } catch (_) { /* noop */ }
    }
    var uid = user.id;
    var tid = setTimeout(function() {
      try { sessionStorage.setItem("dumpster_tour_auto", uid); } catch (_) { /* noop */ }
      setPendingTour(false); startTour();
    }, 700);
    return function() { clearTimeout(tid); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.phone, profile?.username, profile?.created_at, onboardingOpen, pendingTour, phoneTick]);

  // ── Always keep at least one empty dump visible so users have a target for
  // the "From Pool" / "Add More" twin cards. Without this, a freshly cleared
  // workspace renders as a wall of stats with no upload affordance — beta
  // testers were getting stuck here.
  useEffect(function() {
    // Skip while onboarding is up: this is the "ghost dump" new users were
    // landing on — a blank dump built behind the modal that flashes into view
    // the moment setup closes. Onboarding ends by creating a real dump, so the
    // affordance this effect exists to provide is already covered by then.
    if (onboardingOpen) return;
    // Count only active dumps — if every dump is archived the user still needs
    // a visible target to upload into.
    if (activeDumps.length === 0) {
      createNewDump();
    }
  }, [activeDumps.length, createNewDump, onboardingOpen]);

  /**
   * Credit gate — checks if user can afford an AI action.
   * Returns true if OK to proceed, false if blocked (shows overlay).
   */
  var creditGate = useCallback(function(action: string): boolean {
    // TESTING ESCAPE HATCH: VITE_DISABLE_CREDIT_LIMIT=1 bypasses the client gate
    // so testers can iterate without running out. Server still enforces auth,
    // rate limit, and the $20/day budget circuit breaker.
    if (import.meta.env.VITE_DISABLE_CREDIT_LIMIT === "1") return true;
    if (canAfford(action)) return true;
    setOutOfCreditsAction(action);
    return false;
  }, [canAfford]);
  var [selectionMode, setSelectionMode] = useState(false);
  var [selectionTargetDumpId, setSelectionTargetDumpId] = useState<string | null>(null);
  var [selectedPoolPhotoIds, setSelectedPoolPhotoIds] = useState<string[]>([]);
  var scrollBackRef = useRef<string | null>(null);

  var [deleteMode, setDeleteMode] = useState(false);
  var [selectedDeleteIds, setSelectedDeleteIds] = useState<string[]>([]);

  var handleEnterDeleteMode = useCallback(function() {
    setDeleteMode(true);
    setSelectedDeleteIds([]);
    setSelectedPhotoId(null);
    setContextMenu(null);
    setTimeout(function() {
      var poolEl = document.getElementById("photo-pool");
      if (poolEl) poolEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, []);

  var handleToggleDeleteSelection = useCallback(function(photo: Photo) {
    setSelectedDeleteIds(function(prev) {
      var idx = prev.indexOf(photo.id);
      if (idx >= 0) return prev.filter(function(id) { return id !== photo.id; });
      return prev.concat([photo.id]);
    });
  }, []);

  var handleConfirmDelete = useCallback(function() {
    var count = selectedDeleteIds.length;
    if (count === 0) return;
    removeMultiplePhotosFromPool(selectedDeleteIds);
    forgetVideos(selectedDeleteIds);
    setDeleteMode(false);
    setSelectedDeleteIds([]);
    toast("Deleted " + count + " photo" + (count !== 1 ? "s" : ""));
  }, [selectedDeleteIds, removeMultiplePhotosFromPool, forgetVideos]);

  var handleCancelDeleteMode = useCallback(function() {
    setDeleteMode(false);
    setSelectedDeleteIds([]);
  }, []);

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
    if (photo.category === "Video") setVideoSheetId(photo.id);
    else setLightboxPhoto(photo);
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
      forgetVideos([photoId]);
      toast("Photo removed");
    }
    setSelectedPhotoId(null);
  }, [contextMenu, dumps, movePhotoFromDumpToPool, removePhotoFromPool, forgetVideos]);

  // Inline delete from the Videos view / video sheet — pool only.
  var handleDeleteVideo = useCallback(function(id: string) {
    removePhotoFromPool(id);
    forgetVideos([id]);
    setVideoSheetId(null);
    toast("Video deleted from this device");
  }, [removePhotoFromPool, forgetVideos]);

  // Trimmed copy recorded on-device by VideoSheet → store it as a NEW pool
  // video (original untouched). Device-only, same as any other video.
  var handleTrimmedCopy = useCallback(function(sourceId: string, blob: Blob, duration: number): Promise<string> {
    var src = videos[sourceId];
    var ext = blob.type.indexOf("mp4") >= 0 ? ".mp4" : ".webm";
    var name = (src ? src.name.replace(/\.[^.]+$/, "") : "video") + "-trim" + ext;
    return saveVideo(blob, { id: "upload-" + nanoid(8), name: name, duration: duration, fallbackThumb: src ? src.thumbDataUrl : "" })
      .then(function(rec) {
        var url = URL.createObjectURL(blob);
        videoUrls.current[rec.id] = url;
        setVideos(function(prev) { var n = Object.assign({}, prev); n[rec.id] = rec; return n; });
        addUploadedPhotos([{ id: rec.id, url: url, alt: name, isFavorite: false, category: "Video" }]);
        return name;
      });
  }, [videos, addUploadedPhotos]);

  // Upload photos/videos from device.
  //   Signed-in user: downscale → upload to Supabase Storage → store HTTPS URL.
  //                   Cross-device persistence + workspace JSON stays small.
  //   Guest:          data URL only — works offline but doesn't persist past the tab.
  // Photos are downscaled to ~2048px / JPEG 0.85 first so Claude Vision's
  // 5 MB per-image limit isn't exceeded and Storage egress stays low.
  //
  // Phones freeze/kill the tab if dozens of 12MP photos decode at once, so:
  // photos go through a shared limiter (2 at a time on phones, 4 on desktop),
  // each one decodes → EXIF → yields to the UI, and finished photos stream into
  // the pool every few items while a "Processing 12/40…" toast counts up.
  // Cloud uploads start per streamed batch on their own limiter.
  var [upload, setUpload] = useState<{ done: number; total: number; start: number } | null>(null);
  var handleUploadPhotos = useCallback(function(files: FileList) {
    var list = Array.from(files); // copy — the <input> may be reset after onChange
    var total = list.length;
    if (total === 0) return;

    var toastId = "upload-" + nanoid(6);
    var done = 0, added = 0, failed = 0, heic = 0, tooBig = 0;
    var buffer: Photo[] = [];
    var lastFlush = Date.now();
    var showProgress = total > 1 || list[0].size > 1_500_000;
    var startTs = Date.now();
    if (showProgress) setUpload({ done: 0, total: total, start: startTs });
    if (showProgress) toast.loading("Processing 0/" + total + "…", { id: toastId });

    // Signed-in: push bytes to Storage and swap in the durable HTTPS URL.
    // Retries once; a failure keeps the data URL. Videos never upload.
    function uploadOne(p: Photo) {
      return uploadPhotoToCloud(p.id, p.url)
        .then(function(u) { return u || uploadPhotoToCloud(p.id, p.url); })
        .then(function(u) { if (u) replacePhotoUrl(p.id, u); });
    }

    function flush() {
      if (!buffer.length) return;
      var batch = buffer; buffer = []; lastFlush = Date.now();
      addUploadedPhotos(batch);
      added += batch.length;
      if (!user) return; // guest → stays device-local
      batch.forEach(function(p) {
        if (notVideo(p) && p.url.indexOf("data:") === 0) uploadLimit(function() { return uploadOne(p); });
      });
    }

    function settle(p: Photo | null) {
      done++;
      if (showProgress) setUpload(done < total ? { done: done, total: total, start: startTs } : null);
      if (p) buffer.push(p);
      if (buffer.length >= 4 || Date.now() - lastFlush > 700 || done === total) flush();
      if (done < total) {
        if (showProgress) toast.loading("Processing " + done + "/" + total + "…", { id: toastId });
        return;
      }
      if (added) track("photo_uploaded", { count: added });
      var notes: string[] = [];
      if (heic) notes.push(heic + " HEIC photo" + (heic === 1 ? "" : "s") + " this browser can't open — use Safari or export as JPEG");
      if (tooBig) notes.push(tooBig + " over 40 MB skipped");
      if (failed) notes.push(failed + " couldn't be processed");
      var msg = added
        ? "Added " + added + (added === 1 ? " item" : " items") + " to pool"
        : "Couldn't add " + (total === 1 ? "that file" : "those files");
      if (notes.length) msg += " (" + notes.join("; ") + ")";
      (added ? toast.success : toast.error)(msg, { id: toastId, duration: notes.length ? 8000 : 4000 });
    }

    list.forEach(function(file) {
      var photoId = "upload-" + nanoid(8);
      if (file.type.startsWith("video/")) {
        // videos are device-only by owner decision — saved to IndexedDB
        // (videoStore), never uploaded. saveVideo never rejects. Not limited:
        // no decode happens here.
        saveVideo(file, { id: photoId }).then(function(rec) {
          track("feature_video");
          var url = URL.createObjectURL(file);
          videoUrls.current[photoId] = url;
          setVideos(function(prev) { var n = Object.assign({}, prev); n[photoId] = rec; return n; });
          settle({ id: photoId, url: url, alt: file.name, isFavorite: false, category: "Video" } as Photo);
        }, function() { failed++; settle(null); });
        return;
      }
      if (file.size > MAX_PHOTO_BYTES) { tooBig++; settle(null); return; }
      // ponytail: the limiter IS the queue — huge selections just wait their turn as cheap closures.
      photoLimit(async function() {
        var r = await downscaleImageFile(file, PHOTO_MAX_DIM);
        // EXIF from the ORIGINAL file (downscale strips it), reusing decoded dims.
        var meta = await extractPhotoMeta(file, r.width && r.height ? { w: r.width, h: r.height } : undefined);
        await yieldToUI();
        return { id: photoId, url: r.dataUrl, alt: file.name, isFavorite: false, category: "Uploaded", meta: meta } as Photo;
      }).then(settle, function(e) {
        if (e && e.message === HEIC_UNSUPPORTED) heic++; else failed++;
        settle(null);
      });
    });
  }, [addUploadedPhotos, replacePhotoUrl, user]);

  // Scan pool photos with AI and auto-label them (category + short alt). Only
  // scans photos that haven't been labeled yet ("" or "Uploaded" category) or
  // whose category predates the current taxonomy (e.g. "Object", "Party",
  // "City" — stale values written by the native app's old filename-guessing
  // labeler before it switched to server-side Claude Vision on 2026-07-10);
  // skips videos, and applies labels incrementally as each batch returns.
  // Photos the paid Scan would label — same "needs a label" rule as the Label
  // Health chip (videos already excluded there). Drives the price estimate.
  var scanTargets = useMemo(function() {
    var unlabeledIds = new Set(labelHealth.health.unlabeled.map(function(p) { return p.id; }));
    return pool.filter(function(p) { return notVideo(p) && unlabeledIds.has(p.id); });
  }, [pool, labelHealth.health]);
  var [scanConfirmOpen, setScanConfirmOpen] = useState(false);

  // Scan button → price confirm (paid: 1 credit/photo, see shared/aiLabelCost.ts).
  var handleScanPhotos = useCallback(function() {
    if (scanning) return;
    if (!user) { setAuthSheetOpen(true); toast("Sign in to scan photos"); return; }
    if (scanTargets.length === 0) { toast("All photos are already labeled"); return; }
    setScanConfirmOpen(true);
  }, [scanning, user, scanTargets.length]);

  var runScan = useCallback(function() {
    var toScan = scanTargets;
    if (scanning || toScan.length === 0) return;
    setScanning(true);
    toast("Scanning " + toScan.length + (toScan.length === 1 ? " photo…" : " photos…"));
    var input = toScan.map(function(p) { return { id: p.id, url: p.url }; });
    // scanPhotos → aiFetch (creditSync) updates the credits badge per batch.
    scanPhotos(input, function(labels) { labelHealth.applyAi(labels); })
      .then(function(all) {
        track("photos_scanned", { count: all.length });
        toast("Labeled " + all.length + (all.length === 1 ? " photo" : " photos"));
        refreshProfile();
      })
      .catch(function(e) {
        toast(e && e.message ? e.message : "Scan failed — try again");
      })
      .then(function() { setScanning(false); });
  }, [scanning, scanTargets, labelHealth.applyAi, refreshProfile]);

  // Auto-heal of unlabeled/stale photos (free, quota-bounded) now lives in the
  // Label Health loop — see hooks/useLabelHealth.ts.

  var handleAICreateDumps = useCallback(function(clusters: SuggestedCluster[]) {
    createDumpsFromSuggestions(clusters);
    toast("Created " + clusters.length + " AI-suggested dump" + (clusters.length !== 1 ? "s" : ""));
  }, [createDumpsFromSuggestions]);

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
    <div style={{ minHeight: "100vh", paddingTop: "calc(52px + env(safe-area-inset-top, 0px))" }} onClick={handleBackgroundClick} onTouchEnd={handleBackgroundTouch}>
      {/* Fixed top navbar — paddingTop reserves the iOS status-bar / notch safe
          area so content doesn't render under the clock/battery when launched
          as a standalone home-screen PWA (status bar is black-translucent). */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 52, zIndex: 300,
        background: "rgba(5,5,5,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #1a1a1a",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "env(safe-area-inset-top, 0px) 20px 0",
      }}>
        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.3em", color: "var(--accent)", textTransform: "uppercase" as const }}>
          DUMPSTER
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CreditsBadge
            onCreditsClick={function() { setCreditsSheetOpen(true); }}
            onAuthClick={function() { setAuthSheetOpen(true); }}
          />
          {user && (
            <button
              onClick={function(e) { e.stopPropagation(); setConnectionsOpen(true); }}
              aria-label="Connections"
              style={{
                width: 36, height: 36, borderRadius: 9,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#e8e8e8", transition: "all 0.15s",
              }}
            >
              <Users size={16} />
            </button>
          )}
          {user && <NotificationBell />}
          <button aria-label="Open menu" data-tour="menu-btn"
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
      {/* Dimming overlay when in selection or delete mode */}
      {(selectionMode || deleteMode) && (
        <div id="selection-dimmer" style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", zIndex: 100, pointerEvents: "none",
        }} />
      )}

      {/* ── Two-column layout wrapper ── */}
      <div className="dumpster-layout">
      <div className="dumpster-dumps">

      {/* Header */}
      <header style={{
        maxWidth: "1100px", margin: "0 auto", padding: (demoBannerVisible ? "56px" : "32px") + " 32px 24px",
        borderBottom: "1px solid #1e1e1e", position: "relative",
        zIndex: (selectionMode || deleteMode) ? 50 : "auto",
        opacity: (selectionMode || deleteMode) ? 0.3 : 1, transition: "opacity 0.3s",
        pointerEvents: (selectionMode || deleteMode) ? "none" : "auto",
      }}>
        <div style={{ fontSize: "11px", letterSpacing: "0.25em", textTransform: "uppercase" as const, color: "var(--accent)", marginBottom: "16px", fontWeight: 500 }}>
          Dumpster
        </div>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1, color: "#fff", marginBottom: "16px" }}>
          Build Your <span style={{ color: "var(--accent)" }}>Dumps</span>
        </h1>
        <p style={{ fontSize: "15px", color: "#8a8a8a", maxWidth: "640px", lineHeight: 1.7 }}>
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
                padding: "5px 14px", fontSize: "11px", color: "#8a8a8a", letterSpacing: "0.04em",
              }}>
                <strong style={{ color: "#e8e8e8", fontWeight: 600 }}>{pill.value}</strong> {pill.label}
              </span>
            );
          })}
        </div>
      </header>

      {/* Dump Strips (active, non-archived). AnimatePresence + layout gives
          archiving a "pop" exit (scale/fade out, remaining cards reflow up)
          instead of an instant vanish. */}
      <AnimatePresence initial={false}>
        {activeDumps.map(function(dump) {
          return (
            <motion.div key={dump.id} layout
              exit={{ opacity: 0, scale: 0.85, y: 12 }}
              transition={{ duration: 0.25, ease: "easeIn" }}
              style={{
                position: "relative",
                zIndex: (selectionMode || deleteMode) ? 50 : "auto",
                opacity: (selectionMode || deleteMode) ? 0.3 : 1,
                transition: "opacity 0.3s",
                pointerEvents: (selectionMode || deleteMode) ? "none" : "auto",
              }}>
              <DumpStrip
                dump={dump} selectedPhotoId={selectedPhotoId}
                onSelectPhoto={handleSelectPhoto} onDotsClick={handleDotsClick}
                onDoubleTapPhoto={handleDoubleTapPhoto} onDropPhoto={handleDropOnDump}
                onDeleteDump={!originalDumpIds.includes(dump.id) ? handleDeleteDump : undefined}
                onRenameDump={renameDump} onPlusClick={handlePlusClick}
                onMenuClick={function(dumpId) { setActionSheetDumpId(dumpId); }}
                onCaptionClick={function(dumpId) { if (creditGate("ai_caption")) { setCaptionInitialDumpId(dumpId); setCaptionSheetOpen(true); } }}
                onUploadFromDevice={handleUploadPhotos}
                isCustom={!originalDumpIds.includes(dump.id)}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Archived dumps — collapsed by default so saved dumps stay out of the
          way but remain one tap from being restored. */}
      {archivedDumps.length > 0 && (
        <div style={{
          maxWidth: "1100px", margin: "0 auto 8px", padding: "0 32px",
          position: "relative",
          zIndex: (selectionMode || deleteMode) ? 50 : "auto",
          opacity: (selectionMode || deleteMode) ? 0.3 : 1, transition: "opacity 0.3s",
          pointerEvents: (selectionMode || deleteMode) ? "none" : "auto",
        }}>
          <button
            onClick={function() { setShowArchived(function(v) { return !v; }); }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "transparent", border: "none", cursor: "pointer",
              color: "#8a8a8a", fontSize: "12px", fontWeight: 700, fontFamily: "inherit",
              letterSpacing: "0.08em", textTransform: "uppercase", padding: "8px 0",
            }}
          >
            {showArchived ? "▾" : "▸"} Archived ({archivedDumps.length})
          </button>
          {showArchived && archivedDumps.map(function(dump) {
            return (
              <div key={dump.id} style={{ opacity: 0.85, marginBottom: 8 }}>
                <DumpStrip
                  dump={dump} selectedPhotoId={selectedPhotoId}
                  onSelectPhoto={handleSelectPhoto} onDotsClick={handleDotsClick}
                  onDoubleTapPhoto={handleDoubleTapPhoto} onDropPhoto={handleDropOnDump}
                  onDeleteDump={!originalDumpIds.includes(dump.id) ? handleDeleteDump : undefined}
                  onRenameDump={renameDump} onPlusClick={handlePlusClick}
                  onMenuClick={function(dumpId) { setActionSheetDumpId(dumpId); }}
                  onCaptionClick={function(dumpId) { if (creditGate("ai_caption")) { setCaptionInitialDumpId(dumpId); setCaptionSheetOpen(true); } }}
                  onUploadFromDevice={handleUploadPhotos}
                  isCustom={!originalDumpIds.includes(dump.id)}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{
        maxWidth: "1100px", margin: "0 auto", padding: "0 32px",
        display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center", position: "relative",
        zIndex: (selectionMode || deleteMode) ? 50 : "auto",
        opacity: (selectionMode || deleteMode) ? 0.3 : 1, transition: "opacity 0.3s",
        pointerEvents: (selectionMode || deleteMode) ? "none" : "auto",
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
          <Sparkles size={15} /> Auto Gen
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
      </div>

      </div>{/* end .dumpster-dumps */}

      {/* ── Right column: Pool ── */}
      <aside className="dumpster-pool">
      <div id="photo-pool" style={{ position: "relative", zIndex: (selectionMode || deleteMode) ? 200 : "auto", paddingTop: 16 }}>
        {/* Centered POOL divider — visible only on mobile (hidden on desktop via CSS) */}
        <div className="pool-divider-mobile" style={{
          maxWidth: 1100, margin: "0 auto 18px", padding: "0 32px",
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <div style={{ flex: 1, height: 1, background: "#1e1e1e" }} />
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.35em",
            textTransform: "uppercase" as const, color: "#8a8a8a",
            flexShrink: 0,
          }}>
            POOL
          </div>
          <div style={{ flex: 1, height: 1, background: "#1e1e1e" }} />
        </div>

        <PoolPill
          active={poolTab}
          onChange={function(t) { setPoolTab(t); }}
        />

        {/* Sub-section header — left aligned below pill */}
        <div style={{ maxWidth: 1100, margin: "8px auto 18px", padding: "0 32px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase" as const, color: "var(--accent)", marginBottom: 6 }}>
            {poolTab === "photos" ? "PHOTO POOL" : poolTab === "videos" ? "VIDEO POOL" : "CAPTION POOL"}
          </div>
          <h2 style={{ fontSize: "clamp(20px, 2.5vw, 28px)", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", marginBottom: 4 }}>
            {poolTab === "photos" ? "Available Photos" : poolTab === "videos" ? "Your Videos" : "Caption Library"}
          </h2>
          <div style={{ fontSize: 14, color: "#8a8a8a", fontStyle: "italic" as const }}>
            {poolTab === "photos"
              ? pool.length + " available · " + dumps.reduce(function(s, d) { return s + d.photos.length; }, 0) + " in dumps"
              : poolTab === "videos"
                ? "Videos stay on this device"
                : captionCount + " captions in library"
            }
          </div>
        </div>

        {upload && (
          <div role="status" aria-live="polite" style={{
            position: "fixed", left: 16, right: 16, bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 6000,
            maxWidth: 420, margin: "0 auto", padding: "12px 14px", borderRadius: 14,
            background: "rgba(20,20,20,0.96)", border: "1px solid #2a2a2a", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#e8e8e8", marginBottom: 8 }}>
              <span>{"Adding photos " + upload.done + " of " + upload.total}</span>
              <span style={{ color: "#8a8a8a" }}>
                {upload.done < 2 ? "estimating…" : "about " + Math.max(1, Math.ceil(((Date.now() - upload.start) / upload.done) * (upload.total - upload.done) / 1000)) + "s left"}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "#222", overflow: "hidden" }}>
              <div style={{ height: "100%", width: Math.max(4, Math.round(upload.done / upload.total * 100)) + "%", background: "var(--accent)", transition: "width 0.25s" }} />
            </div>
          </div>
        )}
        {poolTab !== "captions" ? (
          <PhotoPool
            videosOnly={poolTab === "videos"}
            photos={pool}
            dumps={dumps}
            duplicateIds={duplicatePhotoIds}
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
            deleteMode={deleteMode}
            selectedDeleteIds={selectedDeleteIds}
            onEnterDeleteMode={handleEnterDeleteMode}
            onToggleDeleteSelection={handleToggleDeleteSelection}
            onConfirmDelete={handleConfirmDelete}
            onCancelDeleteMode={handleCancelDeleteMode}
            onScan={handleScanPhotos}
            scanning={scanning}
            labelHealthChip={<LabelHealthChip health={labelHealth.health} fix={labelHealth.fix} onOpen={function() { setLabelHealthOpen(true); }} />}
            videos={videos}
            onOpenVideo={function(p) { setVideoSheetId(p.id); }}
            onDeleteVideo={handleDeleteVideo}
            onSetVideoTags={function(id, tags) { patchVideo(id, { tags: tags }); }}
          />
        ) : (
          <CaptionPool />
        )}
      </div>
      </aside>{/* end .dumpster-pool */}
      </div>{/* end .dumpster-layout */}

      {/* Footer \u2014 Privacy/Terms links stay visible on every page load so
          Google's OAuth brand-verification crawler can find them. Without a
          top-level link the verification fails ("homepage doesn't link to
          your privacy policy"). */}
      <footer style={{
        maxWidth: "1100px", margin: "0 auto", padding: "40px 32px",
        textAlign: "center", color: "#8a8a8a", fontSize: "12px", borderTop: "1px solid #1e1e1e",
        display: "flex", flexDirection: "column", gap: 10, alignItems: "center",
      }}>
        <div style={{ color: "#888", letterSpacing: "0.02em" }}>
          Dumpster &middot; Carousel Dump Builder
        </div>
        <nav style={{ display: "flex", gap: 16, color: "#8a8a8a" }}>
          <a href="/privacy" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}>
            Privacy
          </a>
          <a href="/terms" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}>
            Terms
          </a>
          <a href="mailto:axiomonellc@outlook.com" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}>
            Contact
          </a>
        </nav>
        <div style={{ color: "#8a8a8a", fontSize: "11px" }}>
          &copy; {new Date().getFullYear()} Dumpster. All rights reserved.
        </div>
      </footer>

      {/* Overlays */}
      <MainMenu
        open={menuOpen}
        onClose={function() { setMenuOpen(false); }}
        onAISuggest={function() { setAiSheetOpen(true); }}
        onCaptions={function() { if (creditGate("ai_caption")) { setCaptionInitialDumpId(null); setCaptionSheetOpen(true); } }}
        onIGScrub={function() { setIGScrubOpen(true); }}
        onTour={startTour}
        onSignIn={function() { setAuthSheetOpen(true); }}
        onFriends={function() { if (user) setConnectionsOpen(true); else setAuthSheetOpen(true); }}
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
        usedPhotoIds={useMemo(function() {
          var set = new Set<string>();
          for (var i = 0; i < dumps.length; i++) {
            for (var j = 0; j < dumps[i].photos.length; j++) set.add(dumps[i].photos[j].id);
          }
          return set;
        }, [dumps])}
        onOutOfCredits={function() { setOutOfCreditsAction("ai_suggest"); }}
      />
      <DumpActionSheet
        open={actionSheetDumpId !== null}
        dump={actionSheetDumpId ? (dumps.find(function(d) { return d.id === actionSheetDumpId; }) || null) : null}
        onClose={function() { setActionSheetDumpId(null); }}
        onHeart={function(dumpId) { toggleDumpFavorite(dumpId); }}
        onChat={function(dumpId) { if (creditGate("ai_chat")) { setChatInitialMsg(null); setChatDumpId(dumpId); } }}
        onRate={function(dumpId, rating) { rateDump(dumpId, rating); }}
        onThumbsDown={function(dumpId) {
          if (!creditGate("ai_chat")) return;
          setChatInitialMsg("I rated this dump thumbs down. What could be better about it? Ask me what I don't like.");
          setChatDumpId(dumpId);
        }}
        onCaptions={function(dumpId) { if (creditGate("ai_caption")) { setCaptionInitialDumpId(dumpId); setCaptionSheetOpen(true); } }}
        onExport={function(dumpId) { setShareSheetDumpId(dumpId); }}
        onArchive={handleArchiveDump}
        isArchived={actionSheetDumpId ? archivedIdSet.has(actionSheetDumpId) : false}
        onDelete={function(dumpId) { handleDeleteDump(dumpId); }}
        onTogglePublic={user ? function(dumpId, next) {
          setDumpPublicFlag(dumpId, next); // optimistic local update
          setDumpPublic(dumpId, next).then(function(ok) {
            if (!ok) setDumpPublicFlag(dumpId, !next); // revert on failure
          });
        } : undefined}
      />
      <DumpShareSheet
        open={shareSheetDumpId !== null}
        dump={shareSheetDumpId ? (dumps.find(function(d) { return d.id === shareSheetDumpId; }) || null) : null}
        onClose={function() { setShareSheetDumpId(null); }}
        onArchive={handleArchiveDump}
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
        onChatHistoryChange={setDumpChatHistory}
        initialMessage={chatInitialMsg}
      />
      <DragGhost />
      <PhotoLightbox photo={lightboxPhoto} onClose={function() { setLightboxPhoto(null); }} />
      {labelHealthOpen && (
        <LabelHealthSheet
          health={labelHealth.health}
          store={labelHealth.store}
          fix={labelHealth.fix}
          photos={allWorkspacePhotos}
          onClose={function() { setLabelHealthOpen(false); }}
          onRunFix={function() {
            if (!user) { setAuthSheetOpen(true); toast("Sign in to fix labels"); return; }
            void labelHealth.runFix(true);
          }}
          onFixOne={function(p) {
            if (!user) { setAuthSheetOpen(true); return Promise.resolve("Sign in to fix labels"); }
            return labelHealth.fixOne(p);
          }}
          onVerify={labelHealth.verify}
          onEdit={labelHealth.editLabel}
          onToggleAutoFix={labelHealth.setAutoFix}
        />
      )}
      {videoSheetId && videos[videoSheetId] && videoUrls.current[videoSheetId] && (
        <VideoSheet
          video={videos[videoSheetId]}
          url={videoUrls.current[videoSheetId]}
          onClose={function() { setVideoSheetId(null); }}
          onTrim={function(start, end) { patchVideo(videoSheetId!, { trimStart: start, trimEnd: end }); }}
          onTrimmedCopy={function(blob, duration) { return handleTrimmedCopy(videoSheetId!, blob, duration); }}
        />
      )}
      <PhotoContextMenu
        photo={contextMenu ? contextMenu.photo : null}
        position={contextMenu ? contextMenu.position : null}
        dumpId={contextMenu ? contextMenu.dumpId : undefined}
        isDuplicate={Boolean(contextMenu && duplicatePhotoIds.has(contextMenu.photo.id))}
        onClose={function() { setContextMenu(null); setSelectedPhotoId(null); }}
        onRemove={handleRemove}
        onToggleFavorite={toggleFavorite}
        onRecycle={function(photoId, dumpId) { setRecyclePhotoId(photoId); setRecycleDumpId(dumpId); setContextMenu(null); setSelectedPhotoId(null); }}
        onFindOriginal={function(photo) { setFindOriginalPhoto(photo); setContextMenu(null); setSelectedPhotoId(null); }}
        onDismissDuplicate={function(photoId) { dismissDuplicate(photoId); setContextMenu(null); setSelectedPhotoId(null); toast("Won't flag this one again"); }}
      />
      <FindOriginalSheet photo={findOriginalPhoto} onClose={function() { setFindOriginalPhoto(null); }} />
      <RecycleSheet
        open={recyclePhotoId !== null}
        photoId={recyclePhotoId}
        dumpId={recycleDumpId}
        dumps={dumps}
        pool={pool}
        onClose={function() { setRecyclePhotoId(null); setRecycleDumpId(null); }}
        onSwap={function(dumpId, oldPhotoId, newPhotoId) { swapPhoto(dumpId, oldPhotoId, newPhotoId); toast("Photo swapped"); }}
        onOutOfCredits={function() { setOutOfCreditsAction("ai_recycle"); }}
      />
      <WelcomeOverlay onUploadClick={scrollToPoolUpload} onTourClick={startTour} />
      <DemoBanner hasUserPhotos={hasUserPhotos} onUploadClick={scrollToPoolUpload} onVisibilityChange={setDemoBannerVisible} />
      <GuidedTour active={tourActive} onEnd={endTour} />
      {user && !user.phone && !tourActive && <PhoneGate onResolved={function() { setPhoneTick(function(n) { return n + 1; }); }} />}
      {user && user.phone && <PinGate />}
      <AuthSheet open={authSheetOpen} onClose={function() { setAuthSheetOpen(false); }} />
      <OnboardingFlow
        open={onboardingOpen}
        poolCount={pool.length}
        hasUsername={!!profile && !!profile.username}
        userId={user ? user.id : null}
        onUploadPhotos={handleUploadPhotos}
        onAICreateDumps={function() { setAiSheetOpen(true); }}
        onCreateDump={handleCreateDump}
        onDone={function() { refreshProfile(); setPendingTour(true); /* the tour is part of onboarding: always runs, right after the phone step */ }}
      />
      {user && (
        <ConnectionsPanel
          open={connectionsOpen}
          onClose={function() { setConnectionsOpen(false); setDmTargetId(null); }}
          myUserId={user.id}
          openDmUserId={dmTargetId}
        />
      )}
      <CreditsSheet
        open={creditsSheetOpen}
        onClose={function() { setCreditsSheetOpen(false); }}
        onNeedAuth={function() { setCreditsSheetOpen(false); setAuthSheetOpen(true); }}
      />
      {(function() {
        var n = scanTargets.length;
        var cost = n * CREDIT_COSTS.ai_label_per_photo;
        var short = !!user && totalCredits < cost && import.meta.env.VITE_DISABLE_CREDIT_LIMIT !== "1";
        var fx = labelHealth.fix;
        var autoFixFree = labelHealth.store.autoFix && !(fx.kind === "paused" && Date.now() < fx.until);
        return (
          <AlertDialog open={scanConfirmOpen} onOpenChange={setScanConfirmOpen}>
            <AlertDialogContent style={{ background: "#141414", border: "1px solid #2a2a2a", color: "#eee" }}>
              <AlertDialogTitle>{"Scan " + n + " unlabeled " + (n === 1 ? "photo" : "photos") + "?"}</AlertDialogTitle>
              <AlertDialogDescription style={{ color: "#aaa" }}>
                {"This uses " + cost + (cost === 1 ? " credit" : " credits") + " (you have " + totalCredits + ")."}
                {short && <><br /><span style={{ color: "#f87171" }}>{"You need " + (cost - totalCredits) + " more."}</span></>}
                {autoFixFree && <><br />Auto-fix labels photos for free (daily limit applies).</>}
              </AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                {short && <AlertDialogAction onClick={function() { setOutOfCreditsAction("ai_label_per_photo"); }}>Get credits</AlertDialogAction>}
                <AlertDialogAction disabled={short} onClick={runScan}>{"Confirm · " + cost + (cost === 1 ? " credit" : " credits")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}
      <OutOfCreditsOverlay
        open={outOfCreditsAction !== null}
        action={outOfCreditsAction || ""}
        cost={outOfCreditsAction === "ai_label_per_photo" ? scanTargets.length * CREDIT_COSTS.ai_label_per_photo : undefined}
        onClose={function() { setOutOfCreditsAction(null); }}
        onAuthClick={function() { setOutOfCreditsAction(null); setAuthSheetOpen(true); }}
        onProClick={function() { setOutOfCreditsAction(null); setCreditsSheetOpen(true); }}
      />
      <BugReportButton />
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

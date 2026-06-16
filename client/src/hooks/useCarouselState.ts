import { useState, useCallback, useEffect, useRef } from "react";
import { INITIAL_DUMPS, INITIAL_POOL, IS_OWNER, type Dump, type Photo } from "@/lib/photoData";
import { nanoid } from "nanoid";
import type { SuggestedCluster } from "@/components/AISuggestSheet";
import { idbGet, idbSet, idbDel, idbFlush } from "@/lib/localStore";

// ── localStorage persistence ───────────────────────────────────────────────

var SK_DUMPS = IS_OWNER ? "dumpster_state_dumps_owner" : "dumpster_state_dumps_guest";
var SK_POOL  = IS_OWNER ? "dumpster_state_pool_owner" : "dumpster_state_pool_guest";
// Archived dump ids are tracked as a small id list (not a flag on each Dump)
// so the many field-by-field dump reconstructions below can't accidentally drop
// the archived state on a reorder/move.
var SK_ARCHIVED = IS_OWNER ? "dumpster_state_archived_owner" : "dumpster_state_archived_guest";

function loadSaved<T>(key: string): T | null {
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    // Defensively strip null entries that can appear in corrupted localStorage.
    // Without this, pool.some(p => p.id...) throws "null is not an object" on Safari.
    if (Array.isArray(parsed)) {
      var clean = parsed
        .filter(function(item) { return item != null; })
        .map(function(item: unknown) {
          // Also strip null photos nested inside dump objects
          if (item && typeof item === "object" && "photos" in (item as object)) {
            var d = item as { photos: unknown[] };
            return { ...d, photos: (d.photos || []).filter(function(p) { return p != null; }) };
          }
          return item;
        });
      return clean as T;
    }
    return parsed as T;
  } catch { /* corrupted or missing — fall through */ }
  return null;
}

function persist(key: string, value: unknown) {
  // Durable copy → IndexedDB (no ~5 MB cap; survives refresh well past the
  // point where localStorage gives out, so uploaded photos actually stick).
  idbSet(key, value);
  // Fast first-paint cache → localStorage. Best-effort: a QuotaExceededError
  // here is now harmless because IndexedDB holds the authoritative copy, so we
  // no longer warn or lose data — we just keep whatever fit.
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage full — fine, IndexedDB has the full set. */
  }
}

// ── Deep clone helpers ─────────────────────────────────────────────────────

function deepCloneDumps(dumps: Dump[]): Dump[] {
  return dumps.map(function(d) {
    return {
      id: d.id, number: d.number, title: d.title, subtitle: d.subtitle,
      photos: d.photos.map(function(p) {
        return { id: p.id, url: p.url, alt: p.alt, isFavorite: p.isFavorite, category: p.category };
      }),
      captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: d.rating,
      chatHistory: d.chatHistory,
    };
  });
}

function deepClonePool(pool: Photo[]): Photo[] {
  return pool.map(function(p) {
    return { id: p.id, url: p.url, alt: p.alt, isFavorite: p.isFavorite, category: p.category };
  });
}

// ── Hook ───────────────────────────────────────────────────────────────────

import { useAuth } from "@/contexts/AuthContext";

export function useCarouselState() {
  var { user } = useAuth();
  
  var [dumps, rawSetDumps] = useState<Dump[]>(function() {
    var saved = loadSaved<Dump[]>(SK_DUMPS);
    if (saved !== null) return saved;
    // If logged in and not owner, start with empty array — Home.tsx will
    // either load the cloud workspace or call clearDemoContent() on first sign-in.
    if (user && !IS_OWNER) return [];
    return deepCloneDumps(INITIAL_DUMPS);
  });
  var [pool, rawSetPool] = useState<Photo[]>(function() {
    var saved = loadSaved<Photo[]>(SK_POOL);
    if (saved !== null) return saved;
    // If logged in and not owner, start with empty pool
    if (user && !IS_OWNER) return [];
    return deepClonePool(INITIAL_POOL);
  });

  // Ids of dumps the user has archived ("saved" and tucked away). Hidden from
  // the main list; still in `dumps` so their photos/captions aren't lost.
  var [archivedDumpIds, rawSetArchived] = useState<string[]>(function() {
    var saved = loadSaved<string[]>(SK_ARCHIVED);
    return Array.isArray(saved) ? saved : [];
  });

  // Cloud sync (load + debounced save) is orchestrated by Home.tsx via
  // replaceState() and clearDemoContent() so the page can coordinate it with
  // file uploads to Supabase Storage. This hook stays focused on local state.

  // Refs that always track latest state (for beforeunload backup)
  var dumpsRef = useRef(dumps);
  var poolRef = useRef(pool);

  // Gate: until IndexedDB hydration has run, the mount-time fallback effects
  // below must NOT write — otherwise they'd persist the initial (demo/empty)
  // state straight over the durable IndexedDB copy before we get to read it.
  var hydrationDoneRef = useRef(false);

  // Wrapped setters — persist to localStorage synchronously inside the updater
  // so every state change is guaranteed to be saved (no useEffect timing issues)
  var setDumps = useCallback(function(action: Dump[] | ((prev: Dump[]) => Dump[])) {
    rawSetDumps(function(prev) {
      var next = typeof action === "function" ? action(prev) : action;
      persist(SK_DUMPS, next);
      dumpsRef.current = next;
      return next;
    });
  }, []);

  var setPool = useCallback(function(action: Photo[] | ((prev: Photo[]) => Photo[])) {
    rawSetPool(function(prev) {
      var next = typeof action === "function" ? action(prev) : action;
      persist(SK_POOL, next);
      poolRef.current = next;
      return next;
    });
  }, []);

  // Belt-and-suspenders: also persist via useEffect as a fallback. Keep the
  // refs current always, but skip the WRITE until hydration has run so we never
  // clobber the durable IndexedDB copy with the initial state on mount.
  useEffect(function() {
    dumpsRef.current = dumps;
    if (hydrationDoneRef.current) persist(SK_DUMPS, dumps);
  }, [dumps]);
  useEffect(function() {
    poolRef.current = pool;
    if (hydrationDoneRef.current) persist(SK_POOL, pool);
  }, [pool]);

  // Last-resort backup: save on page unload
  useEffect(function() {
    var handleBeforeUnload = function() {
      persist(SK_DUMPS, dumpsRef.current);
      persist(SK_POOL, poolRef.current);
      idbFlush(); // push any debounced IndexedDB writes before the tab dies
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return function() {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // ── IndexedDB hydration ────────────────────────────────────────────────────
  // localStorage gives us an instant (possibly truncated) first paint above.
  // IndexedDB holds the FULL workspace — including photos that overflowed the
  // ~5 MB localStorage cap — so on mount we adopt its copy. First run on a
  // device (IDB empty) migrates the current state in. Fully fail-safe: if IDB
  // is unavailable both reads resolve null and we keep the localStorage state.
  var hydratedRef = useRef(false);
  useEffect(function() {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    var initialDumps = dumpsRef.current;
    var initialPool = poolRef.current;
    Promise.all([idbGet<Dump[]>(SK_DUMPS), idbGet<Photo[]>(SK_POOL)]).then(function(res) {
      var idbDumps = res[0];
      var idbPool = res[1];
      if (idbDumps == null && idbPool == null) {
        // No durable copy yet — seed IndexedDB (+ localStorage cache) from
        // whatever we loaded, then let normal persistence take over.
        persist(SK_DUMPS, initialDumps);
        persist(SK_POOL, initialPool);
        hydrationDoneRef.current = true;
        return;
      }
      // Only adopt the durable copy if nothing has mutated state since mount
      // (a cloud load, demo-clear, or fresh upload landing first must win —
      // reference identity changes on any setDumps/setPool).
      if (dumpsRef.current === initialDumps && poolRef.current === initialPool) {
        var nextDumps = idbDumps != null ? idbDumps : initialDumps;
        var nextPool = idbPool != null ? idbPool : initialPool;
        rawSetDumps(nextDumps);
        rawSetPool(nextPool);
        dumpsRef.current = nextDumps;
        poolRef.current = nextPool;
        // Refresh the localStorage cache best-effort (may be partial — fine).
        persist(SK_DUMPS, nextDumps);
        persist(SK_POOL, nextPool);
      }
      // Hydration has run — re-enable the fallback persist effects either way.
      hydrationDoneRef.current = true;
    }).catch(function() {
      hydrationDoneRef.current = true; // don't strand persistence on an IDB error
    });
  }, []);

  var resetAll = useCallback(function() {
    var freshDumps = deepCloneDumps(INITIAL_DUMPS);
    var freshPool = deepClonePool(INITIAL_POOL);
    rawSetDumps(freshDumps);
    rawSetPool(freshPool);
    dumpsRef.current = freshDumps;
    poolRef.current = freshPool;
    try {
      localStorage.removeItem(SK_DUMPS);
      localStorage.removeItem(SK_POOL);
    } catch {}
    // Clear the durable copy too, else the next mount re-hydrates old photos.
    void idbDel(SK_DUMPS);
    void idbDel(SK_POOL);
  }, []);

  // Replace entire state at once — used by cloud sync to load saved state.
  // Locally-uploaded photos (data URLs) that the cloud doesn't know about are
  // preserved in the pool so a cloud load never silently wipes them.
  var replaceState = useCallback(function(newDumps: Dump[], newPool: Photo[]) {
    var cloudIds = new Set<string>();
    var ci: number, cj: number;
    for (ci = 0; ci < newPool.length; ci++) cloudIds.add(newPool[ci].id);
    for (ci = 0; ci < newDumps.length; ci++) {
      for (cj = 0; cj < newDumps[ci].photos.length; cj++) cloudIds.add(newDumps[ci].photos[cj].id);
    }
    var localOnly = poolRef.current.filter(function(p) {
      return p.url.startsWith("data:") && !cloudIds.has(p.id);
    });
    var mergedPool = localOnly.length > 0 ? newPool.concat(localOnly) : newPool;
    rawSetDumps(newDumps);
    rawSetPool(mergedPool);
    persist(SK_DUMPS, newDumps);
    persist(SK_POOL, mergedPool);
    dumpsRef.current = newDumps;
    poolRef.current = mergedPool;
  }, []);

  // Clear demo/stock content — gives authenticated users a clean slate.
  // Keeps any user-uploaded photos (id starts with "upload-"), removes stock ones.
  var clearDemoContent = useCallback(function() {
    // Owner mode's seeded content IS the owner's real content — never strip it
    // on sign-in. The owner's CloudFront photos aren't "upload-" prefixed, so
    // without this guard the cleanup wipes them and leaves an empty pool.
    if (IS_OWNER) return;
    // Remove ONLY the seeded demo/sample photos (id starts with "stock-").
    // Everything a user actually brought in — uploads, IG scrapes, any
    // non-stock photo — is kept, so signing in NEVER deletes real content.
    function isDemoSeed(id: string) { return id.startsWith("stock-"); }
    rawSetDumps(function(prev) {
      var kept = prev.map(function(d) {
        return {
          id: d.id, number: d.number, title: d.title, subtitle: d.subtitle,
          photos: d.photos.filter(function(p) { return !isDemoSeed(p.id); }),
          captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: d.rating,
          chatHistory: d.chatHistory,
        };
      }).filter(function(d) { return d.photos.length > 0; });
      persist(SK_DUMPS, kept);
      dumpsRef.current = kept;
      return kept;
    });
    rawSetPool(function(prev) {
      var kept = prev.filter(function(p) { return !isDemoSeed(p.id); });
      persist(SK_POOL, kept);
      poolRef.current = kept;
      return kept;
    });
  }, []);

  var movePhotoWithinDump = useCallback(function(dumpId: string, fromIndex: number, toIndex: number) {
    setDumps(function(prev) {
      return prev.map(function(d) {
        if (d.id !== dumpId) return d;
        var photos = d.photos.slice();
        var moved = photos.splice(fromIndex, 1)[0];
        photos.splice(toIndex, 0, moved);
        return { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: photos, captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: d.rating, chatHistory: d.chatHistory };
      });
    });
  }, []);

  var movePhotoBetweenDumps = useCallback(function(fromDumpId: string, fromIndex: number, toDumpId: string, toIndex: number) {
    setDumps(function(prev) {
      var fromDump: Dump | null = null;
      var toDump: Dump | null = null;
      for (var i = 0; i < prev.length; i++) {
        if (prev[i].id === fromDumpId) fromDump = prev[i];
        if (prev[i].id === toDumpId) toDump = prev[i];
      }
      if (!fromDump || !toDump) return prev;
      if (toDump.photos.length >= 20) return prev;
      var photo = fromDump.photos[fromIndex];
      return prev.map(function(d) {
        if (d.id === fromDumpId) {
          return { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: d.photos.filter(function(_, i) { return i !== fromIndex; }), captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: d.rating, chatHistory: d.chatHistory };
        }
        if (d.id === toDumpId) {
          var photos = d.photos.slice();
          photos.splice(toIndex, 0, photo);
          return { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: photos, captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: d.rating, chatHistory: d.chatHistory };
        }
        return d;
      });
    });
  }, []);

  var movePhotoFromPoolToDump = useCallback(function(photoId: string, dumpId: string, toIndex: number) {
    setPool(function(prev) {
      var photo: Photo | null = null;
      for (var i = 0; i < prev.length; i++) {
        if (prev[i].id === photoId) { photo = prev[i]; break; }
      }
      if (!photo) return prev;
      var capturedPhoto = photo;
      setDumps(function(prevDumps) {
        return prevDumps.map(function(d) {
          if (d.id !== dumpId) return d;
          if (d.photos.length >= 20) return d;
          var photos = d.photos.slice();
          photos.splice(toIndex, 0, capturedPhoto);
          return { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: photos, captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: d.rating, chatHistory: d.chatHistory };
        });
      });
      return prev.filter(function(p) { return p.id !== photoId; });
    });
  }, []);

  var movePhotoFromDumpToPool = useCallback(function(dumpId: string, photoIndex: number) {
    setDumps(function(prev) {
      var dump: Dump | null = null;
      for (var i = 0; i < prev.length; i++) {
        if (prev[i].id === dumpId) { dump = prev[i]; break; }
      }
      if (!dump) return prev;
      var photo = dump.photos[photoIndex];
      setPool(function(prevPool) { return prevPool.concat([photo]); });
      return prev.map(function(d) {
        if (d.id !== dumpId) return d;
        return { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: d.photos.filter(function(_, i) { return i !== photoIndex; }), captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: d.rating, chatHistory: d.chatHistory };
      });
    });
  }, []);

  var removePhotoFromPool = useCallback(function(photoId: string) {
    setPool(function(prev) { return prev.filter(function(p) { return p.id !== photoId; }); });
  }, []);

  var removeMultiplePhotosFromPool = useCallback(function(photoIds: string[]) {
    var idSet = new Set(photoIds);
    setPool(function(prev) { return prev.filter(function(p) { return !idSet.has(p.id); }); });
  }, []);

  var createNewDump = useCallback(function() {
    setDumps(function(prev) {
      var newNum = prev.length + 1;
      return prev.concat([{
        id: "dump-" + nanoid(6),
        number: newNum,
        title: "New Dump " + newNum,
        subtitle: "Tap + to add photos",
        photos: [],
      }]);
    });
  }, []);

  var deleteDump = useCallback(function(dumpId: string) {
    setDumps(function(prev) {
      var dump: Dump | null = null;
      for (var i = 0; i < prev.length; i++) {
        if (prev[i].id === dumpId) { dump = prev[i]; break; }
      }
      if (!dump) return prev;
      var dumpPhotos = dump.photos.slice();
      setPool(function(prevPool) { return prevPool.concat(dumpPhotos); });
      // Drop any archive marker for the deleted dump so the set can't leak ids.
      setArchived(function(prevIds) { return prevIds.filter(function(id) { return id !== dumpId; }); });
      return prev.filter(function(d) { return d.id !== dumpId; }).map(function(d, i) {
        return { id: d.id, number: i + 1, title: d.title, subtitle: d.subtitle, photos: d.photos, captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: d.rating, chatHistory: d.chatHistory };
      });
    });
  }, []);

  var toggleFavorite = useCallback(function(photoId: string) {
    setDumps(function(prev) {
      return prev.map(function(d) {
        return {
          id: d.id, number: d.number, title: d.title, subtitle: d.subtitle,
          captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: d.rating,
          photos: d.photos.map(function(p) {
            return p.id === photoId ? { id: p.id, url: p.url, alt: p.alt, isFavorite: !p.isFavorite, category: p.category } : p;
          }),
        };
      });
    });
    setPool(function(prev) {
      return prev.map(function(p) {
        return p.id === photoId ? { id: p.id, url: p.url, alt: p.alt, isFavorite: !p.isFavorite, category: p.category } : p;
      });
    });
  }, []);

  var addUploadedPhotos = useCallback(function(newPhotos: Photo[]) {
    setPool(function(prev) { return prev.concat(newPhotos); });
  }, []);

  // Swap a single photo's url in place (pool or any dump) — used after a photo's
  // bytes are uploaded to cloud Storage so its data URL becomes a durable HTTPS
  // URL without changing its position. No-op if the photo isn't found.
  var replacePhotoUrl = useCallback(function(photoId: string, url: string) {
    setPool(function(prev) {
      var hit = false;
      var next = prev.map(function(p) {
        if (p.id === photoId) { hit = true; return { ...p, url: url }; }
        return p;
      });
      return hit ? next : prev;
    });
    setDumps(function(prev) {
      var changed = false;
      var next = prev.map(function(d) {
        var dHit = false;
        var photos = d.photos.map(function(p) {
          if (p.id === photoId) { dHit = true; return { ...p, url: url }; }
          return p;
        });
        if (dHit) { changed = true; return { ...d, photos: photos }; }
        return d;
      });
      return changed ? next : prev;
    });
  }, []);

  var renameDump = useCallback(function(dumpId: string, title: string) {
    setDumps(function(prev) {
      return prev.map(function(d) {
        return d.id === dumpId ? { ...d, title: title } : d;
      });
    });
  }, []);

  var setDumpCaptions = useCallback(function(dumpId: string, captions: string[], vibe: string) {
    setDumps(function(prev) {
      return prev.map(function(d) {
        return d.id === dumpId ? { ...d, captions: captions, vibe: vibe } : d;
      });
    });
  }, []);

  var toggleDumpFavorite = useCallback(function(dumpId: string) {
    setDumps(function(prev) {
      return prev.map(function(d) {
        return d.id === dumpId ? { ...d, favorited: !d.favorited } : d;
      });
    });
  }, []);

  // Create dumps from AI suggestions — moves photos from pool into new dumps
  var createDumpsFromSuggestions = useCallback(function(clusters: SuggestedCluster[]) {
    setPool(function(prevPool) {
      // Build a lookup of remaining pool photos
      var poolMap: Record<string, Photo> = {};
      for (var i = 0; i < prevPool.length; i++) {
        poolMap[prevPool[i].id] = prevPool[i];
      }

      var newDumps: Dump[] = [];
      var usedIds = new Set<string>();

      for (var ci = 0; ci < clusters.length; ci++) {
        var cluster = clusters[ci];
        var photos: Photo[] = [];
        for (var pi = 0; pi < cluster.photoIds.length; pi++) {
          var id = cluster.photoIds[pi];
          if (poolMap[id] && !usedIds.has(id)) {
            photos.push(poolMap[id]);
            usedIds.add(id);
          }
        }
        if (photos.length === 0) continue;
        newDumps.push({
          id: "dump-ai-" + nanoid(6),
          number: 0, // will be renumbered below
          title: cluster.name,
          subtitle: cluster.subtitle,
          photos: photos,
        });
      }

      // Merge new dumps into state
      setDumps(function(prevDumps) {
        var combined = prevDumps.concat(newDumps).map(function(d, i) {
          return { id: d.id, number: i + 1, title: d.title, subtitle: d.subtitle, photos: d.photos, captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: d.rating, chatHistory: d.chatHistory };
        });
        return combined;
      });

      // Remove used photos from pool
      return prevPool.filter(function(p) { return !usedIds.has(p.id); });
    });
  }, []);

  // Reorder photos in a dump by a new ordered list of photo IDs
  var reorderDumpPhotos = useCallback(function(dumpId: string, orderedIds: string[]) {
    setDumps(function(prev) {
      return prev.map(function(d) {
        if (d.id !== dumpId) return d;
        var photoMap: Record<string, typeof d.photos[0]> = {};
        for (var i = 0; i < d.photos.length; i++) {
          photoMap[d.photos[i].id] = d.photos[i];
        }
        var reordered = [];
        for (var j = 0; j < orderedIds.length; j++) {
          if (photoMap[orderedIds[j]]) reordered.push(photoMap[orderedIds[j]]);
        }
        // Append any photos not in the ordered list (safety net)
        for (var k = 0; k < d.photos.length; k++) {
          var found = false;
          for (var m = 0; m < reordered.length; m++) {
            if (reordered[m].id === d.photos[k].id) { found = true; break; }
          }
          if (!found) reordered.push(d.photos[k]);
        }
        return { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: reordered, captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: d.rating, chatHistory: d.chatHistory };
      });
    });
  }, []);

  // Update just the vibe tag on a dump
  var setDumpVibe = useCallback(function(dumpId: string, vibe: string) {
    setDumps(function(prev) {
      return prev.map(function(d) {
        return d.id === dumpId ? { ...d, vibe: vibe } : d;
      });
    });
  }, []);

  // Persist Valet chat history on the dump itself so it syncs cross-device
  // alongside the dump (workspace JSON carries it). Caller (DumpChatSheet)
  // also writes to localStorage as a low-latency cache.
  var setDumpChatHistory = useCallback(function(dumpId: string, chatHistory: import("@/lib/photoData").ChatHistoryEntry[]) {
    setDumps(function(prev) {
      return prev.map(function(d) {
        return d.id === dumpId ? { ...d, chatHistory: chatHistory } : d;
      });
    });
  }, []);

  // Swap one dump photo for a pool photo (recycle) — keeps the same position
  /**
   * Swap a photo in a dump with one from the pool.
   *
   * Implementation note: the previous version nested setDumps inside setPool
   * and read dumpsRef.current at an ambiguous point in the lifecycle, leaving
   * a stale-closure bug. Cleaner approach: do all lookups up-front via refs
   * (always current), then dispatch two independent state updates. React
   * batches them automatically so the user sees a single re-render.
   */
  var swapPhoto = useCallback(function(dumpId: string, oldPhotoId: string, newPhotoId: string) {
    var currentDumps = dumpsRef.current;
    var currentPool  = poolRef.current;

    // Find the incoming pool photo
    var newPhoto: Photo | null = null;
    for (var i = 0; i < currentPool.length; i++) {
      if (currentPool[i].id === newPhotoId) { newPhoto = currentPool[i]; break; }
    }
    if (!newPhoto) return;

    // Find the outgoing dump photo
    var targetDump = null as Dump | null;
    var oldPhoto: Photo | null = null;
    for (var di = 0; di < currentDumps.length; di++) {
      if (currentDumps[di].id === dumpId) {
        targetDump = currentDumps[di];
        for (var pi = 0; pi < targetDump.photos.length; pi++) {
          if (targetDump.photos[pi].id === oldPhotoId) { oldPhoto = targetDump.photos[pi]; break; }
        }
        break;
      }
    }
    if (!targetDump || !oldPhoto) return;

    // Capture for callbacks (TS narrowing inside setX callbacks doesn't carry).
    var inPhoto: Photo  = newPhoto;
    var outPhoto: Photo = oldPhoto;

    // Update dump: replace oldPhoto with newPhoto in-place
    setDumps(function(prev) {
      return prev.map(function(d) {
        if (d.id !== dumpId) return d;
        return {
          id: d.id, number: d.number, title: d.title, subtitle: d.subtitle,
          photos: d.photos.map(function(p) { return p.id === oldPhotoId ? inPhoto : p; }),
          captions: d.captions, vibe: d.vibe, favorited: d.favorited,
          rating: d.rating, chatHistory: d.chatHistory,
        };
      });
    });

    // Update pool: remove newPhoto, append oldPhoto
    setPool(function(prev) {
      return prev.filter(function(p) { return p.id !== newPhotoId; }).concat([outPhoto]);
    });
  }, []);

  // ── Archive ────────────────────────────────────────────────────────────────
  // "After I save photos … archive the dump." Archiving hides a finished dump
  // from the main list without deleting it; the user can restore it any time.
  var setArchived = useCallback(function(action: string[] | ((prev: string[]) => string[])) {
    rawSetArchived(function(prev) {
      var next = typeof action === "function" ? (action as (p: string[]) => string[])(prev) : action;
      persist(SK_ARCHIVED, next);
      return next;
    });
  }, []);

  var archiveDump = useCallback(function(dumpId: string) {
    setArchived(function(prev) { return prev.indexOf(dumpId) === -1 ? prev.concat([dumpId]) : prev; });
  }, [setArchived]);

  var unarchiveDump = useCallback(function(dumpId: string) {
    setArchived(function(prev) { return prev.filter(function(id) { return id !== dumpId; }); });
  }, [setArchived]);

  // Rate a dump thumbs up/down (or clear)
  var rateDump = useCallback(function(dumpId: string, rating: "up" | "down" | null) {
    setDumps(function(prev) {
      return prev.map(function(d) {
        return d.id === dumpId ? { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: d.photos, captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: rating } : d;
      });
    });
  }, []);

  return {
    dumps, pool, resetAll, clearDemoContent, replaceState,
    movePhotoWithinDump, movePhotoBetweenDumps,
    movePhotoFromPoolToDump, movePhotoFromDumpToPool,
    removePhotoFromPool, removeMultiplePhotosFromPool, createNewDump, deleteDump,
    toggleFavorite, toggleDumpFavorite, addUploadedPhotos, replacePhotoUrl, renameDump,
    createDumpsFromSuggestions, setDumpCaptions,
    reorderDumpPhotos, setDumpVibe, rateDump, swapPhoto,
    setDumpChatHistory,
    archivedDumpIds, archiveDump, unarchiveDump,
  };
}

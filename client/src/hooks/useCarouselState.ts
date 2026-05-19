import { useState, useCallback, useEffect, useRef } from "react";
import { INITIAL_DUMPS, INITIAL_POOL, CLEAN_SLATE_DUMPS, type Dump, type Photo } from "@/lib/photoData";
import { nanoid } from "nanoid";
import type { SuggestedCluster } from "@/components/AISuggestSheet";

// ── localStorage persistence ───────────────────────────────────────────────

import { IS_OWNER } from "@/lib/photoData";

var SK_DUMPS = IS_OWNER ? "dumpster_state_dumps_owner" : "dumpster_state_dumps_guest";
var SK_POOL  = IS_OWNER ? "dumpster_state_pool_owner" : "dumpster_state_pool_guest";

function loadSaved<T>(key: string): T | null {
  try {
    var raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* corrupted or missing — fall through */ }
  return null;
}

function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("[Dumpster] localStorage write failed for " + key + ":", e);
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
    // If logged in and not owner, start with clean slate
    if (user && !IS_OWNER) return deepCloneDumps(CLEAN_SLATE_DUMPS);
    return deepCloneDumps(INITIAL_DUMPS);
  });
  var [pool, rawSetPool] = useState<Photo[]>(function() {
    var saved = loadSaved<Photo[]>(SK_POOL);
    if (saved !== null) return saved;
    // If logged in and not owner, start with empty pool
    if (user && !IS_OWNER) return [];
    return deepClonePool(INITIAL_POOL);
  });

  // Handle login/logout state changes for defaults
  useEffect(function() {
    var savedDumps = loadSaved<Dump[]>(SK_DUMPS);
    var savedPool = loadSaved<Photo[]>(SK_POOL);
    
    if (savedDumps === null) {
      if (user && !IS_OWNER) {
        rawSetDumps(deepCloneDumps(CLEAN_SLATE_DUMPS));
      } else {
        rawSetDumps(deepCloneDumps(INITIAL_DUMPS));
      }
    }
    
    if (savedPool === null) {
      if (user && !IS_OWNER) {
        rawSetPool([]);
      } else {
        rawSetPool(deepClonePool(INITIAL_POOL));
      }
    }
  }, [user]);

  // Refs that always track latest state (for beforeunload backup)
  var dumpsRef = useRef(dumps);
  var poolRef = useRef(pool);

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

  // Belt-and-suspenders: also persist via useEffect as a fallback
  useEffect(function() {
    persist(SK_DUMPS, dumps);
    dumpsRef.current = dumps;
  }, [dumps]);
  useEffect(function() {
    persist(SK_POOL, pool);
    poolRef.current = pool;
  }, [pool]);

  // Last-resort backup: save on page unload
  useEffect(function() {
    var handleBeforeUnload = function() {
      persist(SK_DUMPS, dumpsRef.current);
      persist(SK_POOL, poolRef.current);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return function() {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  var resetAll = useCallback(function() {
    rawSetDumps(deepCloneDumps(INITIAL_DUMPS));
    rawSetPool(deepClonePool(INITIAL_POOL));
    try {
      localStorage.removeItem(SK_DUMPS);
      localStorage.removeItem(SK_POOL);
    } catch {}
  }, []);

  var movePhotoWithinDump = useCallback(function(dumpId: string, fromIndex: number, toIndex: number) {
    setDumps(function(prev) {
      return prev.map(function(d) {
        if (d.id !== dumpId) return d;
        var photos = d.photos.slice();
        var moved = photos.splice(fromIndex, 1)[0];
        photos.splice(toIndex, 0, moved);
        return { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: photos, captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: d.rating };
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
          return { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: d.photos.filter(function(_, i) { return i !== fromIndex; }), captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: d.rating };
        }
        if (d.id === toDumpId) {
          var photos = d.photos.slice();
          photos.splice(toIndex, 0, photo);
          return { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: photos, captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: d.rating };
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
          return { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: photos, captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: d.rating };
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
        return { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: d.photos.filter(function(_, i) { return i !== photoIndex; }), captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: d.rating };
      });
    });
  }, []);

  var removePhotoFromPool = useCallback(function(photoId: string) {
    setPool(function(prev) { return prev.filter(function(p) { return p.id !== photoId; }); });
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
      return prev.filter(function(d) { return d.id !== dumpId; }).map(function(d, i) {
        return { id: d.id, number: i + 1, title: d.title, subtitle: d.subtitle, photos: d.photos, captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: d.rating };
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

  var renameDump = useCallback(function(dumpId: string, title: string) {
    setDumps(function(prev) {
      return prev.map(function(d) {
        return d.id === dumpId ? { id: d.id, number: d.number, title: title, subtitle: d.subtitle, photos: d.photos, captions: d.captions, vibe: d.vibe, favorited: d.favorited } : d;
      });
    });
  }, []);

  var setDumpCaptions = useCallback(function(dumpId: string, captions: string[], vibe: string) {
    setDumps(function(prev) {
      return prev.map(function(d) {
        return d.id === dumpId ? { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: d.photos, captions: captions, vibe: vibe, favorited: d.favorited } : d;
      });
    });
  }, []);

  var toggleDumpFavorite = useCallback(function(dumpId: string) {
    setDumps(function(prev) {
      return prev.map(function(d) {
        return d.id === dumpId ? { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: d.photos, captions: d.captions, vibe: d.vibe, favorited: !d.favorited, rating: d.rating } : d;
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
          return { id: d.id, number: i + 1, title: d.title, subtitle: d.subtitle, photos: d.photos, captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: d.rating };
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
        return { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: reordered, captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: d.rating };
      });
    });
  }, []);

  // Update just the vibe tag on a dump
  var setDumpVibe = useCallback(function(dumpId: string, vibe: string) {
    setDumps(function(prev) {
      return prev.map(function(d) {
        return d.id === dumpId ? { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: d.photos, captions: d.captions, vibe: vibe, favorited: d.favorited } : d;
      });
    });
  }, []);

  // Swap one dump photo for a pool photo (recycle) — keeps the same position
  var swapPhoto = useCallback(function(dumpId: string, oldPhotoId: string, newPhotoId: string) {
    setPool(function(prevPool) {
      var newPhoto: Photo | null = null;
      for (var i = 0; i < prevPool.length; i++) {
        if (prevPool[i].id === newPhotoId) { newPhoto = prevPool[i]; break; }
      }
      if (!newPhoto) return prevPool;
      var capturedNewPhoto = newPhoto;
      setDumps(function(prevDumps) {
        return prevDumps.map(function(d) {
          if (d.id !== dumpId) return d;
          var oldPhoto: Photo | null = null;
          var idx = -1;
          for (var j = 0; j < d.photos.length; j++) {
            if (d.photos[j].id === oldPhotoId) { oldPhoto = d.photos[j]; idx = j; break; }
          }
          if (!oldPhoto || idx < 0) return d;
          // Put old photo back to pool (via outer setPool return)
          var photos = d.photos.slice();
          photos[idx] = capturedNewPhoto;
          return { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: photos, captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: d.rating };
        });
      });
      // Find the old photo to put back in pool
      var oldPhotoObj: Photo | null = null;
      // We need to find it from the current dumps state — but we're inside setPool so we use the dumps from closure
      // Actually we need to search the dumps. Let's look it up.
      // Since setDumps was just called (queued), we read from dumpsRef
      var currentDumps = dumpsRef.current;
      for (var di = 0; di < currentDumps.length; di++) {
        if (currentDumps[di].id === dumpId) {
          for (var pi = 0; pi < currentDumps[di].photos.length; pi++) {
            if (currentDumps[di].photos[pi].id === oldPhotoId) {
              oldPhotoObj = currentDumps[di].photos[pi];
              break;
            }
          }
          break;
        }
      }
      if (oldPhotoObj) {
        return prevPool.filter(function(p) { return p.id !== newPhotoId; }).concat([oldPhotoObj]);
      }
      return prevPool.filter(function(p) { return p.id !== newPhotoId; });
    });
  }, []);

  // Rate a dump thumbs up/down (or clear)
  var rateDump = useCallback(function(dumpId: string, rating: "up" | "down" | null) {
    setDumps(function(prev) {
      return prev.map(function(d) {
        return d.id === dumpId ? { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: d.photos, captions: d.captions, vibe: d.vibe, favorited: d.favorited, rating: rating } : d;
      });
    });
  }, []);

  return {
    dumps, pool, resetAll,
    movePhotoWithinDump, movePhotoBetweenDumps,
    movePhotoFromPoolToDump, movePhotoFromDumpToPool,
    removePhotoFromPool, createNewDump, deleteDump,
    toggleFavorite, toggleDumpFavorite, addUploadedPhotos, renameDump,
    createDumpsFromSuggestions, setDumpCaptions,
    reorderDumpPhotos, setDumpVibe, rateDump, swapPhoto,
  };
}

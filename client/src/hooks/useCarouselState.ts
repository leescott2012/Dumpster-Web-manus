import { useState, useCallback } from "react";
import { INITIAL_DUMPS, INITIAL_POOL, type Dump, type Photo } from "@/lib/photoData";
import { nanoid } from "nanoid";

// Deep clone that works in all browsers (no JSON.parse/stringify)
function deepCloneDumps(dumps: Dump[]): Dump[] {
  return dumps.map(function(d) {
    return {
      id: d.id,
      number: d.number,
      title: d.title,
      subtitle: d.subtitle,
      photos: d.photos.map(function(p) {
        return {
          id: p.id,
          url: p.url,
          alt: p.alt,
          isHuji: p.isHuji,
          category: p.category,
          role: p.role,
        };
      }),
    };
  });
}

function deepClonePool(pool: Photo[]): Photo[] {
  return pool.map(function(p) {
    return {
      id: p.id,
      url: p.url,
      alt: p.alt,
      isHuji: p.isHuji,
      category: p.category,
      role: p.role,
    };
  });
}

export function useCarouselState() {
  const [dumps, setDumps] = useState<Dump[]>(function() {
    return deepCloneDumps(INITIAL_DUMPS);
  });
  const [pool, setPool] = useState<Photo[]>(function() {
    return deepClonePool(INITIAL_POOL);
  });

  const resetAll = useCallback(function() {
    setDumps(deepCloneDumps(INITIAL_DUMPS));
    setPool(deepClonePool(INITIAL_POOL));
  }, []);

  const movePhotoWithinDump = useCallback(
    function(dumpId: string, fromIndex: number, toIndex: number) {
      setDumps(function(prev) {
        return prev.map(function(d) {
          if (d.id !== dumpId) return d;
          var photos = d.photos.slice();
          var moved = photos.splice(fromIndex, 1)[0];
          photos.splice(toIndex, 0, moved);
          return { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: photos };
        });
      });
    },
    []
  );

  const movePhotoBetweenDumps = useCallback(
    function(fromDumpId: string, fromIndex: number, toDumpId: string, toIndex: number) {
      setDumps(function(prev) {
        var fromDump = null as Dump | null;
        var toDump = null as Dump | null;
        for (var i = 0; i < prev.length; i++) {
          if (prev[i].id === fromDumpId) fromDump = prev[i];
          if (prev[i].id === toDumpId) toDump = prev[i];
        }
        if (!fromDump || !toDump) return prev;
        if (toDump.photos.length >= 7) return prev;

        var photo = fromDump.photos[fromIndex];
        return prev.map(function(d) {
          if (d.id === fromDumpId) {
            return { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: d.photos.filter(function(_, i) { return i !== fromIndex; }) };
          }
          if (d.id === toDumpId) {
            var photos = d.photos.slice();
            photos.splice(toIndex, 0, photo);
            return { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: photos };
          }
          return d;
        });
      });
    },
    []
  );

  const movePhotoFromPoolToDump = useCallback(
    function(photoId: string, dumpId: string, toIndex: number) {
      setPool(function(prev) {
        var photo = null as Photo | null;
        for (var i = 0; i < prev.length; i++) {
          if (prev[i].id === photoId) { photo = prev[i]; break; }
        }
        if (!photo) return prev;
        var capturedPhoto = photo;
        setDumps(function(prevDumps) {
          return prevDumps.map(function(d) {
            if (d.id !== dumpId) return d;
            if (d.photos.length >= 7) return d;
            var photos = d.photos.slice();
            photos.splice(toIndex, 0, capturedPhoto);
            return { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: photos };
          });
        });
        return prev.filter(function(p) { return p.id !== photoId; });
      });
    },
    []
  );

  const movePhotoFromDumpToPool = useCallback(
    function(dumpId: string, photoIndex: number) {
      setDumps(function(prev) {
        var dump = null as Dump | null;
        for (var i = 0; i < prev.length; i++) {
          if (prev[i].id === dumpId) { dump = prev[i]; break; }
        }
        if (!dump) return prev;
        var photo = dump.photos[photoIndex];
        setPool(function(prevPool) { return prevPool.concat([photo]); });
        return prev.map(function(d) {
          if (d.id !== dumpId) return d;
          return { id: d.id, number: d.number, title: d.title, subtitle: d.subtitle, photos: d.photos.filter(function(_, i) { return i !== photoIndex; }) };
        });
      });
    },
    []
  );

  const createNewDump = useCallback(function() {
    setDumps(function(prev) {
      var newNum = prev.length + 1;
      return prev.concat([{
        id: "dump-" + nanoid(6),
        number: newNum,
        title: "New Dump " + newNum,
        subtitle: "Drag photos here",
        photos: [],
      }]);
    });
  }, []);

  const deleteDump = useCallback(function(dumpId: string) {
    setDumps(function(prev) {
      var dump = null as Dump | null;
      for (var i = 0; i < prev.length; i++) {
        if (prev[i].id === dumpId) { dump = prev[i]; break; }
      }
      if (!dump) return prev;
      var dumpPhotos = dump.photos.slice();
      setPool(function(prevPool) { return prevPool.concat(dumpPhotos); });
      return prev.filter(function(d) { return d.id !== dumpId; }).map(function(d, i) {
        return { id: d.id, number: i + 1, title: d.title, subtitle: d.subtitle, photos: d.photos };
      });
    });
  }, []);

  const toggleHuji = useCallback(function(photoId: string) {
    setDumps(function(prev) {
      return prev.map(function(d) {
        return {
          id: d.id, number: d.number, title: d.title, subtitle: d.subtitle,
          photos: d.photos.map(function(p) {
            return p.id === photoId ? { id: p.id, url: p.url, alt: p.alt, isHuji: !p.isHuji, category: p.category, role: p.role } : p;
          }),
        };
      });
    });
    setPool(function(prev) {
      return prev.map(function(p) {
        return p.id === photoId ? { id: p.id, url: p.url, alt: p.alt, isHuji: !p.isHuji, category: p.category, role: p.role } : p;
      });
    });
  }, []);

  const renameDump = useCallback(function(dumpId: string, title: string) {
    setDumps(function(prev) {
      return prev.map(function(d) {
        return d.id === dumpId ? { id: d.id, number: d.number, title: title, subtitle: d.subtitle, photos: d.photos } : d;
      });
    });
  }, []);

  return {
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
  };
}

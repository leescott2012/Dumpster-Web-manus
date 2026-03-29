import { useState, useCallback } from "react";
import { INITIAL_DUMPS, INITIAL_POOL, type Dump, type Photo } from "@/lib/photoData";
import { nanoid } from "nanoid";

export function useCarouselState() {
  const [dumps, setDumps] = useState<Dump[]>(() =>
    JSON.parse(JSON.stringify(INITIAL_DUMPS))
  );
  const [pool, setPool] = useState<Photo[]>(() =>
    JSON.parse(JSON.stringify(INITIAL_POOL))
  );

  const resetAll = useCallback(() => {
    setDumps(JSON.parse(JSON.stringify(INITIAL_DUMPS)));
    setPool(JSON.parse(JSON.stringify(INITIAL_POOL)));
  }, []);

  const movePhotoWithinDump = useCallback(
    (dumpId: string, fromIndex: number, toIndex: number) => {
      setDumps((prev) =>
        prev.map((d) => {
          if (d.id !== dumpId) return d;
          const photos = [...d.photos];
          const [moved] = photos.splice(fromIndex, 1);
          photos.splice(toIndex, 0, moved);
          return { ...d, photos };
        })
      );
    },
    []
  );

  const movePhotoBetweenDumps = useCallback(
    (fromDumpId: string, fromIndex: number, toDumpId: string, toIndex: number) => {
      setDumps((prev) => {
        const fromDump = prev.find((d) => d.id === fromDumpId);
        const toDump = prev.find((d) => d.id === toDumpId);
        if (!fromDump || !toDump) return prev;
        if (toDump.photos.length >= 7) return prev; // max 7

        const photo = fromDump.photos[fromIndex];
        return prev.map((d) => {
          if (d.id === fromDumpId) {
            return { ...d, photos: d.photos.filter((_, i) => i !== fromIndex) };
          }
          if (d.id === toDumpId) {
            const photos = [...d.photos];
            photos.splice(toIndex, 0, photo);
            return { ...d, photos };
          }
          return d;
        });
      });
    },
    []
  );

  const movePhotoFromPoolToDump = useCallback(
    (photoId: string, dumpId: string, toIndex: number) => {
      setPool((prev) => {
        const photo = prev.find((p) => p.id === photoId);
        if (!photo) return prev;
        setDumps((prevDumps) =>
          prevDumps.map((d) => {
            if (d.id !== dumpId) return d;
            if (d.photos.length >= 7) return d;
            const photos = [...d.photos];
            photos.splice(toIndex, 0, photo);
            return { ...d, photos };
          })
        );
        return prev.filter((p) => p.id !== photoId);
      });
    },
    []
  );

  const movePhotoFromDumpToPool = useCallback(
    (dumpId: string, photoIndex: number) => {
      setDumps((prev) => {
        const dump = prev.find((d) => d.id === dumpId);
        if (!dump) return prev;
        const photo = dump.photos[photoIndex];
        setPool((prevPool) => [...prevPool, photo]);
        return prev.map((d) => {
          if (d.id !== dumpId) return d;
          return { ...d, photos: d.photos.filter((_, i) => i !== photoIndex) };
        });
      });
    },
    []
  );

  const createNewDump = useCallback(() => {
    const newNum = dumps.length + 1;
    setDumps((prev) => [
      ...prev,
      {
        id: `dump-${nanoid(6)}`,
        number: newNum,
        title: `New Dump ${newNum}`,
        subtitle: "Drag photos here",
        photos: [],
      },
    ]);
  }, [dumps.length]);

  const deleteDump = useCallback((dumpId: string) => {
    setDumps((prev) => {
      const dump = prev.find((d) => d.id === dumpId);
      if (!dump) return prev;
      // Move photos back to pool
      setPool((prevPool) => [...prevPool, ...dump.photos]);
      return prev.filter((d) => d.id !== dumpId).map((d, i) => ({
        ...d,
        number: i + 1,
      }));
    });
  }, []);

  const toggleHuji = useCallback((photoId: string) => {
    setDumps((prev) =>
      prev.map((d) => ({
        ...d,
        photos: d.photos.map((p) =>
          p.id === photoId ? { ...p, isHuji: !p.isHuji } : p
        ),
      }))
    );
    setPool((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, isHuji: !p.isHuji } : p))
    );
  }, []);

  const renameDump = useCallback((dumpId: string, title: string) => {
    setDumps((prev) =>
      prev.map((d) => (d.id === dumpId ? { ...d, title } : d))
    );
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

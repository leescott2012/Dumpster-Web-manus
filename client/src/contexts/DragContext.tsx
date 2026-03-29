import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Photo } from "@/lib/photoData";

interface DragState {
  isDragging: boolean;
  photo: Photo | null;
  source: { type: "dump" | "pool"; dumpId?: string; index: number } | null;
  ghostPosition: { x: number; y: number } | null;
}

interface DragContextType {
  dragState: DragState;
  startDrag: (
    photo: Photo,
    source: { type: "dump" | "pool"; dumpId?: string; index: number },
    position: { x: number; y: number }
  ) => void;
  updateDragPosition: (position: { x: number; y: number }) => void;
  endDrag: () => void;
}

const DragContext = createContext<DragContextType | null>(null);

export function DragProvider({ children }: { children: ReactNode }) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    photo: null,
    source: null,
    ghostPosition: null,
  });

  const startDrag = useCallback(
    (
      photo: Photo,
      source: { type: "dump" | "pool"; dumpId?: string; index: number },
      position: { x: number; y: number }
    ) => {
      setDragState({ isDragging: true, photo, source, ghostPosition: position });
    },
    []
  );

  const updateDragPosition = useCallback((position: { x: number; y: number }) => {
    setDragState((prev) => ({ ...prev, ghostPosition: position }));
  }, []);

  const endDrag = useCallback(() => {
    setDragState({ isDragging: false, photo: null, source: null, ghostPosition: null });
  }, []);

  return (
    <DragContext.Provider value={{ dragState, startDrag, updateDragPosition, endDrag }}>
      {children}
    </DragContext.Provider>
  );
}

export function useDrag() {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error("useDrag must be used within DragProvider");
  return ctx;
}

/*
 * PhotoPool — Bottom section showing unused photos
 * Grid layout, same card styling, Huji red outlines
 * Drop zone for returning photos from dumps
 */
import { useRef, useEffect, useState } from "react";
import PhotoCard from "./PhotoCard";
import { useDrag } from "@/contexts/DragContext";
import type { Photo } from "@/lib/photoData";

interface PhotoPoolProps {
  photos: Photo[];
  onTapPhoto: (photo: Photo) => void;
  onDoubleTapPhoto: (photo: Photo) => void;
  onDropToPool: () => void;
}

export default function PhotoPool({
  photos,
  onTapPhoto,
  onDoubleTapPhoto,
  onDropToPool,
}: PhotoPoolProps) {
  const poolRef = useRef<HTMLDivElement>(null);
  const { dragState } = useDrag();
  const [isOver, setIsOver] = useState(false);
  const isOverRef = useRef(false);

  useEffect(() => {
    isOverRef.current = isOver;
  }, [isOver]);

  useEffect(() => {
    if (!dragState.isDragging) {
      setIsOver(false);
      return;
    }

    // Only show drop zone if dragging from a dump
    if (dragState.source?.type !== "dump") return;

    const handleMove = (e: TouchEvent | MouseEvent) => {
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      if (!poolRef.current) return;
      const rect = poolRef.current.getBoundingClientRect();
      const over = clientY >= rect.top - 60 && clientY <= rect.bottom + 60;
      setIsOver(over);
    };

    const handleEnd = () => {
      if (isOverRef.current) {
        onDropToPool();
      }
    };

    window.addEventListener("touchmove", handleMove, { passive: true });
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("touchend", handleEnd);
    window.addEventListener("mouseup", handleEnd);

    return () => {
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("mouseup", handleEnd);
    };
  }, [dragState.isDragging, dragState.source, onDropToPool]);

  return (
    <section
      ref={poolRef}
      style={{
        maxWidth: "1100px",
        margin: "56px auto",
        padding: "0 32px 80px",
      }}
    >
      {/* Section Header */}
      <div
        style={{
          marginBottom: "32px",
          paddingBottom: "24px",
          borderBottom: "1px solid #1e1e1e",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.25em",
            textTransform: "uppercase" as const,
            color: "#c8a96e",
            marginBottom: "8px",
          }}
        >
          PHOTO POOL
        </div>
        <h2
          style={{
            fontSize: "clamp(20px, 2.5vw, 28px)",
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.02em",
            marginBottom: "4px",
          }}
        >
          Available Photos
        </h2>
        <div
          style={{
            fontSize: "14px",
            color: "#666",
            fontStyle: "italic",
          }}
        >
          {photos.length} photos available · Drag into dumps above
        </div>
      </div>

      {/* Photo Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "12px",
          outline: isOver ? "2px dashed rgba(200,169,110,0.5)" : "none",
          outlineOffset: "8px",
          borderRadius: "12px",
          transition: "all 0.2s",
          padding: isOver ? "8px" : "0",
          background: isOver ? "rgba(200,169,110,0.03)" : "transparent",
        }}
      >
        {photos.map((photo, i) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            index={i}
            source={{ type: "pool" }}
            onTap={onTapPhoto}
            onDoubleTap={onDoubleTapPhoto}
            width={140}
            height={180}
          />
        ))}
        {photos.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: "40px",
              color: "#666",
              fontSize: "14px",
              border: "1px dashed #2a2a2a",
              borderRadius: "10px",
            }}
          >
            All photos are in dumps — drag some back here to free them up
          </div>
        )}
      </div>
    </section>
  );
}

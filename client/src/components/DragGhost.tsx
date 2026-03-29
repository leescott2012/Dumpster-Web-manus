/*
 * DragGhost — Semi-transparent floating photo that follows finger during drag
 * V4 styling: gold border, slight scale, 0.85 opacity
 * Uses transform for GPU-accelerated positioning (smoother on mobile)
 */
import { useDrag } from "@/contexts/DragContext";

export default function DragGhost() {
  const { dragState } = useDrag();

  if (!dragState.isDragging || !dragState.photo || !dragState.ghostPosition) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        transform: `translate3d(${dragState.ghostPosition.x - 50}px, ${dragState.ghostPosition.y - 65}px, 0) scale(1.05) rotate(-2deg)`,
        width: "100px",
        height: "130px",
        borderRadius: "8px",
        overflow: "hidden",
        border: "2px solid #c8a96e",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(200,169,110,0.3)",
        opacity: 0.85,
        pointerEvents: "none",
        zIndex: 9999,
        willChange: "transform",
      }}
    >
      <img
        src={dragState.photo.url}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
        draggable={false}
      />
    </div>
  );
}

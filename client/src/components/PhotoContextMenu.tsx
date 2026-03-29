/*
 * PhotoContextMenu — Options on double-tap or long-press
 * Remove from dump, toggle Huji, view larger
 */
import type { Photo } from "@/lib/photoData";

interface PhotoContextMenuProps {
  photo: Photo | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onRemoveFromDump: (photoId: string) => void;
  onToggleHuji: (photoId: string) => void;
  onViewLarger: (photo: Photo) => void;
  isInDump: boolean;
}

export default function PhotoContextMenu({
  photo,
  position,
  onClose,
  onRemoveFromDump,
  onToggleHuji,
  onViewLarger,
  isInDump,
}: PhotoContextMenuProps) {
  if (!photo || !position) return null;

  const menuStyle: React.CSSProperties = {
    position: "fixed",
    left: Math.min(position.x, window.innerWidth - 200),
    top: Math.min(position.y, window.innerHeight - 200),
    background: "#151515",
    border: "1px solid #2a2a2a",
    borderRadius: "10px",
    padding: "4px",
    zIndex: 10001,
    minWidth: "180px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
    animation: "scaleIn 0.15s ease-out",
  };

  const itemStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "10px 14px",
    background: "transparent",
    border: "none",
    color: "#e8e8e8",
    fontSize: "13px",
    textAlign: "left",
    cursor: "pointer",
    borderRadius: "6px",
    transition: "background 0.15s",
    fontFamily: "inherit",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          background: "transparent",
        }}
      />

      {/* Menu */}
      <div style={menuStyle}>
        <button
          style={itemStyle}
          onClick={() => {
            onViewLarger(photo);
            onClose();
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          View Larger
        </button>

        <button
          style={itemStyle}
          onClick={() => {
            onToggleHuji(photo.id);
            onClose();
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          {photo.isHuji ? "Unmark as Huji" : "Mark as Huji"}
        </button>

        {isInDump && (
          <button
            style={{ ...itemStyle, color: "#e74c3c" }}
            onClick={() => {
              onRemoveFromDump(photo.id);
              onClose();
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Remove from Dump
          </button>
        )}
      </div>

      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}

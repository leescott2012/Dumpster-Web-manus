/*
 * PhotoContextMenu — triggered by "..." dots button
 * Shows: Mark/Unmark Huji (normal), Favorite/Unfavorite (normal), Remove (red)
 * Works for both dump and pool photos.
 */
import type { Photo } from "@/lib/photoData";

interface PhotoContextMenuProps {
  photo: Photo | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onRemove: (photoId: string) => void;
  onToggleHuji: (photoId: string) => void;
  onToggleFavorite: (photoId: string) => void;
}

export default function PhotoContextMenu({
  photo, position, onClose, onRemove, onToggleHuji, onToggleFavorite,
}: PhotoContextMenuProps) {
  if (!photo || !position) return null;

  var leftPos = Math.min(position.x, window.innerWidth - 200);
  var topPos = Math.min(position.y, window.innerHeight - 200);

  var menuStyle: React.CSSProperties = {
    position: "fixed", left: leftPos, top: topPos,
    background: "#151515", border: "1px solid #2a2a2a", borderRadius: "10px",
    padding: "4px", zIndex: 10001, minWidth: "180px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
  };

  var itemStyle: React.CSSProperties = {
    display: "block", width: "100%", padding: "10px 14px",
    background: "transparent", border: "none", color: "#e8e8e8",
    fontSize: "13px", textAlign: "left", cursor: "pointer",
    borderRadius: "6px", transition: "background 0.15s", fontFamily: "inherit",
  };

  var hujiLabel = photo.isHuji ? "Unmark Huji" : "Mark as Huji";
  var favLabel = photo.isFavorite ? "Unfavorite" : "Favorite";

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10000, background: "transparent" }} />
      <div style={menuStyle} className="context-menu-enter">
        <button style={itemStyle}
          onClick={function() { onToggleHuji(photo.id); onClose(); }}
          onMouseEnter={function(e) { e.currentTarget.style.background = "#1a1a1a"; }}
          onMouseLeave={function(e) { e.currentTarget.style.background = "transparent"; }}
        >
          {hujiLabel}
        </button>
        <button style={itemStyle}
          onClick={function() { onToggleFavorite(photo.id); onClose(); }}
          onMouseEnter={function(e) { e.currentTarget.style.background = "#1a1a1a"; }}
          onMouseLeave={function(e) { e.currentTarget.style.background = "transparent"; }}
        >
          {photo.isFavorite ? "\u2605 " : "\u2606 "}{favLabel}
        </button>
        <button
          style={{
            display: "block", width: "100%", padding: "10px 14px",
            background: "transparent", border: "none", color: "#e74c3c",
            fontSize: "13px", fontWeight: 600, textAlign: "left", cursor: "pointer",
            borderRadius: "6px", transition: "background 0.15s", fontFamily: "inherit",
          }}
          onClick={function() { onRemove(photo.id); onClose(); }}
          onMouseEnter={function(e) { e.currentTarget.style.background = "#1a1a1a"; }}
          onMouseLeave={function(e) { e.currentTarget.style.background = "transparent"; }}
        >
          Remove
        </button>
      </div>
    </>
  );
}

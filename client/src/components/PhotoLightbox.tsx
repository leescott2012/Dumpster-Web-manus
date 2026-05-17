/*
 * PhotoLightbox — Full-screen photo viewer on tap
 * Dark overlay with backdrop blur, centered photo, tap to dismiss
 * V4 dark theme with gold accents
 * NO template literals, NO inline style tags — Safari compatible
 */
import type { Photo } from "@/lib/photoData";

interface PhotoLightboxProps {
  photo: Photo | null;
  onClose: () => void;
}

export default function PhotoLightbox({ photo, onClose }: PhotoLightboxProps) {
  if (!photo) return null;

  var imgBorder = "2px solid #2a2a2a";

  return (
    <div
      onClick={onClose}
      className="lightbox-enter"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          position: "relative",
          maxWidth: "min(90vw, 600px)",
          maxHeight: "80vh",
          borderRadius: "12px",
          overflow: "hidden",
          border: imgBorder,
          boxShadow: "0 16px 64px rgba(0,0,0,0.5)",
        }}
        onClick={function(e) { e.stopPropagation(); }}
      >
        <img
          src={photo.url}
          alt={photo.alt}
          draggable={false}
          style={{
            width: "100%",
            maxHeight: "80vh",
            objectFit: "contain",
            display: "block",
            background: "#111",
          }}
        />
        {/* Info overlay at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "linear-gradient(transparent, rgba(0,0,0,0.9))",
            padding: "32px 16px 16px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              color: "#e8e8e8",
              marginBottom: "4px",
            }}
          >
            {photo.alt}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--accent)",
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              fontWeight: 600,
            }}
          >
            {photo.category}
          </div>
        </div>
      </div>

      {/* Close hint */}
      <div
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          color: "#666",
          fontSize: "11px",
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          fontWeight: 600,
        }}
      >
        TAP TO CLOSE
      </div>
    </div>
  );
}

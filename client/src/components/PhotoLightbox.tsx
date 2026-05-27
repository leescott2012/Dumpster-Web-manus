/*
 * PhotoLightbox — Full-screen photo viewer on tap
 * Dark overlay with backdrop blur, centered photo, tap to dismiss.
 * (i) button in the header reveals the PhotoInfoPanel (EXIF / map).
 *
 * NO template literals — Safari compatibility.
 */
import { useState, useEffect } from "react";
import { Info, X } from "lucide-react";
import type { Photo } from "@/lib/photoData";
import PhotoInfoPanel from "./PhotoInfoPanel";

interface PhotoLightboxProps {
  photo: Photo | null;
  onClose: () => void;
}

export default function PhotoLightbox({ photo, onClose }: PhotoLightboxProps) {
  var [showInfo, setShowInfo] = useState(false);

  // Collapse info panel when a different photo opens
  useEffect(function() {
    setShowInfo(false);
  }, [photo?.id]);

  if (!photo) return null;

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
      {/* Header controls */}
      <div
        onClick={function(e) { e.stopPropagation(); }}
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 12px) + 12px)",
          right: 16, left: 16,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          zIndex: 2,
        }}
      >
        <button
          onClick={function() { setShowInfo(function(v) { return !v; }); }}
          aria-label={showInfo ? "Hide info" : "Show info"}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: showInfo ? "rgba(250,204,21,0.18)" : "rgba(255,255,255,0.06)",
            border: showInfo ? "1px solid rgba(250,204,21,0.4)" : "1px solid rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            color: showInfo ? "var(--accent)" : "#bbb",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            transition: "all 0.15s",
          }}
        >
          <Info size={16} />
        </button>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#bbb",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Photo + info card */}
      <div
        style={{
          position: "relative",
          maxWidth: "min(90vw, 600px)",
          maxHeight: "85vh",
          borderRadius: 12,
          overflow: "hidden",
          border: "2px solid #2a2a2a",
          boxShadow: "0 16px 64px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={function(e) { e.stopPropagation(); }}
      >
        <img
          src={photo.url}
          alt={photo.alt}
          draggable={false}
          style={{
            width: "100%",
            maxHeight: showInfo ? "45vh" : "85vh",
            objectFit: "contain",
            display: "block",
            background: "#111",
            transition: "max-height 0.25s ease",
          }}
        />

        {/* Bottom title strip (always-on, when info is closed) */}
        {!showInfo && (
          <div
            style={{
              position: "absolute",
              bottom: 0, left: 0, right: 0,
              background: "linear-gradient(transparent, rgba(0,0,0,0.9))",
              padding: "32px 16px 16px",
              pointerEvents: "none",
            }}
          >
            <div style={{ fontSize: 13, color: "#e8e8e8", marginBottom: 4 }}>
              {photo.alt}
            </div>
            <div style={{
              fontSize: 11, color: "var(--accent)",
              letterSpacing: "0.08em", textTransform: "uppercase" as const,
              fontWeight: 600,
            }}>
              {photo.category}
            </div>
          </div>
        )}

        {/* Info panel slides in below */}
        {showInfo && <PhotoInfoPanel photo={photo} />}
      </div>
    </div>
  );
}

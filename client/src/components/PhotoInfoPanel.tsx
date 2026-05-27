/**
 * PhotoInfoPanel — Apple-Photos-style metadata card shown beneath a photo
 * when the user taps the (i) toggle in the lightbox.
 *
 * Shows whatever EXIF we captured at upload time. Every section is
 * conditional — photos without EXIF (screenshots, downloads) just show
 * filename + format and call it a day.
 *
 * Map preview uses Google Static Maps via the existing Frontend Forge
 * proxy (no extra API key needed). When MapKit JS is wired later we'll
 * swap this single component.
 */
import type { Photo } from "@/lib/photoData";

interface PhotoInfoPanelProps {
  photo: Photo;
}

var FORGE_BASE_URL: string =
  import.meta.env.VITE_FRONTEND_FORGE_API_URL || "https://forge.butterfly-effect.dev";
var MAPS_PROXY_URL = FORGE_BASE_URL + "/v1/maps/proxy";
var GOOGLE_MAPS_API_KEY: string = import.meta.env.VITE_FRONTEND_FORGE_API_KEY || "";

function formatDate(epochMs: number): string {
  var d = new Date(epochMs);
  var day = d.toLocaleDateString(undefined, { weekday: "short" });
  var date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  var time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return day + " · " + date + " · " + time;
}

function formatShutter(s: number): string {
  if (s >= 1) return s.toFixed(1) + " s";
  var denom = Math.round(1 / s);
  return "1/" + denom + " s";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function staticMapUrl(lat: number, lng: number, dark: boolean = true): string {
  var key = GOOGLE_MAPS_API_KEY;
  // Subtle dark map style; falls back to Google default if forge proxy doesn't honor styles
  var style = dark
    ? "&style=feature:all|element:geometry|color:0x1a1a1a&style=feature:all|element:labels.text.fill|color:0x999999&style=feature:water|color:0x0a0a0a"
    : "";
  return (
    MAPS_PROXY_URL +
    "/maps/api/staticmap" +
    "?center=" + lat + "," + lng +
    "&zoom=14" +
    "&size=600x300" +
    "&scale=2" +
    "&markers=color:0xfacc15%7C" + lat + "," + lng +
    style +
    "&key=" + key
  );
}

export default function PhotoInfoPanel({ photo }: PhotoInfoPanelProps) {
  var m = photo.meta;

  // If we have literally nothing, show a minimal card so the panel doesn't
  // look broken when toggled on.
  var hasAnyExif =
    !!m && (m.takenAt || m.camera || m.iso || m.focalLength || m.fStop || m.shutterSpeed || (m.lat && m.lng));

  return (
    <div
      style={{
        background: "#0e0e0e",
        color: "#e8e8e8",
        borderTop: "1px solid #1e1e1e",
        padding: 16,
        fontSize: 13,
        lineHeight: 1.5,
        maxHeight: "60vh",
        overflowY: "auto",
      }}
      onClick={function(e) { e.stopPropagation(); }}
    >
      {/* Date / filename header */}
      {m?.takenAt && (
        <div style={{
          color: "#fff", fontWeight: 600, fontSize: 14, marginBottom: 4,
          letterSpacing: "-0.01em",
        }}>
          {formatDate(m.takenAt)}
        </div>
      )}
      <div style={{ color: "#888", fontSize: 12, marginBottom: 14 }}>
        {photo.alt}
      </div>

      {/* Camera block */}
      {(m?.camera || m?.format || m?.fileSize || m?.width) && (
        <div style={{
          background: "#141414",
          border: "1px solid #1e1e1e",
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
        }}>
          {m?.camera && (
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 8,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{m.camera}</div>
              {m.format && (
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                  color: "#aaa", background: "#1f1f1f",
                  border: "1px solid #2a2a2a", borderRadius: 6,
                  padding: "2px 8px",
                }}>
                  {m.format}
                </span>
              )}
            </div>
          )}
          {(m?.lens || m?.focalLength || m?.fStop) && (
            <div style={{ color: "#aaa", fontSize: 12, marginBottom: 6 }}>
              {m.lens && <span>{m.lens}</span>}
              {m.lens && (m.focalLength || m.fStop) && <span> — </span>}
              {m.focalLength && <span>{Math.round(m.focalLength)} mm</span>}
              {m.focalLength && m.fStop && <span> </span>}
              {m.fStop && <span>ƒ/{m.fStop.toFixed(2)}</span>}
            </div>
          )}
          {(m?.width || m?.fileSize) && (
            <div style={{ color: "#888", fontSize: 12 }}>
              {m.width && m.height && (
                <span>
                  {((m.width * m.height) / 1_000_000).toFixed(1)} MP · {m.width}×{m.height}
                </span>
              )}
              {m.width && m.fileSize && <span> · </span>}
              {m.fileSize && <span>{formatFileSize(m.fileSize)}</span>}
            </div>
          )}
        </div>
      )}

      {/* Exposure stat row */}
      {(m?.iso || m?.focalLength || m?.fStop || m?.shutterSpeed) && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(70px, 1fr))",
          gap: 8,
          marginBottom: 12,
        }}>
          {m.iso !== undefined && (
            <Stat label="ISO" value={String(m.iso)} />
          )}
          {m.focalLength !== undefined && (
            <Stat label="" value={Math.round(m.focalLength) + " mm"} />
          )}
          {m.fStop !== undefined && (
            <Stat label="" value={"ƒ/" + m.fStop.toFixed(2)} />
          )}
          {m.shutterSpeed !== undefined && (
            <Stat label="" value={formatShutter(m.shutterSpeed)} />
          )}
        </div>
      )}

      {/* Location */}
      {m?.lat !== undefined && m?.lng !== undefined && (
        <div style={{
          background: "#141414",
          border: "1px solid #1e1e1e",
          borderRadius: 12,
          overflow: "hidden",
        }}>
          {GOOGLE_MAPS_API_KEY ? (
            <img
              src={staticMapUrl(m.lat, m.lng)}
              alt={"Map at " + m.lat.toFixed(3) + ", " + m.lng.toFixed(3)}
              style={{
                width: "100%", height: 160, objectFit: "cover", display: "block",
              }}
              onError={function(e) {
                // Hide if proxy doesn't accept static-maps — keep the panel clean
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
          <div style={{ padding: "10px 12px", fontSize: 12, color: "#aaa" }}>
            {m.lat.toFixed(4)}°, {m.lng.toFixed(4)}°
          </div>
        </div>
      )}

      {!hasAnyExif && (
        <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
          No EXIF data — this photo was likely a screenshot, edited, or stripped.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: "#141414",
      border: "1px solid #1e1e1e",
      borderRadius: 8,
      padding: "6px 8px",
      textAlign: "center" as const,
    }}>
      {label && (
        <div style={{
          fontSize: 9, fontWeight: 700, color: "#666",
          letterSpacing: "0.1em", textTransform: "uppercase" as const,
        }}>
          {label}
        </div>
      )}
      <div style={{ fontSize: 12, color: "#e8e8e8", fontWeight: 600, marginTop: label ? 2 : 0 }}>
        {value}
      </div>
    </div>
  );
}

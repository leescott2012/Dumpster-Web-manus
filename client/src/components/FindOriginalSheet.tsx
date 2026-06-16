/**
 * FindOriginalSheet — "Find in Photos"
 *
 * The in-app copy of a photo is downscaled for fast posting. When the user
 * wants the ORIGINAL full-resolution file (to re-post or print), this sheet
 * helps them locate it in their device's photo library using the capture
 * date/time + location we captured from EXIF at upload time.
 *
 * A web app can't deep-link to a specific asset in Apple/Google Photos, so the
 * best we can do is surface the date + location and open the Photos app /
 * Google Photos so they can find it in a couple of taps.
 */
import type { Photo } from "@/lib/photoData";
import { toast } from "sonner";

interface FindOriginalSheetProps {
  photo: Photo | null;
  onClose: () => void;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function formatDate(epochMs: number): string {
  var d = new Date(epochMs);
  var day = d.toLocaleDateString(undefined, { weekday: "short" });
  var date = d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  var time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return day + ", " + date + " · " + time;
}

/** YYYY-MM-DD — used for the Google Photos search deep link + copy. */
function isoDate(epochMs: number): string {
  var d = new Date(epochMs);
  var mm = String(d.getMonth() + 1).padStart(2, "0");
  var dd = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + mm + "-" + dd;
}

export default function FindOriginalSheet({ photo, onClose }: FindOriginalSheetProps) {
  if (!photo) return null;
  var m = photo.meta;
  var hasDate = !!(m && m.takenAt);
  var hasLoc = !!(m && typeof m.lat === "number" && typeof m.lng === "number");
  var ios = isIos();

  var openApplePhotos = function() {
    // Just launches Photos — no scheme can target a specific asset.
    window.location.href = "photos-redirect://";
  };

  var openGooglePhotos = function() {
    var url = hasDate
      ? "https://photos.google.com/search/" + encodeURIComponent(isoDate(m!.takenAt!))
      : "https://photos.google.com/";
    window.open(url, "_blank", "noopener");
  };

  var viewLocation = function() {
    if (!hasLoc) return;
    var ll = m!.lat + "," + m!.lng;
    var url = ios ? "https://maps.apple.com/?ll=" + ll : "https://www.google.com/maps?q=" + ll;
    window.open(url, "_blank", "noopener");
  };

  var copyDate = function() {
    if (!hasDate) return;
    var text = isoDate(m!.takenAt!);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function() { toast("Copied " + text + " — search it in Photos"); },
        function() { toast("Couldn't copy — date is " + text); }
      );
    } else {
      toast("Date is " + text);
    }
  };

  var btnBase: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    width: "100%", padding: "13px 16px", borderRadius: 12, fontSize: 14,
    fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "none",
    marginBottom: 10,
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10010, background: "rgba(0,0,0,0.6)" }} />
      <div
        onClick={function(e) { e.stopPropagation(); }}
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 10011,
          background: "#101010", borderTop: "1px solid #2a2a2a",
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          padding: "20px 18px calc(20px + env(safe-area-inset-bottom))",
          maxWidth: 520, margin: "0 auto", maxHeight: "82vh", overflowY: "auto",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 100, background: "#333", margin: "0 auto 16px" }} />

        <div style={{ color: "#fff", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Find in Photos</div>
        <div style={{ color: "#999", fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
          Your in-app copy is optimized for fast posting. To use the original full-resolution
          file, open it from your device's photo library:
        </div>

        {/* Date + location card */}
        {(hasDate || hasLoc) ? (
          <div style={{ background: "#171717", border: "1px solid #232323", borderRadius: 14, padding: 14, marginBottom: 16 }}>
            {hasDate && (
              <div style={{ marginBottom: hasLoc ? 12 : 0 }}>
                <div style={{ color: "#666", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>Taken</div>
                <div style={{ color: "#fff", fontSize: 15, fontWeight: 600 }}>{formatDate(m!.takenAt!)}</div>
              </div>
            )}
            {hasLoc && (
              <div>
                <div style={{ color: "#666", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>Location</div>
                <div style={{ color: "#e8e8e8", fontSize: 14 }}>{m!.lat!.toFixed(4)}°, {m!.lng!.toFixed(4)}°</div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: "#171717", border: "1px solid #232323", borderRadius: 14, padding: 14, marginBottom: 16, color: "#888", fontSize: 13, lineHeight: 1.5 }}>
            This photo has no embedded date or location (likely a screenshot or edited image),
            so we can't pinpoint it. Try sorting your library around when you uploaded it.
          </div>
        )}

        {/* Actions */}
        {ios && (
          <button style={{ ...btnBase, background: "var(--accent)", color: "#000" }}
            onClick={openApplePhotos}>
            Open Apple Photos
          </button>
        )}
        <button style={{ ...btnBase, background: ios ? "#1c1c1c" : "var(--accent)", color: ios ? "#e8e8e8" : "#000", border: ios ? "1px solid #2a2a2a" : "none" }}
          onClick={openGooglePhotos}>
          {hasDate ? "Search Google Photos by date" : "Open Google Photos"}
        </button>
        {hasDate && (
          <button style={{ ...btnBase, background: "#1c1c1c", color: "#e8e8e8", border: "1px solid #2a2a2a" }}
            onClick={copyDate}>
            Copy date to search
          </button>
        )}
        {hasLoc && (
          <button style={{ ...btnBase, background: "#1c1c1c", color: "#e8e8e8", border: "1px solid #2a2a2a" }}
            onClick={viewLocation}>
            View location on map
          </button>
        )}

        <button style={{ ...btnBase, background: "transparent", color: "#777", marginTop: 4, marginBottom: 0 }}
          onClick={onClose}>
          Close
        </button>
      </div>
    </>
  );
}

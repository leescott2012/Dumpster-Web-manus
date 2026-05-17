/**
 * DumpActionSheet — iOS-style "..." action menu for a dump
 * Actions: Rate, Heart, Chat with AI, Generate Captions, Export/Share, Delete
 */
import { Heart, Sparkles, Share2, Trash2, X, MessageCircle, ThumbsUp, ThumbsDown } from "lucide-react";
import type { Dump } from "@/lib/photoData";

interface DumpActionSheetProps {
  dump: Dump | null;
  open: boolean;
  onClose: () => void;
  onHeart: (dumpId: string) => void;
  onChat: (dumpId: string) => void;
  onRate: (dumpId: string, rating: "up" | "down" | null) => void;
  onThumbsDown: (dumpId: string) => void;
  onCaptions: (dumpId: string) => void;
  onExport: (dumpId: string) => void;
  onDelete: (dumpId: string) => void;
}

interface ActionRow {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  color: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export default function DumpActionSheet({
  dump, open, onClose, onHeart, onChat, onRate, onThumbsDown, onCaptions, onExport, onDelete,
}: DumpActionSheetProps) {
  if (!open || !dump) return null;

  var isHearted = Boolean(dump.favorited);
  var hasCaptions = dump.captions && dump.captions.length > 0;
  var currentRating = dump.rating || null;

  var actions: ActionRow[] = [
    {
      icon: <Heart size={18} fill={isHearted ? "#e05c7a" : "none"} />,
      label: isHearted ? "Unfavorite" : "Favorite",
      sublabel: isHearted ? "Remove from favorites" : "Mark as a keeper",
      color: isHearted ? "#e05c7a" : "#e8e8e8",
      onClick: function() { onHeart(dump.id); onClose(); },
    },
    {
      icon: <MessageCircle size={18} />,
      label: "Chat with AI",
      sublabel: "Reorder, swap, set the vibe",
      color: "var(--accent)",
      onClick: function() { onChat(dump.id); onClose(); },
    },
    {
      icon: <Sparkles size={18} />,
      label: hasCaptions ? "Regenerate Captions" : "Generate Captions",
      sublabel: hasCaptions ? "3 new options with Claude" : "3 caption options with Claude",
      color: "#6E8EC8",
      disabled: dump.photos.length === 0,
      onClick: function() { onCaptions(dump.id); onClose(); },
    },
    {
      icon: <Share2 size={18} />,
      label: "Export / Share",
      sublabel: "Download photos · copy caption",
      color: "var(--accent)",
      disabled: dump.photos.length === 0,
      onClick: function() { onExport(dump.id); onClose(); },
    },
    {
      icon: <Trash2 size={18} />,
      label: "Delete Dump",
      sublabel: "Photos returned to pool",
      color: "#ef4444",
      danger: true,
      onClick: function() { onDelete(dump.id); onClose(); },
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.72)", zIndex: 430,
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 431,
        background: "#0e0e0e", borderTop: "1px solid #2a2a2a",
        borderRadius: "20px 20px 0 0",
        overflow: "hidden",
      }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "#333" }} />
        </div>

        {/* Dump info header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 24px 12px", borderBottom: "1px solid #1a1a1a",
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.2em",
              color: "var(--accent)", textTransform: "uppercase" as const, marginBottom: 3,
            }}>
              {"DUMP " + String(dump.number).padStart(2, "0")}
              {isHearted && (
                <span style={{ marginLeft: 6, color: "#e05c7a" }}>{"♥"}</span>
              )}
            </div>
            <div style={{
              fontSize: 16, fontWeight: 700, color: "#fff",
              letterSpacing: "-0.01em", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
            }}>
              {dump.title}
            </div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
              {dump.photos.length + " photos" + (hasCaptions ? " · captions ready" : "")}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0, marginLeft: 12,
              background: "#1a1a1a", border: "1px solid #2a2a2a",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#666",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Rating row — thumbs up / thumbs down */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 24px", borderBottom: "1px solid #1a1a1a",
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#666", letterSpacing: "0.06em", marginRight: "auto" }}>
            RATE THIS DUMP
          </div>
          <button
            onClick={function() {
              var newRating: "up" | null = currentRating === "up" ? null : "up";
              onRate(dump.id, newRating);
            }}
            style={{
              width: 44, height: 38, borderRadius: 10,
              background: currentRating === "up" ? "rgba(74,222,128,0.15)" : "#1a1a1a",
              border: "1px solid " + (currentRating === "up" ? "rgba(74,222,128,0.4)" : "#2a2a2a"),
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: currentRating === "up" ? "#4ade80" : "#666",
              transition: "all 0.15s",
            }}
          >
            <ThumbsUp size={16} fill={currentRating === "up" ? "#4ade80" : "none"} />
          </button>
          <button
            onClick={function() {
              if (currentRating === "down") {
                // Toggle off
                onRate(dump.id, null);
              } else {
                // Rate down, close sheet, open AI chat to ask why
                onRate(dump.id, "down");
                onThumbsDown(dump.id);
                onClose();
              }
            }}
            style={{
              width: 44, height: 38, borderRadius: 10,
              background: currentRating === "down" ? "rgba(239,68,68,0.15)" : "#1a1a1a",
              border: "1px solid " + (currentRating === "down" ? "rgba(239,68,68,0.4)" : "#2a2a2a"),
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: currentRating === "down" ? "#ef4444" : "#666",
              transition: "all 0.15s",
            }}
          >
            <ThumbsDown size={16} fill={currentRating === "down" ? "#ef4444" : "none"} />
          </button>
        </div>

        {/* Action rows */}
        <div style={{ padding: "8px 0 40px" }}>
          {actions.map(function(action, i) {
            return (
              <button
                key={i}
                onClick={action.disabled ? undefined : action.onClick}
                disabled={action.disabled}
                style={{
                  width: "100%", textAlign: "left" as const,
                  background: "transparent", border: "none",
                  padding: "14px 24px",
                  display: "flex", alignItems: "center", gap: 16,
                  cursor: action.disabled ? "not-allowed" : "pointer",
                  opacity: action.disabled ? 0.35 : 1,
                  fontFamily: "inherit",
                  transition: "background 0.12s",
                  borderTop: action.danger ? "1px solid #1a1a1a" : "none",
                  marginTop: action.danger ? 8 : 0,
                }}
                onMouseEnter={function(e) {
                  if (!action.disabled) {
                    e.currentTarget.style.background = action.danger
                      ? "rgba(239,68,68,0.06)"
                      : "rgba(255,255,255,0.04)";
                  }
                }}
                onMouseLeave={function(e) { e.currentTarget.style.background = "transparent"; }}
              >
                {/* Icon circle */}
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: action.danger
                    ? "rgba(239,68,68,0.1)"
                    : action.color + "1a",
                  border: "1px solid " + action.color + "30",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: action.color,
                }}>
                  {action.icon}
                </div>

                {/* Label */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 15, fontWeight: 600,
                    color: action.danger ? "#ef4444" : "#e8e8e8",
                    letterSpacing: "-0.01em",
                  }}>
                    {action.label}
                  </div>
                  {action.sublabel && (
                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                      {action.sublabel}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/**
 * DumpActionSheet — iOS-style "..." action menu for a dump
 * Actions: Heart, Generate Captions, Export/Share, Delete
 */
import { Heart, Sparkles, Share2, Trash2, X, MessageCircle } from "lucide-react";
import type { Dump } from "@/lib/photoData";

interface DumpActionSheetProps {
  dump: Dump | null;
  open: boolean;
  onClose: () => void;
  onHeart: (dumpId: string) => void;
  onChat: (dumpId: string) => void;
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
  dump, open, onClose, onHeart, onChat, onCaptions, onExport, onDelete,
}: DumpActionSheetProps) {
  if (!open || !dump) return null;

  const isHearted = Boolean(dump.favorited);
  const hasCaptions = dump.captions && dump.captions.length > 0;

  const actions: ActionRow[] = [
    {
      icon: <Heart size={18} fill={isHearted ? "#e05c7a" : "none"} />,
      label: isHearted ? "Unfavorite" : "Favorite",
      sublabel: isHearted ? "Remove from favorites" : "Mark as a keeper",
      color: isHearted ? "#e05c7a" : "#e8e8e8",
      onClick: () => { onHeart(dump.id); onClose(); },
    },
    {
      icon: <MessageCircle size={18} />,
      label: "Chat with AI",
      sublabel: "Reorder, swap, set the vibe",
      color: "#c8a96e",
      onClick: () => { onChat(dump.id); onClose(); },
    },
    {
      icon: <Sparkles size={18} />,
      label: hasCaptions ? "Regenerate Captions" : "Generate Captions",
      sublabel: hasCaptions ? "3 new options with Claude" : "3 caption options with Claude",
      color: "#6E8EC8",
      disabled: dump.photos.length === 0,
      onClick: () => { onCaptions(dump.id); onClose(); },
    },
    {
      icon: <Share2 size={18} />,
      label: "Export / Share",
      sublabel: "Download photos · copy caption",
      color: "#c8a96e",
      disabled: dump.photos.length === 0,
      onClick: () => { onExport(dump.id); onClose(); },
    },
    {
      icon: <Trash2 size={18} />,
      label: "Delete Dump",
      sublabel: "Photos returned to pool",
      color: "#ef4444",
      danger: true,
      onClick: () => { onDelete(dump.id); onClose(); },
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
              color: "#c8a96e", textTransform: "uppercase", marginBottom: 3,
            }}>
              {`DUMP ${String(dump.number).padStart(2, "0")}`}
              {isHearted && (
                <span style={{ marginLeft: 6, color: "#e05c7a" }}>♥</span>
              )}
            </div>
            <div style={{
              fontSize: 16, fontWeight: 700, color: "#fff",
              letterSpacing: "-0.01em", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {dump.title}
            </div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
              {dump.photos.length} photos{hasCaptions ? " · captions ready" : ""}
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

        {/* Action rows */}
        <div style={{ padding: "8px 0 40px" }}>
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.disabled ? undefined : action.onClick}
              disabled={action.disabled}
              style={{
                width: "100%", textAlign: "left",
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
              onMouseEnter={e => {
                if (!action.disabled) {
                  e.currentTarget.style.background = action.danger
                    ? "rgba(239,68,68,0.06)"
                    : "rgba(255,255,255,0.04)";
                }
              }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              {/* Icon circle */}
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: action.danger
                  ? "rgba(239,68,68,0.1)"
                  : `${action.color}1a`,
                border: `1px solid ${action.color}30`,
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
          ))}
        </div>
      </div>
    </>
  );
}

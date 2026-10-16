/**
 * Settings — App configuration panel
 * Dark mode toggle, keyboard shortcuts help
 */
import { useState } from "react";
import { Palette, ChevronLeft, Keyboard } from "lucide-react";
import ApiKeysCard from "./ApiKeysCard";
import { useTheme } from "@/contexts/ThemeContext";

interface SettingsProps {
  open: boolean;
  onClose: () => void;
}

// ── Dark Mode Toggle ─────────────────────────────────────────────────────────────

function DarkModeToggle() {
  const { theme, toggleTheme } = useTheme();

  const handleChange = () => {
    if (toggleTheme) {
      toggleTheme();
    }
  };

  return (
    <button
      onClick={handleChange}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "12px 16px",
        background: "transparent",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: "inherit",
        marginBottom: 8,
        transition: "background 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "#1a1a1a")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: theme === "dark" ? "flex-end" : "flex-start",
          width: 44,
          height: 22,
          background: theme === "dark" ? "#a855f7" : "#333",
          borderRadius: 22,
          transition: "all 0.2s",
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 600,
            color: "#666",
          }}
        >
          {theme === "dark" ? "🌙" : "☀"}
        </div>
      </div>
      <span style={{ color: "#fff", fontSize: 14, fontWeight: 500 }}>Dark Mode</span>
    </button>
  );
}

// ── Settings Component ─────────────────────────────────────────────────────────

export default function Settings({ open, onClose }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<"general" | "shortcuts">("general");

  if (!open) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 500,
      display: "flex",
      alignItems: "stretch",
    }}>
      {/* Backdrop */}
      <div
        onClick={() => setActiveTab("general")}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      />

      {/* Panel */}
      <div style={{
        position: "relative",
        zIndex: 1,
        width: "min(400px, 100vw)",
        background: "#0a0a0a",
        borderLeft: "1px solid #1a1a1a",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        overflowX: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "calc(60px + env(safe-area-inset-top, 0px)) 24px 20px",
          borderBottom: "1px solid #1a1a1a",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              color: "#999",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <ChevronLeft size={16} /> CLOSE
          </button>
          <div style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "#fff",
          }}>
            SETTINGS
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid #1a1a1a",
          padding: "0 24px",
          marginBottom: 16,
        }}>
          {[
            { id: "general", label: "General" },
            { id: "shortcuts", label: "Shortcuts" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "general" | "shortcuts")}
              style={{
                flex: 1,
                padding: "12px 0",
                background: "transparent",
                border: "none",
                color: activeTab === tab.id ? "#fff" : "#666",
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: "pointer",
                borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "general" && (
          <div style={{ padding: "0 24px 40px" }}>
            <ApiKeysCard />
            {/* Dark Mode Section */}
            <div style={{
              background: "#141414",
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              border: "1px solid #1e1e1e",
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <Palette size={18} color="#000" />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                    Appearance
                  </span>
                </div>
              </div>

              <DarkModeToggle />

              {/* Theme note */}
              <div style={{
                fontSize: 11,
                color: "#666",
                marginTop: 12,
                padding: "8px 10px",
                background: "#0a0a0a",
                borderRadius: 8,
              }}>
                Theme preference is saved automatically and syncs across devices when signed in.
              </div>
            </div>
          </div>
        )}

        {activeTab === "shortcuts" && (
          <div style={{ padding: "0 24px 40px" }}>
            <div style={{
              background: "#141414",
              borderRadius: 12,
              padding: 16,
              border: "1px solid #1e1e1e",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 16,
              }}>
                <Keyboard size={20} color="var(--accent)" />
                <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                  Keyboard Shortcuts
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { keys: "↑↓ ←→", action: "Navigate between photos" },
                  { keys: "Space", action: "Select / toggle favorite" },
                  { keys: "Enter", action: "Open lightbox" },
                  { keys: "D", action: "Enter delete mode" },
                  { keys: "Escape", action: "Close open panels" },
                  { keys: "?", action: "Show this help overlay" },
                ].map((shortcut, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      background: "#0a0a0a",
                      borderRadius: 6,
                      fontFamily: "inherit",
                    }}
                  >
                    <span style={{ color: "#888", fontSize: 13 }}>{shortcut.action}</span>
                    <span style={{
                      color: "#666",
                      fontSize: 12,
                      fontFamily: "monospace",
                      background: "#1e1e1e",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}>
                      {shortcut.keys}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: "0 24px 24px",
          display: "flex",
          justifyContent: "center",
          marginTop: "auto",
        }}>
          <span style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em" }}>
            Dumpster v1.0 • Lee Scott
          </span>
        </div>
      </div>
    </div>
  );
}
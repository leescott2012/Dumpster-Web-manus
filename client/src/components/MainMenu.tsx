/**
 * MainMenu — File Cabinet overlay, port of iOS FileCabinetMenuView
 * Full-screen dark overlay with staggered tab folders.
 * Tap a folder → sub-panel slides in from right.
 */
import { useState, useEffect, useRef } from "react";
import {
  X, Sparkles, Archive, Image, Paintbrush, Info, ChevronRight, ArrowLeft, Type, Wand2, Instagram,
  LogOut, User, Share2, Check, Cloud, CloudOff,
} from "lucide-react";
import { loadTasteProfile, saveTasteProfile, loadAIRules, saveAIRules } from "@/lib/captionPool";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ───────────────────────────────────────────────────────────────────

type Tab = "ai" | "dumps" | "pool" | "appearance" | "about" | "social";

interface Folder {
  id: Tab;
  title: string;
  subtitle: string;
  tabColor: string;
  icon: React.ReactNode;
}

interface MainMenuProps {
  open: boolean;
  onClose: () => void;
  onAISuggest: () => void;
  onCaptions: () => void;
  onIGScrub: () => void;
  onReset?: () => void;
  onTour?: () => void;
  onSignIn?: () => void;
  dumpCount: number;
  poolCount: number;
}

// ── Accent colours ──────────────────────────────────────────────────────────

const ACCENT_OPTIONS = [
  { name: "gold",     hex: "#C8A96E", label: "Gold" },
  { name: "silver",   hex: "#B0B0B0", label: "Silver" },
  { name: "rose",     hex: "#C8787E", label: "Rose" },
  { name: "emerald",  hex: "#6EC8A0", label: "Emerald" },
  { name: "sapphire", hex: "#6E8EC8", label: "Sapphire" },
  { name: "lavender", hex: "#A06EC8", label: "Lavender" },
];

function loadAccent(): string {
  return localStorage.getItem("dumpster_accent") || "#C8A96E";
}

function hexToRgb(hex: string): string {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  return r + "," + g + "," + b;
}

function saveAccent(hex: string) {
  localStorage.setItem("dumpster_accent", hex);
  document.documentElement.style.setProperty("--accent", hex);
  document.documentElement.style.setProperty("--accent-rgb", hexToRgb(hex));
}

export function initAccent() {
  var stored = loadAccent();
  document.documentElement.style.setProperty("--accent", stored);
  document.documentElement.style.setProperty("--accent-rgb", hexToRgb(stored));
}

// ── Component ───────────────────────────────────────────────────────────────

export default function MainMenu({ open, onClose, onAISuggest, onCaptions, onIGScrub, onReset, onTour, onSignIn, dumpCount, poolCount }: MainMenuProps) {
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [visible, setVisible] = useState(false);
  const [accent, setAccent] = useState(loadAccent);
  const { user, profile, signOut } = useAuth();

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      setTimeout(() => setActiveTab(null), 300);
    }
  }, [open]);

  function handleAccentChange(hex: string) {
    setAccent(hex);
    saveAccent(hex);
  }

  function handleFolderClick(id: Tab) {
    if (id === "dumps") {
      onClose();
      setTimeout(() => {
        const el = document.querySelector("[data-dump-id]");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 350);
      return;
    }
    if (id === "pool") {
      onClose();
      setTimeout(() => {
        const el = document.getElementById("photo-pool");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 350);
      return;
    }
    setActiveTab(id);
  }

  function handleAISuggestClick() {
    onClose();
    setTimeout(onAISuggest, 300);
  }
  function handleCaptionsClick() {
    onClose();
    setTimeout(onCaptions, 300);
  }
  function handleIGScrubClick() {
    onClose();
    setTimeout(onIGScrub, 300);
  }

  const folders: Folder[] = [
    {
      id: "ai", title: "AI TOOLS", tabColor: "var(--accent)",
      subtitle: "Auto-arrange · Captions · IG Scrub",
      icon: <Sparkles size={18} strokeWidth={1.5} />,
    },
    {
      id: "dumps", title: "MY DUMPS", tabColor: "#A8C8A0",
      subtitle: dumpCount + " dump" + (dumpCount !== 1 ? "s" : "") + " · Drag & sequence",
      icon: <Archive size={18} strokeWidth={1.5} />,
    },
    {
      id: "pool", title: "PHOTO POOL", tabColor: "#A0B8C8",
      subtitle: poolCount + " photos available",
      icon: <Image size={18} strokeWidth={1.5} />,
    },
    {
      id: "appearance", title: "APPEARANCE", tabColor: "#C8A0C0",
      subtitle: "Accent color",
      icon: <Paintbrush size={18} strokeWidth={1.5} />,
    },
    {
      id: "social", title: "SOCIAL MEDIA", tabColor: "#C8B0A0",
      subtitle: "Connect & export",
      icon: <Share2 size={18} strokeWidth={1.5} />,
    },
    {
      id: "about", title: "ABOUT / HELP", tabColor: "#C8B8A0",
      subtitle: "Dumpster · Version 1.0",
      icon: <Info size={18} strokeWidth={1.5} />,
    },
  ];

  if (!open && !visible) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      display: "flex", alignItems: "stretch",
    }}>
      {/* Backdrop */}
      <div
        onClick={() => activeTab ? setActiveTab(null) : onClose()}
        onTouchMove={function(e) { e.preventDefault(); }}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.3s ease",
          touchAction: "none",
        }}
      />

      {/* Panel */}
      <div style={{
        position: "relative", zIndex: 1,
        width: "min(420px, 100vw)",
        background: "#0a0a0a",
        borderRight: "1px solid #1a1a1a",
        display: "flex", flexDirection: "column",
        transform: visible ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
        overflowY: "auto",
        overflowX: "hidden",
        overscrollBehavior: "contain",
        WebkitOverflowScrolling: "touch",
      }}>
        {/* Header */}
        <div style={{
          padding: "60px 24px 20px",
          borderBottom: "1px solid #1a1a1a",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          flexShrink: 0,
        }}>
          <div>
            {activeTab ? (
              <button
                onClick={() => setActiveTab(null)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "none", border: "none", color: "#999",
                  fontSize: 12, fontWeight: 600, letterSpacing: "0.06em",
                  cursor: "pointer", fontFamily: "inherit", marginBottom: 6,
                  padding: 0,
                }}
              >
                <ArrowLeft size={14} /> BACK
              </button>
            ) : null}
            <div style={{
              fontSize: 22, fontWeight: 900, letterSpacing: "0.2em",
              color: "#fff", textTransform: "uppercase" as const,
            }}>
              {activeTab ? folders.find(f => f.id === activeTab)?.title : "MAIN MENU"}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
              {activeTab ? null : "Tap a folder to open"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(255,255,255,0.06)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "rgba(255,255,255,0.5)", flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "16px 20px 40px", position: "relative", overflowX: "hidden", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          {/* Folder list */}
          <div style={{
            display: "flex", flexDirection: "column", gap: 0,
            transform: activeTab ? "translateX(-100%)" : "translateX(0)",
            transition: "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
            position: activeTab ? "absolute" : "relative",
            width: "calc(100% - 40px)",
          }}>
            {/* User profile card */}
            {user ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px", marginBottom: 8,
                background: "#141414", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "var(--accent)", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 800, color: "#000",
                  flexShrink: 0, textTransform: "uppercase" as const,
                }}>
                  {(profile?.display_name || user.email || "U").charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                    {profile?.display_name || user.email || "User"}
                  </div>
                  {/* Always show email below display name so multi-account users
                      can verify which Google account is active (cross-device sync
                      only works for the same account on each device). */}
                  {user.email && profile?.display_name && profile.display_name !== user.email && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, marginTop: 1 }}>
                      {user.email}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: "var(--accent)", letterSpacing: "0.06em", textTransform: "uppercase" as const, marginTop: 3 }}>
                    {(profile?.subscription_tier === "pro" ? "PRO" : "FREE") + " · " + (profile ? (profile.credits + profile.daily_credits_remaining) : 0) + " credits"}
                  </div>
                </div>
                <button
                  onClick={function() { signOut(); onClose(); }}
                  style={{
                    background: "none", border: "none", color: "#555",
                    cursor: "pointer", padding: 6, display: "flex",
                    alignItems: "center", flexShrink: 0,
                  }}
                  title="Sign out"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={function() { onClose(); if (onSignIn) setTimeout(onSignIn, 350); }}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  width: "100%", padding: "14px 16px", marginBottom: 8,
                  background: "rgba(var(--accent-rgb),0.08)",
                  border: "1px solid rgba(var(--accent-rgb),0.2)",
                  borderRadius: 12, cursor: "pointer",
                  fontFamily: "inherit", textAlign: "left",
                  transition: "all 0.15s",
                }}
                onMouseEnter={function(e) { e.currentTarget.style.borderColor = "rgba(var(--accent-rgb),0.4)"; }}
                onMouseLeave={function(e) { e.currentTarget.style.borderColor = "rgba(var(--accent-rgb),0.2)"; }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "rgba(var(--accent-rgb),0.15)", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <User size={16} color="var(--accent)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>
                    Sign In
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
                    Save dumps · Get 15 free AI credits
                  </div>
                </div>
                <ChevronRight size={14} color="rgba(var(--accent-rgb),0.4)" style={{ flexShrink: 0 }} />
              </button>
            )}

            {folders.map((folder, i) => (
              <FolderRow
                key={folder.id}
                folder={folder}
                index={i}
                visible={visible}
                onClick={() => handleFolderClick(folder.id)}
              />
            ))}
          </div>

          {/* Sub-panel */}
          {activeTab && (
            <div style={{
              position: "relative",
              animation: "slideInRight 0.3s cubic-bezier(0.32, 0.72, 0, 1) forwards",
            }}>
              <style>{`@keyframes slideInRight { from { opacity:0; transform: translateX(40px); } to { opacity:1; transform: translateX(0); } }`}</style>
              {activeTab === "ai" && (
                <AIToolsPanel
                  onAISuggest={handleAISuggestClick}
                  onCaptions={handleCaptionsClick}
                  onIGScrub={handleIGScrubClick}
                  dumpCount={dumpCount}
                  poolCount={poolCount}
                />
              )}
              {activeTab === "appearance" && (
                <AppearancePanel accent={accent} onAccentChange={handleAccentChange} />
              )}
              {activeTab === "about" && <AboutPanel onReset={onReset} onTour={onTour ? function() { onClose(); setTimeout(function() { if (onTour) onTour(); }, 400); } : undefined} />}
              {activeTab === "social" && <SocialMediaPanel />}
            </div>
          )}
        </div>

        {/* Branding footer */}
        {!activeTab && (
          <div style={{
            padding: "0 24px 40px",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.25em", color: "rgba(var(--accent-rgb),0.25)", textTransform: "uppercase" as const }}>
              DUMPSTER
            </span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.12)", letterSpacing: "0.1em" }}>v1.0</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Folder Row ───────────────────────────────────────────────────────────────

function FolderRow({ folder, index, visible, onClick }: {
  folder: Folder; index: number; visible: boolean; onClick: () => void;
}) {
  const TAB_OFFSET = 48;
  const tabLeft = index * TAB_OFFSET + 16;

  return (
    <div style={{ paddingTop: 24, position: "relative" }}>
      {/* Tab sticking up */}
      <div style={{
        position: "absolute", top: 0, left: tabLeft,
        background: folder.tabColor,
        borderRadius: "6px 6px 0 0",
        padding: "4px 12px",
        display: "flex", alignItems: "center", gap: 5,
        pointerEvents: "none", zIndex: 1,
      }}>
        <span style={{ color: "#000", opacity: 0.7, display: "flex", alignItems: "center" }}>
          {folder.icon}
        </span>
        <span style={{
          fontSize: 8, fontWeight: 800, letterSpacing: "0.15em",
          color: "#000", opacity: 0.75, textTransform: "uppercase" as const,
          whiteSpace: "nowrap" as const,
        }}>
          {folder.title}
        </span>
      </div>

      {/* Folder card */}
      <button
        onClick={onClick}
        style={{
          width: "100%", textAlign: "left", cursor: "pointer",
          background: "#141414",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 14,
          padding: "16px 20px",
          display: "flex", alignItems: "center", gap: 14,
          transition: "all 0.15s",
          fontFamily: "inherit",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(16px)",
          transitionDelay: (index * 60) + "ms",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "#1c1c1c";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "#141414";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
        }}
      >
        <div style={{ color: folder.tabColor, opacity: 0.6, flexShrink: 0 }}>
          {folder.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.02em" }}>
            {folder.title}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
            {folder.subtitle}
          </div>
        </div>
        <ChevronRight size={14} color="rgba(255,255,255,0.2)" style={{ flexShrink: 0 }} />
      </button>
    </div>
  );
}

// ── AI Tools Panel ──────────────────────────────────────────────────────────

function AIToolsPanel({ onAISuggest, onCaptions, onIGScrub, dumpCount, poolCount }: {
  onAISuggest: () => void; onCaptions: () => void; onIGScrub: () => void;
  dumpCount: number; poolCount: number;
}) {
  const tools = [
    {
      id: "suggest",
      title: "Auto-arrange Dump",
      desc: "Claude Vision analyzes your pool and builds one cohesive carousel of 2–20 photos.",
      tone: "var(--accent)",
      icon: <Wand2 size={20} strokeWidth={1.5} />,
      meta: poolCount + " photos in pool",
      enabled: poolCount >= 2,
      disabledHint: "Need at least 2 pool photos",
      onClick: onAISuggest,
    },
    {
      id: "captions",
      title: "Generate Captions",
      desc: "3 Instagram caption options + vibe descriptor for any dump. Pick a tone.",
      tone: "#6E8EC8",
      icon: <Type size={20} strokeWidth={1.5} />,
      meta: dumpCount + " dump" + (dumpCount !== 1 ? "s" : "") + " ready",
      enabled: dumpCount > 0,
      disabledHint: "Create a dump first",
      onClick: onCaptions,
    },
    {
      id: "igscrub",
      title: "Instagram Scrub",
      desc: "Paste post URLs or direct image links — previews found images so you can pick what goes in your pool.",
      tone: "#C87EC8",
      icon: <Instagram size={20} strokeWidth={1.5} />,
      meta: "Any public URL",
      enabled: true,
      disabledHint: "",
      onClick: onIGScrub,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 4 }}>
        Powered by Claude Haiku & Apify
      </div>

      {tools.map(tool => (
        <button
          key={tool.id}
          onClick={tool.enabled ? tool.onClick : undefined}
          disabled={!tool.enabled}
          style={{
            width: "100%",
            background: tool.enabled ? "#141414" : "#0d0d0d",
            border: tool.enabled ? "1px solid " + tool.tone + "33" : "1px solid #1a1a1a",
            borderRadius: 14, padding: "16px 18px",
            display: "flex", flexDirection: "column", gap: 10,
            textAlign: "left", cursor: tool.enabled ? "pointer" : "not-allowed",
            fontFamily: "inherit", transition: "all 0.15s",
            opacity: tool.enabled ? 1 : 0.5,
            boxSizing: "border-box" as const,
          }}
          onMouseEnter={e => { if (tool.enabled) { e.currentTarget.style.borderColor = tool.tone + "66"; e.currentTarget.style.background = "#181818"; } }}
          onMouseLeave={e => { if (tool.enabled) { e.currentTarget.style.borderColor = tool.tone + "33"; e.currentTarget.style.background = "#141414"; } }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: tool.tone + "1a", border: "1px solid " + tool.tone + "40",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: tool.tone, flexShrink: 0,
            }}>
              {tool.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
                {tool.title}
              </div>
              <div style={{ fontSize: 10, color: tool.tone, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginTop: 3, fontWeight: 600 }}>
                {tool.enabled ? tool.meta : tool.disabledHint}
              </div>
            </div>
            <ChevronRight size={16} color={tool.enabled ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)"} />
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.55 }}>
            {tool.desc}
          </div>
        </button>
      ))}

      {/* Taste Profile + Rules */}
      <TasteProfileSection />

      <div style={{
        marginTop: 16, padding: "12px 14px",
        background: "rgba(var(--accent-rgb),0.04)", border: "1px solid rgba(var(--accent-rgb),0.12)",
        borderRadius: 10,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 4 }}>
          Coming soon
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.55 }}>
          Multiple AI providers · Batch caption all dumps · Saved scrub library
        </div>
      </div>
    </div>
  );
}

// ── Taste Profile + AI Rules — fed into Claude system prompts ───────────────

type SaveStatus = "idle" | "saving" | "saved";

function TasteProfileSection() {
  // Auth state — used to flip the sync indicator between Cloud (signed in,
  // syncing) and CloudOff (signed out, local-only). The actual cloud writes are
  // already handled in captionPool.ts via notifyAIProfileChanged → currentUser.
  const { user } = useAuth();
  const isSignedIn = !!user;

  const [profile, setProfile] = useState<string>(() => loadTasteProfile());
  const [rules, setRules] = useState<string>(() => loadAIRules());
  const [profileStatus, setProfileStatus] = useState<SaveStatus>("idle");
  const [rulesStatus, setRulesStatus] = useState<SaveStatus>("idle");

  // Auto-save with 1.2s debounce. Status flips:
  //   idle → saving (immediately on keystroke) → saved (when debounce fires)
  //   → idle (after 2.5s)
  // Three states give the user full confidence the cloud sync is happening.
  const profileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileSavedHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rulesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rulesSavedHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileInitialRef = useRef(profile);
  const rulesInitialRef = useRef(rules);

  useEffect(() => {
    if (profile === profileInitialRef.current) return;
    setProfileStatus("saving");
    if (profileSavedHideRef.current) clearTimeout(profileSavedHideRef.current);
    if (profileTimerRef.current) clearTimeout(profileTimerRef.current);
    profileTimerRef.current = setTimeout(() => {
      saveTasteProfile(profile);
      profileInitialRef.current = profile;
      setProfileStatus("saved");
      profileSavedHideRef.current = setTimeout(() => setProfileStatus("idle"), 2500);
    }, 1200);
    return () => { if (profileTimerRef.current) clearTimeout(profileTimerRef.current); };
  }, [profile]);

  useEffect(() => {
    if (rules === rulesInitialRef.current) return;
    setRulesStatus("saving");
    if (rulesSavedHideRef.current) clearTimeout(rulesSavedHideRef.current);
    if (rulesTimerRef.current) clearTimeout(rulesTimerRef.current);
    rulesTimerRef.current = setTimeout(() => {
      saveAIRules(rules);
      rulesInitialRef.current = rules;
      setRulesStatus("saved");
      rulesSavedHideRef.current = setTimeout(() => setRulesStatus("idle"), 2500);
    }, 1200);
    return () => { if (rulesTimerRef.current) clearTimeout(rulesTimerRef.current); };
  }, [rules]);

  // Belt + suspenders: on unmount, flush any pending changes immediately so
  // closing the menu mid-typing doesn't lose the last edit.
  useEffect(() => {
    return () => {
      if (profileTimerRef.current) {
        clearTimeout(profileTimerRef.current);
        saveTasteProfile(profile);
      }
      if (rulesTimerRef.current) {
        clearTimeout(rulesTimerRef.current);
        saveAIRules(rules);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
      {/* AI Taste Profile */}
      <div style={{ background: "#141414", border: "1px solid rgba(var(--accent-rgb),0.18)", borderRadius: 12, padding: "14px 14px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: "0.02em" }}>
              AI Taste Profile
              <CloudSyncBadge signedIn={isSignedIn} />
            </div>
            <SaveStatusPill status={profileStatus} />
          </div>
          <span style={{ fontSize: 10, color: "#555" }}>{profile.length}/750</span>
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, marginBottom: 8 }}>
          {isSignedIn
            ? "Describe your aesthetic. Saves automatically and syncs across your devices."
            : "Describe your aesthetic. Saves on this device. Sign in to sync across devices."}
        </div>
        <textarea
          value={profile}
          maxLength={750}
          onChange={e => setProfile(e.target.value)}
          placeholder="dark editorial, gold accents, automotive, late-night, no clichés..."
          style={{
            width: "100%", minHeight: 80, resize: "vertical",
            background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 8,
            padding: "10px 12px", fontSize: 12, color: "#e8e8e8",
            fontFamily: "inherit", lineHeight: 1.55, outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* AI Rules */}
      <div style={{ background: "#141414", border: "1px solid rgba(110,142,200,0.18)", borderRadius: 12, padding: "14px 14px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: "0.02em" }}>
              AI Rules
              <CloudSyncBadge signedIn={isSignedIn} />
            </div>
            <SaveStatusPill status={rulesStatus} />
          </div>
          <span style={{ fontSize: 10, color: "#555" }}>{rules.length}/500</span>
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, marginBottom: 8 }}>
          {isSignedIn
            ? "Strict rules the AI must follow. One per line. Saves automatically."
            : "Strict rules the AI must follow. Sign in to sync across devices."}
        </div>
        <textarea
          value={rules}
          maxLength={500}
          onChange={e => setRules(e.target.value)}
          placeholder={"no emojis\nno hashtags\nlowercase only"}
          style={{
            width: "100%", minHeight: 80, resize: "vertical",
            background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 8,
            padding: "10px 12px", fontSize: 12, color: "#e8e8e8",
            fontFamily: "inherit", lineHeight: 1.55, outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  );
}

/**
 * Visible save-state indicator next to the field title.
 *   - "saving" → animated dot + gray "Saving..." (debounce in flight)
 *   - "saved"  → green pill "✓ Saved" (visible 2.5s)
 *   - "idle"   → invisible (occupies no space)
 *
 * Sized big enough to read at arm's length on iPhone — beta testers were
 * missing the previous tiny 10px indicator.
 */
function SaveStatusPill({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  if (status === "saving") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 999,
        padding: "3px 8px 3px 7px",
        fontSize: 11, fontWeight: 600,
        color: "#888",
        letterSpacing: "0.01em",
      }}>
        <span style={{
          display: "inline-block", width: 6, height: 6, borderRadius: "50%",
          background: "#888",
          animation: "pulse-saving 1s ease-in-out infinite",
        }} />
        Saving…
        <style>{`@keyframes pulse-saving { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }`}</style>
      </span>
    );
  }

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "rgba(34,197,94,0.14)",
      border: "1px solid rgba(34,197,94,0.4)",
      borderRadius: 999,
      padding: "3px 9px 3px 7px",
      fontSize: 11, fontWeight: 700,
      color: "#4ade80",
      letterSpacing: "0.02em",
      animation: "pop-saved 0.25s ease-out",
    }}>
      <Check size={12} strokeWidth={3} /> Saved
      <style>{`@keyframes pop-saved { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
    </span>
  );
}

/**
 * Tiny inline cloud icon next to field titles indicating sync state:
 *   - signed in  → Cloud (accent color) with title "Synced across your devices"
 *   - signed out → CloudOff   (muted)        with title "Local-only — sign in to sync"
 *
 * Browser native tooltip via the title attribute is fine on desktop. On mobile
 * the user can tap-hold the icon to see it. Doesn't need a full tooltip
 * component for one byte of info.
 */
function CloudSyncBadge({ signedIn }: { signedIn: boolean }) {
  if (signedIn) {
    return (
      <span title="Synced across your devices" style={{ display: "inline-flex", alignItems: "center", color: "var(--accent)", opacity: 0.7 }}>
        <Cloud size={12} strokeWidth={2.2} />
      </span>
    );
  }
  return (
    <span title="Local-only on this device. Sign in to sync." style={{ display: "inline-flex", alignItems: "center", color: "#666" }}>
      <CloudOff size={12} strokeWidth={2.2} />
    </span>
  );
}

// ── Appearance Panel ─────────────────────────────────────────────────────────

function AppearancePanel({ accent, onAccentChange }: {
  accent: string; onAccentChange: (hex: string) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 16 }}>
        Accent Color
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {ACCENT_OPTIONS.map(opt => {
          const isActive = accent.toLowerCase() === opt.hex.toLowerCase();
          return (
            <button
              key={opt.name}
              onClick={() => onAccentChange(opt.hex)}
              title={opt.label}
              style={{
                width: 44, height: 44, borderRadius: 12,
                background: opt.hex,
                border: isActive ? "3px solid #fff" : "2px solid transparent",
                outline: isActive ? "2px solid " + opt.hex : "none",
                outlineOffset: 2,
                cursor: "pointer",
                transition: "all 0.15s",
                transform: isActive ? "scale(1.1)" : "scale(1)",
                boxShadow: isActive ? "0 4px 16px " + opt.hex + "66" : "none",
              }}
            />
          );
        })}
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
        {ACCENT_OPTIONS.find(o => o.hex.toLowerCase() === accent.toLowerCase())?.label ?? "Custom"}
      </div>

      <div style={{ marginTop: 36, fontSize: 11, color: "rgba(255,255,255,0.15)", fontStyle: "italic" }}>
        More appearance options coming soon — dark/light mode, card size.
      </div>
    </div>
  );
}

// ── Social Media Panel ──────────────────────────────────────────────────────

function SocialMediaPanel() {
  var platforms = [
    {
      name: "Instagram",
      icon: <Instagram size={20} strokeWidth={1.5} />,
      color: "#E1306C",
      desc: "Export carousels directly to Instagram",
    },
    {
      name: "TikTok",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.78a8.28 8.28 0 003.76.91V6.24a4.85 4.85 0 01-1-.14v.59z"/></svg>,
      color: "#fff",
      desc: "Share photo dumps as TikTok slideshows",
    },
    {
      name: "Twitter / X",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
      color: "#999",
      desc: "Post carousel threads to X",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
        Connect your accounts
      </div>

      {platforms.map(function(p) {
        return (
          <div
            key={p.name}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              background: "#141414", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14, padding: "16px 18px",
            }}
          >
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: p.color + "1a", border: "1px solid " + p.color + "40",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: p.color, flexShrink: 0,
            }}>
              {p.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
                {p.name}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                {p.desc}
              </div>
            </div>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
              color: "#555", textTransform: "uppercase",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6, padding: "4px 8px",
            }}>
              SOON
            </div>
          </div>
        );
      })}

      <div style={{
        marginTop: 16, padding: "14px 16px",
        background: "rgba(var(--accent-rgb),0.04)", border: "1px solid rgba(var(--accent-rgb),0.12)",
        borderRadius: 10,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
          Coming in v1.1
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
          Connect your social accounts to export carousels directly. Schedule posts, manage captions, and track engagement.
        </div>
      </div>
    </div>
  );
}

// ── About Panel ──────────────────────────────────────────────────────────────

function AboutPanel({ onReset, onTour }: { onReset?: () => void; onTour?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {[
        { label: "App", value: "Dumpster" },
        { label: "Version", value: "1.0.0" },
        { label: "Platform", value: "Web" },
        { label: "AI Model", value: "Claude Haiku Vision" },
        { label: "Made by", value: "Lee Scott" },
      ].map(row => (
        <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 16 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>{row.label}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>{row.value}</span>
        </div>
      ))}

      {onTour && (
        <div>
          <button
            onClick={onTour}
            style={{
              width: "100%", padding: "12px", borderRadius: 10,
              background: "rgba(var(--accent-rgb),0.1)", border: "1px solid rgba(var(--accent-rgb),0.25)",
              color: "var(--accent)", fontSize: 12, fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", letterSpacing: "0.04em",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            TAKE A TOUR
          </button>
        </div>
      )}

      {onReset && (
        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => {
              if (confirm("Reset all dumps and photos to original state? This cannot be undone.")) {
                onReset();
              }
            }}
            style={{
              width: "100%", padding: "12px", borderRadius: 10,
              background: "rgba(255,59,48,0.1)", border: "1px solid rgba(255,59,48,0.2)",
              color: "#ff3b30", fontSize: 12, fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", letterSpacing: "0.04em",
            }}
          >
            RESET TO ORIGINAL STATE
          </button>
        </div>
      )}

      {/* Legal links — required for Google OAuth verification */}
      <div style={{
        marginTop: 16, paddingTop: 16,
        borderTop: "1px solid rgba(255,255,255,0.05)",
        display: "flex", gap: 16,
        fontSize: 11, color: "rgba(255,255,255,0.4)",
        letterSpacing: "0.04em",
      }}>
        <a href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>Privacy</a>
        <a href="/terms" style={{ color: "inherit", textDecoration: "none" }}>Terms</a>
        <a href="mailto:axiomonellc@outlook.com" style={{ color: "inherit", textDecoration: "none", marginLeft: "auto" }}>Contact</a>
      </div>
    </div>
  );
}

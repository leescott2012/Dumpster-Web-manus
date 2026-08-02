/**
 * OnboardingFlow — blocking first-run setup for new users.
 *
 * Replaces the old username-only gate: same hard-block contract (no dismiss
 * control, renders over everything), but walks a new user through the whole
 * account setup in one pass — username/avatar, a real photo library, and a
 * taste profile — so they land in a populated app instead of an empty one.
 *
 * Gate condition lives in Home.tsx: open while the signed-in user's profile
 * has no `onboarding_completed_at`. Existing users were backfilled at migration
 * time, so only genuinely-new accounts see this.
 *
 * Step 1 (username) is skipped for anyone who already has one.
 */
import { useEffect, useRef, useState } from "react";
import { Loader, Check, X as XIcon, Upload, Sparkles, Instagram } from "lucide-react";
import { getAuthHeaders, supabase } from "@/lib/supabase";
import { AVATAR_ICONS, AVATAR_COLORS, type AvatarIconName } from "@/lib/avatarIcons";
import { loadTasteProfile, saveTasteProfile } from "@/lib/captionPool";

/** Photos required before a user can finish setup and start making dumps. */
export var MIN_PHOTOS = 30;

interface OnboardingFlowProps {
  open: boolean;
  /** Current pool size — drives the photo-step progress and gate. */
  poolCount: number;
  /** True when the profile already has a username (skip step 1). */
  hasUsername: boolean;
  /** Supabase user id, for marking completion. */
  userId: string | null;
  onUploadPhotos: (files: FileList) => void;
  /** Cluster the pool into dumps via AI (costs credits). */
  onAICreateDumps: () => void;
  /** Create a single empty dump to start with. */
  onCreateDump: () => void;
  /** Fired once setup is saved — Home refreshes the profile. */
  onDone: () => void;
}

type CheckState = "idle" | "checking" | "available" | "taken" | "invalid";
type Step = "username" | "photos" | "taste" | "finish";

export default function OnboardingFlow(props: OnboardingFlowProps) {
  var [step, setStep] = useState<Step>(props.hasUsername ? "photos" : "username");

  // Step 1 — username + avatar
  var [username, setUsername] = useState("");
  var [checkState, setCheckState] = useState<CheckState>("idle");
  var [checkReason, setCheckReason] = useState<string | null>(null);
  var [icon, setIcon] = useState<AvatarIconName>(AVATAR_ICONS[0].name);
  var [color, setColor] = useState(AVATAR_COLORS[0]);
  var [saving, setSaving] = useState(false);
  var [saveError, setSaveError] = useState<string | null>(null);
  var timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2 — photos
  var fileInputRef = useRef<HTMLInputElement | null>(null);

  // Step 3 — taste profile
  var [taste, setTaste] = useState(function () { return loadTasteProfile(); });
  var [igURL, setIgURL] = useState("");
  var [scrubbing, setScrubbing] = useState(false);
  var [scrubError, setScrubError] = useState<string | null>(null);

  // Step 4 — finishing
  var [finishing, setFinishing] = useState(false);

  useEffect(function () {
    if (!props.open || step !== "username") return;
    if (timerRef.current) clearTimeout(timerRef.current);
    var trimmed = username.trim();
    if (trimmed.length < 3) {
      setCheckState("idle");
      return;
    }
    setCheckState("checking");
    timerRef.current = setTimeout(async function () {
      try {
        var headers = await getAuthHeaders();
        var res = await fetch("/api/check-username?username=" + encodeURIComponent(trimmed), { headers: headers });
        var data = await res.json();
        if (data.available) {
          setCheckState("available");
          setCheckReason(null);
        } else {
          setCheckState(data.reason ? "invalid" : "taken");
          setCheckReason(data.reason || "That username is taken");
        }
      } catch {
        setCheckState("idle");
      }
    }, 400);
    return function () { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [username, props.open, step]);

  if (!props.open) return null;

  async function saveUsername() {
    if (checkState !== "available") return;
    setSaving(true);
    setSaveError(null);
    try {
      var headers = await getAuthHeaders();
      var res = await fetch("/api/check-username", {
        method: "PATCH",
        headers: Object.assign({ "Content-Type": "application/json" }, headers),
        body: JSON.stringify({ username: username.trim(), avatar_icon: icon, avatar_color: color }),
      });
      var data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || "Couldn't save — try another username");
        setCheckState("taken");
        setSaving(false);
        return;
      }
      setSaving(false);
      setStep("photos");
    } catch {
      setSaveError("Network error — try again");
      setSaving(false);
    }
  }

  /**
   * Reuses the existing profile-scrub mode of /api/ig-scrub (Apify scrape →
   * Claude distills a style description). Optional by design: a credit failure
   * or a private/invalid handle must not wall someone out of setup, so every
   * failure path just surfaces a message and leaves the textarea editable.
   */
  async function scrubInstagram() {
    var handle = igURL.trim();
    if (!handle) return;
    var url = /instagram\.com\//i.test(handle)
      ? handle
      : "https://instagram.com/" + handle.replace(/^@/, "");
    setScrubbing(true);
    setScrubError(null);
    try {
      var headers = await getAuthHeaders();
      var res = await fetch("/api/ig-scrub", {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, headers),
        body: JSON.stringify({ profileURL: url }),
      });
      var data = await res.json();
      if (!res.ok) {
        setScrubError(data.error || "Couldn't read that profile — you can type your style instead");
        setScrubbing(false);
        return;
      }
      var pieces = [data.description, data.engagementPlaybook].filter(Boolean).join("\n\n");
      if (!pieces) {
        setScrubError("Nothing usable came back — try another profile or type your style instead");
        setScrubbing(false);
        return;
      }
      setTaste(function (prev) { return prev.trim() ? prev.trim() + "\n\n" + pieces : pieces; });
      setScrubbing(false);
    } catch {
      setScrubError("Network error — you can type your style instead");
      setScrubbing(false);
    }
  }

  async function finish(useAI: boolean) {
    setFinishing(true);
    saveTasteProfile(taste.trim());
    if (useAI) props.onAICreateDumps();
    else props.onCreateDump();
    // Client-side profile update, matching how AuthContext already writes to
    // `profiles` — deliberately not a new API route, the project is at Vercel's
    // 12-function Hobby cap.
    try {
      if (props.userId) {
        await supabase.from("profiles")
          .update({ onboarding_completed_at: new Date().toISOString() })
          .eq("id", props.userId);
      }
    } catch {
      // Non-fatal: worst case the flow reopens next load. Never trap the user
      // behind a failed write.
    }
    setFinishing(false);
    props.onDone();
  }

  var steps: Step[] = props.hasUsername
    ? ["photos", "taste", "finish"]
    : ["username", "photos", "taste", "finish"];
  var stepIndex = steps.indexOf(step);
  var photosLeft = Math.max(0, MIN_PHOTOS - props.poolCount);

  return (
    <>
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(6px)", zIndex: 900,
      }} />
      <div style={{
        position: "fixed", inset: 0, zIndex: 901,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}>
        <div style={{
          width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto",
          background: "#0e0e0e", border: "1px solid #2a2a2a", borderRadius: 20, padding: 28,
        }}>
          {/* Progress dots */}
          <div style={{ display: "flex", gap: 6, marginBottom: 22 }}>
            {steps.map(function (s, i) {
              return (
                <div key={s} style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: i <= stepIndex ? "#fff" : "#2a2a2a",
                  transition: "background 0.3s",
                }} />
              );
            })}
          </div>

          {step === "username" && (
            <>
              <div style={titleStyle}>Choose a username</div>
              <div style={subStyle}>
                Needed so other users can find and connect with you. 3-20 characters, letters/numbers/underscore.
              </div>

              <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%", background: color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {(function () {
                    var Selected = AVATAR_ICONS.find(function (a) { return a.name === icon; })?.Icon || AVATAR_ICONS[0].Icon;
                    return <Selected size={28} color="#0e0e0e" strokeWidth={2.2} />;
                  })()}
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 14 }}>
                {AVATAR_ICONS.map(function (a) {
                  var IconCmp = a.Icon;
                  var selected = a.name === icon;
                  return (
                    <button key={a.name} onClick={function () { setIcon(a.name); }} style={{
                      width: 34, height: 34, borderRadius: "50%",
                      background: selected ? color : "#1a1a1a",
                      border: selected ? "2px solid #fff" : "1px solid #2a2a2a",
                      display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                    }}>
                      <IconCmp size={16} color={selected ? "#0e0e0e" : "#8a8a8a"} />
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 22 }}>
                {AVATAR_COLORS.map(function (c) {
                  var selected = c === color;
                  return (
                    <button key={c} onClick={function () { setColor(c); }} style={{
                      width: 22, height: 22, borderRadius: "50%", background: c,
                      border: selected ? "2px solid #fff" : "1px solid rgba(255,255,255,0.2)",
                      cursor: "pointer",
                    }} />
                  );
                })}
              </div>

              <div style={{ position: "relative", marginBottom: 8 }}>
                <input
                  value={username}
                  onChange={function (e) { setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "")); }}
                  placeholder="username"
                  autoFocus
                  style={Object.assign({}, inputStyle, {
                    padding: "13px 40px 13px 14px",
                    border: "1px solid " + (checkState === "taken" || checkState === "invalid" ? "#7a2a2a" : "#2a2a2a"),
                  })}
                />
                <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
                  {checkState === "checking" && <Loader size={16} color="#666" style={{ animation: "spin 0.8s linear infinite" }} />}
                  {checkState === "available" && <Check size={16} color="#4ade80" />}
                  {(checkState === "taken" || checkState === "invalid") && <XIcon size={16} color="#ef4444" />}
                </div>
              </div>
              {checkReason && (checkState === "taken" || checkState === "invalid") && (
                <div style={errStyle}>{checkReason}</div>
              )}
              {saveError && <div style={errStyle}>{saveError}</div>}

              <PrimaryButton
                onClick={saveUsername}
                disabled={checkState !== "available" || saving}
                busy={saving}
                label="Continue"
              />
            </>
          )}

          {step === "photos" && (
            <>
              <div style={titleStyle}>Add your photos</div>
              <div style={subStyle}>
                Dumpster needs a library to work with. Pick at least {MIN_PHOTOS} photos — the more you add,
                the better it gets at grouping and captioning them.
              </div>

              <div style={{
                border: "1px solid #2a2a2a", borderRadius: 14, padding: 20,
                marginBottom: 18, textAlign: "center",
              }}>
                <div style={{ fontSize: 34, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
                  {props.poolCount}
                  <span style={{ fontSize: 18, color: "#555", fontWeight: 600 }}> / {MIN_PHOTOS}</span>
                </div>
                <div style={{ height: 4, background: "#1a1a1a", borderRadius: 2, margin: "12px 0 10px", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 2, background: photosLeft === 0 ? "#4ade80" : "#fff",
                    width: Math.min(100, (props.poolCount / MIN_PHOTOS) * 100) + "%",
                    transition: "width 0.4s ease",
                  }} />
                </div>
                <div style={{ fontSize: 12, color: photosLeft === 0 ? "#4ade80" : "#777" }}>
                  {photosLeft === 0
                    ? "Nice — that's enough to get started"
                    : photosLeft + " more to go"}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                style={{ display: "none" }}
                onChange={function (e) {
                  if (e.target.files && e.target.files.length > 0) props.onUploadPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                onClick={function () { if (fileInputRef.current) fileInputRef.current.click(); }}
                style={secondaryButtonStyle}
              >
                <Upload size={16} /> Choose photos
              </button>

              <PrimaryButton
                onClick={function () { setStep("taste"); }}
                disabled={props.poolCount < MIN_PHOTOS}
                busy={false}
                label={photosLeft === 0 ? "Continue" : "Add " + photosLeft + " more to continue"}
              />
            </>
          )}

          {step === "taste" && (
            <>
              <div style={titleStyle}>Your style</div>
              <div style={subStyle}>
                This teaches Dumpster how to caption and group your photos the way you'd want.
                Pull it from an Instagram account, or just describe it yourself.
              </div>

              <div style={{ fontSize: 11, color: "#777", marginBottom: 8, letterSpacing: "0.04em" }}>
                PULL FROM INSTAGRAM — yours, or an account you want to take inspiration from
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Instagram size={15} color="#666" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    value={igURL}
                    onChange={function (e) { setIgURL(e.target.value); }}
                    placeholder="@username"
                    style={Object.assign({}, inputStyle, { padding: "12px 12px 12px 34px" })}
                  />
                </div>
                <button
                  onClick={scrubInstagram}
                  disabled={!igURL.trim() || scrubbing}
                  style={{
                    padding: "0 16px", borderRadius: 12, border: "1px solid #2a2a2a",
                    background: "#1a1a1a", color: igURL.trim() ? "#e8e8e8" : "#555",
                    fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                    cursor: igURL.trim() && !scrubbing ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                  }}
                >
                  {scrubbing
                    ? <Loader size={14} style={{ animation: "spin 0.8s linear infinite" }} />
                    : <Sparkles size={14} />}
                  {scrubbing ? "Reading" : "Read"}
                </button>
              </div>
              {scrubError && <div style={errStyle}>{scrubError}</div>}

              <div style={{ fontSize: 11, color: "#777", margin: "16px 0 8px", letterSpacing: "0.04em" }}>
                YOUR STYLE PROFILE
              </div>
              <textarea
                value={taste}
                onChange={function (e) { setTaste(e.target.value); }}
                placeholder="e.g. moody film-grain city shots, dry one-line captions, never use emoji"
                rows={6}
                style={Object.assign({}, inputStyle, {
                  padding: 12, resize: "vertical" as const, lineHeight: 1.5, minHeight: 110,
                })}
              />

              <PrimaryButton
                onClick={function () { setStep("finish"); }}
                disabled={taste.trim().length < 10}
                busy={false}
                label={taste.trim().length < 10 ? "Describe your style to continue" : "Continue"}
              />
            </>
          )}

          {step === "finish" && (
            <>
              <div style={titleStyle}>Make your first dump</div>
              <div style={subStyle}>
                A dump is a set of photos you post together. Let Dumpster group your {props.poolCount} photos
                for you, or start an empty one and pick them yourself.
              </div>

              <button
                onClick={function () { finish(true); }}
                disabled={finishing}
                style={Object.assign({}, secondaryButtonStyle, {
                  border: "1px solid rgba(var(--accent-rgb),0.45)",
                  background: "rgba(var(--accent-rgb),0.08)",
                  color: "var(--accent)",
                })}
              >
                <Sparkles size={16} /> Group them for me
              </button>

              <PrimaryButton
                onClick={function () { finish(false); }}
                disabled={finishing}
                busy={finishing}
                label="I'll pick them myself"
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Shared bits of chrome ───────────────────────────────────────────────────

var titleStyle: React.CSSProperties = {
  fontSize: 19, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em", marginBottom: 6,
};
var subStyle: React.CSSProperties = {
  fontSize: 12, color: "#777", marginBottom: 20, lineHeight: 1.5,
};
var errStyle: React.CSSProperties = {
  fontSize: 11, color: "#ef4444", marginBottom: 10,
};
var inputStyle: React.CSSProperties = {
  width: "100%", borderRadius: 12, background: "#141414", border: "1px solid #2a2a2a",
  color: "#e8e8e8", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  padding: "13px 14px",
};
var secondaryButtonStyle: React.CSSProperties = {
  width: "100%", padding: "13px 20px", borderRadius: 12, marginBottom: 10,
  background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#e8e8e8",
  fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
};

function PrimaryButton(p: { onClick: () => void; disabled: boolean; busy: boolean; label: string }) {
  var enabled = !p.disabled;
  return (
    <button
      onClick={p.onClick}
      disabled={p.disabled}
      style={{
        width: "100%", padding: "14px 20px", borderRadius: 12, marginTop: 8,
        background: enabled ? "#fff" : "#2a2a2a",
        border: "none", color: enabled ? "#000" : "#666",
        fontSize: 15, fontWeight: 700, fontFamily: "inherit",
        cursor: enabled ? "pointer" : "not-allowed",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}
    >
      {p.busy ? <Loader size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : p.label}
    </button>
  );
}

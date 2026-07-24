/**
 * UsernameGateModal — blocking, centered modal that requires a username
 * before the app is usable. Shown whenever a signed-in user's profile has no
 * username yet (new signups going forward, and existing users backfilled on
 * next open — same gate on web and native per the spec).
 *
 * No dismiss/close control by design — this is a hard requirement, not a
 * suggestion. Renders on top of everything else once `open` is true.
 */
import { useEffect, useRef, useState } from "react";
import { Loader, Check, X as XIcon } from "lucide-react";
import { getAuthHeaders } from "@/lib/supabase";
import { AVATAR_ICONS, AVATAR_COLORS, type AvatarIconName } from "@/lib/avatarIcons";

interface UsernameGateModalProps {
  open: boolean;
  onDone: (username: string, avatarIcon: string, avatarColor: string) => void;
}

type CheckState = "idle" | "checking" | "available" | "taken" | "invalid";

export default function UsernameGateModal({ open, onDone }: UsernameGateModalProps) {
  var [username, setUsername] = useState("");
  var [checkState, setCheckState] = useState<CheckState>("idle");
  var [checkReason, setCheckReason] = useState<string | null>(null);
  var [icon, setIcon] = useState<AvatarIconName>(AVATAR_ICONS[0].name);
  var [color, setColor] = useState(AVATAR_COLORS[0]);
  var [saving, setSaving] = useState(false);
  var [saveError, setSaveError] = useState<string | null>(null);
  var timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(function () {
    if (!open) return;
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
  }, [username, open]);

  if (!open) return null;

  async function handleSave() {
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
      onDone(username.trim(), icon, color);
    } catch {
      setSaveError("Network error — try again");
      setSaving(false);
    }
  }

  var canSubmit = checkState === "available" && !saving;

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
          width: "100%", maxWidth: 380, background: "#0e0e0e",
          border: "1px solid #2a2a2a", borderRadius: 20, padding: 28,
        }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em", marginBottom: 6 }}>
            Choose a username
          </div>
          <div style={{ fontSize: 12, color: "#777", marginBottom: 20, lineHeight: 1.5 }}>
            Needed so other users can find and connect with you. 3-20 characters, letters/numbers/underscore.
          </div>

          {/* Avatar preview + icon picker */}
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

          {/* Username input */}
          <div style={{ position: "relative", marginBottom: 8 }}>
            <input
              value={username}
              onChange={function (e) { setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "")); }}
              placeholder="username"
              autoFocus
              style={{
                width: "100%", padding: "13px 40px 13px 14px", borderRadius: 12,
                background: "#141414", border: "1px solid " + (checkState === "taken" || checkState === "invalid" ? "#7a2a2a" : "#2a2a2a"),
                color: "#e8e8e8", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
              }}
            />
            <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
              {checkState === "checking" && <Loader size={16} color="#666" style={{ animation: "spin 0.8s linear infinite" }} />}
              {checkState === "available" && <Check size={16} color="#4ade80" />}
              {(checkState === "taken" || checkState === "invalid") && <XIcon size={16} color="#ef4444" />}
            </div>
          </div>
          {checkReason && (checkState === "taken" || checkState === "invalid") && (
            <div style={{ fontSize: 11, color: "#ef4444", marginBottom: 10 }}>{checkReason}</div>
          )}
          {saveError && <div style={{ fontSize: 11, color: "#ef4444", marginBottom: 10 }}>{saveError}</div>}

          <button
            onClick={handleSave}
            disabled={!canSubmit}
            style={{
              width: "100%", padding: "14px 20px", borderRadius: 12, marginTop: 8,
              background: canSubmit ? "#fff" : "#2a2a2a",
              border: "none", color: canSubmit ? "#000" : "#666",
              fontSize: 15, fontWeight: 700, fontFamily: "inherit",
              cursor: canSubmit ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {saving ? <Loader size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : "Continue"}
          </button>
        </div>
      </div>
    </>
  );
}

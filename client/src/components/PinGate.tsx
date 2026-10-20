/**
 * PinGate — 4-digit PIN to unlock Dumpster on this device (see lib/pinLock.ts).
 * Shows the lock screen when a PIN exists, and a skippable "set a PIN" prompt once after sign-in.
 */
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { hasPin, setPin, verifyPin, removePin, isUnlocked, markUnlocked, lockNow, setupDismissed, dismissSetup } from "@/lib/pinLock";

var APP = "dumpster";
var BACKGROUND_RELOCK_MS = 5 * 60 * 1000;

function Pad(props: { title: string; subtitle?: string; error?: string | null; disabled?: boolean; onDigits: (pin: string) => void; footer?: React.ReactNode }) {
  var [digits, setDigits] = useState("");
  // Reset the dots whenever the screen's title/error changes (new attempt).
  useEffect(function() { setDigits(""); }, [props.title, props.error]);
  function press(d: string) {
    if (props.disabled) return;
    var next = digits + d;
    setDigits(next);
    if (next.length === 4) props.onDigits(next);
  }
  var keyStyle = { width: 72, height: 72, borderRadius: 36, background: "#141414", border: "1px solid #2a2a2a", color: "#fff", fontSize: 26, fontFamily: "inherit", cursor: "pointer" } as const;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 800, background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 24 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{props.title}</div>
      {props.subtitle && <div style={{ fontSize: 13, color: "#8a8a8a", textAlign: "center", maxWidth: 280 }}>{props.subtitle}</div>}
      <div style={{ display: "flex", gap: 14, margin: "6px 0" }}>
        {[0, 1, 2, 3].map(function(i) {
          return <div key={i} style={{ width: 14, height: 14, borderRadius: 7, border: "1.5px solid var(--accent)", background: i < digits.length ? "var(--accent)" : "transparent" }} />;
        })}
      </div>
      <div style={{ minHeight: 18, fontSize: 12, color: "#ef4444", textAlign: "center" }}>{props.error || ""}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 72px)", gap: 14, opacity: props.disabled ? 0.4 : 1 }}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(function(d) {
          return <button key={d} onClick={function() { press(d); }} style={keyStyle}>{d}</button>;
        })}
        <div />
        <button onClick={function() { press("0"); }} style={keyStyle}>0</button>
        <button onClick={function() { setDigits(digits.slice(0, -1)); }} aria-label="Delete" style={{ ...keyStyle, fontSize: 18 }}>⌫</button>
      </div>
      {props.footer}
    </div>
  );
}

export default function PinGate() {
  var { user, signOut } = useAuth();
  var uid = user ? user.id : "";
  var [locked, setLocked] = useState(function() { return !!uid && hasPin(APP, uid) && !isUnlocked(APP); });
  var [setup, setSetup] = useState<"off" | "choose" | "confirm">("off");
  var [first, setFirst] = useState("");
  var [error, setError] = useState<string | null>(null);
  var [wait, setWait] = useState(0);

  // Re-evaluate when the signed-in user changes.
  useEffect(function() {
    if (!uid) { setLocked(false); setSetup("off"); return; }
    if (hasPin(APP, uid)) { setLocked(!isUnlocked(APP)); setSetup("off"); }
    else if (!setupDismissed(APP, uid) && user && user.phone) setSetup("choose");   // after phone verification
  }, [uid, user && user.phone]);

  // Re-lock after 5+ minutes in the background.
  useEffect(function() {
    var hiddenAt = 0;
    function onVis() {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt > BACKGROUND_RELOCK_MS && uid && hasPin(APP, uid)) { lockNow(APP); setLocked(true); }
      hiddenAt = 0;
    }
    document.addEventListener("visibilitychange", onVis);
    return function() { document.removeEventListener("visibilitychange", onVis); };
  }, [uid]);

  useEffect(function() {
    if (wait <= 0) return;
    var t = setTimeout(function() { setWait(wait - 1); }, 1000);
    return function() { clearTimeout(t); };
  }, [wait]);

  if (!uid) return null;

  if (locked) {
    return (
      <Pad
        title="Enter your PIN"
        error={wait > 0 ? "Too many tries. Wait " + wait + "s." : error}
        disabled={wait > 0}
        onDigits={async function(pin) {
          var r = await verifyPin(APP, uid, pin);
          if (r.ok) { markUnlocked(APP); setLocked(false); setError(null); return; }
          if (r.forceSignOut) { await signOut(); return; }   // 5 wrong PINs: back to a full code sign-in
          setWait(r.waitSeconds);
          setError("Wrong PIN. " + r.remaining + " tries left.");
        }}
        footer={<button onClick={function() { removePin(APP, uid); signOut(); }} style={{ background: "none", border: "none", color: "#8a8a8a", fontSize: 12, cursor: "pointer", fontFamily: "inherit", marginTop: 8 }}>Forgot PIN? Sign in with a code</button>}
      />
    );
  }

  if (setup === "choose" || setup === "confirm") {
    return (
      <Pad
        title={setup === "choose" ? "Set a 4-digit PIN" : "Confirm your PIN"}
        subtitle={setup === "choose" ? "Unlock Dumpster quickly on this device. You'll still use a code to sign in on a new device." : undefined}
        error={error}
        onDigits={async function(pin) {
          if (setup === "choose") { setFirst(pin); setError(null); setSetup("confirm"); return; }
          if (pin !== first) { setError("PINs didn't match. Try again."); setFirst(""); setSetup("choose"); return; }
          await setPin(APP, uid, pin);
          markUnlocked(APP);
          setSetup("off");
        }}
        footer={<button onClick={function() { dismissSetup(APP, uid); setSetup("off"); }} style={{ background: "none", border: "none", color: "#8a8a8a", fontSize: 12, cursor: "pointer", fontFamily: "inherit", marginTop: 8 }}>Not now</button>}
      />
    );
  }
  return null;
}

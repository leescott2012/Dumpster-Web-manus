/**
 * PhoneGate — blocks a signed-in account until it has a verified phone number.
 * The verified number is stored on the account itself (Supabase Auth -> Users).
 * Accounts that signed in with a phone already have one and never see this.
 */
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import PhoneCodeForm from "@/components/PhoneCodeForm";

// Phone verification is optional: skipping is remembered per account on this device.
var skipKey = function(id: string) { return "dumpster_phone_skip_" + id; };
export function phoneSkipped(id: string | undefined): boolean {
  if (!id) return false;
  try { return localStorage.getItem(skipKey(id)) === "1"; } catch (_) { return false; }
}

export default function PhoneGate() {
  var { signOut, user } = useAuth();
  var [, setTick] = useState(0);
  function skip() {
    try { if (user) localStorage.setItem(skipKey(user.id), "1"); } catch (_) { /* noop */ }
    setTick(function(n) { return n + 1; });
  }
  if (phoneSkipped(user?.id)) return null;
  // On verify success Supabase fires USER_UPDATED; AuthContext picks up user.phone and this gate unmounts.
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#0e0e0e", border: "1px solid #2a2a2a", borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Verify your phone <span style={{ fontSize: 11, fontWeight: 700, color: "#c9a96a", marginLeft: 6 }}>OPTIONAL</span></div>
        <div style={{ fontSize: 13, color: "#8a8a8a", lineHeight: 1.5 }}>
          Optional: add a phone number to keep your account secure. We'll text you a 6-digit code. You can skip this and use the app without it.
        </div>
        <PhoneCodeForm mode="add" lockedHint="Sign out below and sign in a different way, or try again later." />
        <button onClick={skip}
          style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, color: "#e8e8e8", fontSize: 13, fontWeight: 700, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit" }}>
          Skip for now
        </button>
        <button onClick={function() { signOut(); }}
          style={{ background: "none", border: "none", color: "#555", fontSize: 12, cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>
          Sign out
        </button>
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    </div>
  );
}

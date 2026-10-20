/**
 * PhoneGate — blocks a signed-in account until it has a verified phone number.
 * The verified number is stored on the account itself (Supabase Auth -> Users).
 * Accounts that signed in with a phone already have one and never see this.
 */
import { useState } from "react";
import { Loader } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// US numbers by default: 10 digits -> +1XXXXXXXXXX; anything starting with + is used as typed.
function toE164(raw: string) {
  var t = raw.trim();
  if (t.charAt(0) === "+") return "+" + t.replace(/\D/g, "");
  var d = t.replace(/\D/g, "");
  if (d.length === 11 && d.charAt(0) === "1") return "+" + d;
  return d.length === 10 ? "+1" + d : "";
}

export default function PhoneGate() {
  var { addPhone, verifyAddedPhone, signOut } = useAuth();
  var [phone, setPhone] = useState("");
  var [code, setCode] = useState("");
  var [codeSent, setCodeSent] = useState(false);
  var [busy, setBusy] = useState(false);
  var [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    var e164 = toE164(phone);
    if (!e164) { setError("Enter a valid phone number, like 404 555 1234."); return; }
    setBusy(true);
    var result = codeSent ? await verifyAddedPhone(e164, code.trim()) : await addPhone(e164);
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    // On verify success Supabase fires USER_UPDATED; AuthContext picks up user.phone and this gate unmounts.
    if (!codeSent) setCodeSent(true);
  }

  var field = { width: "100%", padding: "14px 16px", borderRadius: 12, background: "#141414", border: "1px solid #2a2a2a", color: "#e8e8e8", fontSize: 16, fontFamily: "inherit", boxSizing: "border-box" } as const;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#0e0e0e", border: "1px solid #2a2a2a", borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Verify your phone</div>
        <div style={{ fontSize: 13, color: "#8a8a8a", lineHeight: 1.5 }}>
          Add a phone number to keep your account secure. We'll text you a 6-digit code.
        </div>
        <input type="tel" inputMode="tel" autoComplete="tel" placeholder="Phone number"
          value={phone} disabled={codeSent || busy}
          onChange={function(e) { setPhone(e.target.value); }} style={field} />
        {codeSent && (
          <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code"
            value={code} disabled={busy}
            onChange={function(e) { setCode(e.target.value.replace(/\D/g, "")); }}
            style={{ ...field, letterSpacing: 4 }} />
        )}
        <button onClick={submit}
          disabled={busy || (codeSent ? code.length < 6 : phone.trim().length < 10)}
          style={{ width: "100%", padding: "15px 20px", borderRadius: 12, background: "var(--accent)", border: "none", color: "#000", fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {busy && <Loader size={18} style={{ animation: "spin 0.8s linear infinite" }} />}
          {codeSent ? "Verify code" : "Text me a code"}
        </button>
        {codeSent && (
          <button onClick={function() { setCodeSent(false); setCode(""); setError(null); }}
            style={{ background: "none", border: "none", color: "#8a8a8a", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            Wrong number? Go back
          </button>
        )}
        {error && (
          <div style={{ fontSize: 12, color: "#ef4444", padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)" }}>
            {error}
          </div>
        )}
        <button onClick={function() { signOut(); }}
          style={{ background: "none", border: "none", color: "#555", fontSize: 12, cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>
          Sign out
        </button>
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    </div>
  );
}

/**
 * PhoneCodeForm — phone number + texted code, shared by sign-in and the verify gate.
 * Limits (per browser, 1 hour): 3 codes sent, 30s between sends, 3 wrong guesses per code.
 * Resend and "change number" both count as a send. Supabase rate-limits server-side too.
 */
import { useEffect, useState } from "react";
import { Loader } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { logBug } from "@/lib/bugLogger";

var MAX_SENDS = 3;
var WINDOW_MS = 60 * 60 * 1000;
var COOLDOWN_S = 30;
var MAX_WRONG = 3;
var KEY = "dumpster_otp_sends";

// US numbers by default: 10 digits -> +1XXXXXXXXXX; anything starting with + is used as typed.
function toE164(raw: string) {
  var t = raw.trim();
  if (t.charAt(0) === "+") return "+" + t.replace(/\D/g, "");
  var d = t.replace(/\D/g, "");
  if (d.length === 11 && d.charAt(0) === "1") return "+" + d;
  return d.length === 10 ? "+1" + d : "";
}

function recentSends(): number[] {
  try {
    var all = JSON.parse(localStorage.getItem(KEY) || "[]") as number[];
    return all.filter(function(t) { return Date.now() - t < WINDOW_MS; });
  } catch (e) { return []; }
}

function recordSend() {
  try { localStorage.setItem(KEY, JSON.stringify(recentSends().concat(Date.now()))); } catch (e) { /* private mode: server limits still apply */ }
}

interface Props {
  mode: "signin" | "add";
  /** Called after a successful verify */
  onDone?: () => void;
  /** Text shown when the send limit is hit (what else the user can do) */
  lockedHint: string;
}

export default function PhoneCodeForm({ mode, onDone, lockedHint }: Props) {
  var { requestPhoneOtp, verifyPhoneOtp, addPhone, verifyAddedPhone } = useAuth();
  var [phone, setPhone] = useState("");
  var [code, setCode] = useState("");
  var [step, setStep] = useState<"number" | "code">("number");
  var [busy, setBusy] = useState(false);
  var [error, setError] = useState<string | null>(null);
  var [cooldown, setCooldown] = useState(0);
  var [wrong, setWrong] = useState(0);
  var [sends, setSends] = useState<number[]>(recentSends());
  // Adding a phone that another account already owns (e.g. the person once signed in with just that number).
  var [inUse, setInUse] = useState(false);
  var [reported, setReported] = useState(false);

  var locked = sends.length >= MAX_SENDS;
  var minutesLeft = locked ? Math.max(1, Math.ceil((sends[0] + WINDOW_MS - Date.now()) / 60000)) : 0;

  useEffect(function() {
    if (cooldown <= 0) return;
    var t = setTimeout(function() { setCooldown(cooldown - 1); }, 1000);
    return function() { clearTimeout(t); };
  }, [cooldown]);

  async function send() {
    setError(null);
    var e164 = toE164(phone);
    if (!e164) { setError("Enter a valid phone number, like 404 555 1234."); return; }
    if (recentSends().length >= MAX_SENDS) { setSends(recentSends()); return; }
    setBusy(true);
    var result = mode === "add" ? await addPhone(e164) : await requestPhoneOtp(e164);
    setBusy(false);
    if (result.error) {
      if (mode === "add" && /already|registered|exists|in use|taken/i.test(result.error)) { setInUse(true); return; }
      setError(result.error);
      return;
    }
    recordSend();
    setSends(recentSends());
    setCode("");
    setWrong(0);
    setCooldown(COOLDOWN_S);
    setStep("code");
  }

  async function verify() {
    setError(null);
    var e164 = toE164(phone);
    setBusy(true);
    var result = mode === "add" ? await verifyAddedPhone(e164, code.trim()) : await verifyPhoneOtp(e164, code.trim());
    setBusy(false);
    if (!result.error) { if (onDone) onDone(); return; }
    var n = wrong + 1;
    setWrong(n);
    setCode("");
    if (n >= MAX_WRONG) {
      setStep("number");
      setError("Too many wrong codes. Request a new code.");
    } else {
      setError("That code didn't work (" + (MAX_WRONG - n) + " tries left).");
    }
  }

  var field = { width: "100%", padding: "14px 16px", borderRadius: 12, background: "#141414", border: "1px solid #2a2a2a", color: "#e8e8e8", fontSize: 16, fontFamily: "inherit", boxSizing: "border-box" } as const;
  var link = { background: "none", border: "none", color: "#8a8a8a", fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: 4 } as const;

  if (inUse) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 13, color: "#c8c8c8", lineHeight: 1.5, padding: "12px 14px", background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12 }}>
          That number is already linked to another Dumpster account. If it's yours, send this to us and we'll match it to this account.
        </div>
        <button
          disabled={reported}
          onClick={function() {
            logBug({
              source: "phone-in-use",
              message: "Can't verify phone: number already used by another account",
              context: { phone: toE164(phone), note: "User says the number is theirs; link or free it for their signed-in account." },
              silent: true,
            });
            setReported(true);
          }}
          style={{ width: "100%", padding: "15px 20px", borderRadius: 12, background: "var(--accent)", border: "none", color: "#000", fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: reported ? "default" : "pointer", opacity: reported ? 0.6 : 1 }}>
          {reported ? "Sent. We'll sort it out." : "This is my number: send to support"}
        </button>
        <button onClick={function() { setInUse(false); setStep("number"); setPhone(""); setError(null); }} style={link}>
          Use a different number
        </button>
      </div>
    );
  }

  if (locked && step === "number") {
    return (
      <div style={{ fontSize: 13, color: "#c8c8c8", lineHeight: 1.5, padding: "12px 14px", background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12 }}>
        Too many codes requested. Try again in about {minutesLeft} min. {lockedHint}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input type="tel" inputMode="tel" autoComplete="tel" placeholder="Phone number"
        value={phone} disabled={step === "code" || busy}
        onChange={function(e) { setPhone(e.target.value); }} style={field} />
      {step === "code" && (
        <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code"
          value={code} disabled={busy}
          onChange={function(e) { setCode(e.target.value.replace(/\D/g, "")); }}
          style={{ ...field, letterSpacing: 4 }} />
      )}
      <button onClick={step === "code" ? verify : send}
        disabled={busy || (step === "code" ? code.length < 6 : phone.trim().length < 10)}
        style={{ width: "100%", padding: "15px 20px", borderRadius: 12, background: "var(--accent)", border: "none", color: "#000", fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        {busy && <Loader size={18} style={{ animation: "spin 0.8s linear infinite" }} />}
        {step === "code" ? "Verify code" : "Text me a code"}
      </button>
      {step === "code" && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button onClick={send} disabled={busy || cooldown > 0 || locked} style={{ ...link, opacity: cooldown > 0 || locked ? 0.5 : 1 }}>
            {cooldown > 0 ? "Resend code in " + cooldown + "s" : locked ? "No more resends" : "Resend code"}
          </button>
          <button onClick={function() { setStep("number"); setCode(""); setError(null); }} style={link}>
            Wrong number? Change it
          </button>
        </div>
      )}
      {step === "code" && locked && <div style={{ fontSize: 12, color: "#8a8a8a" }}>Code limit reached. {lockedHint}</div>}
      {error && (
        <div style={{ fontSize: 12, color: "#ef4444", padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}
    </div>
  );
}

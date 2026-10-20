/**
 * PhoneGate — blocks a signed-in account until it has a verified phone number.
 * The verified number is stored on the account itself (Supabase Auth -> Users).
 * Accounts that signed in with a phone already have one and never see this.
 */
import { useAuth } from "@/contexts/AuthContext";
import PhoneCodeForm from "@/components/PhoneCodeForm";

export default function PhoneGate() {
  var { signOut } = useAuth();
  // On verify success Supabase fires USER_UPDATED; AuthContext picks up user.phone and this gate unmounts.
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#0e0e0e", border: "1px solid #2a2a2a", borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Verify your phone</div>
        <div style={{ fontSize: 13, color: "#8a8a8a", lineHeight: 1.5 }}>
          Add a phone number to keep your account secure. We'll text you a 6-digit code.
        </div>
        <PhoneCodeForm mode="add" lockedHint="Sign out below and sign in a different way, or try again later." />
        <button onClick={function() { signOut(); }}
          style={{ background: "none", border: "none", color: "#555", fontSize: 12, cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>
          Sign out
        </button>
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    </div>
  );
}

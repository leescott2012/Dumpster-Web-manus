/**
 * AuthSheet — full-screen sign-in over the user's own shuffling pool photos.
 * Apple, Google, Facebook OAuth, plus a phone number + texted code.
 */
import { useState } from "react";
import { Loader } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import PhoneCodeForm from "@/components/PhoneCodeForm";
import PhotoBackdrop from "@/components/PhotoBackdrop";

interface AuthSheetProps {
  open: boolean;
  onClose: () => void;
  /** Pool photo URLs shuffled in the background. */
  photos?: string[];
}

var pill = {
  width: "100%", height: 50, borderRadius: 25, border: "none",
  fontSize: 15, fontWeight: 600, fontFamily: "inherit",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
  transition: "opacity 0.15s",
} as const;

export default function AuthSheet({ open, onClose, photos }: AuthSheetProps) {
  var { signInWithGoogle, signInWithApple, signInWithFacebook } = useAuth();
  var [error, setError] = useState<string | null>(null);
  var [loading, setLoading] = useState<string | null>(null);
  var [showPhone, setShowPhone] = useState(false);

  if (!open) return null;

  async function handleProvider(provider: string) {
    setError(null);
    setLoading(provider);
    var result = { error: null as string | null };
    if (provider === "google") result = await signInWithGoogle();
    if (provider === "apple") result = await signInWithApple();
    if (provider === "facebook") result = await signInWithFacebook();
    setLoading(null);
    if (result.error) setError(result.error);
  }

  function providerButton(id: string, label: string, icon: React.ReactNode) {
    return (
      <button
        onClick={function() { handleProvider(id); }}
        disabled={loading !== null}
        style={Object.assign({}, pill, {
          background: "#fff", color: "#000",
          cursor: loading ? "wait" : "pointer",
          opacity: loading && loading !== id ? 0.5 : 1,
        })}
      >
        {loading === id ? <Loader size={18} style={{ animation: "spin 0.8s linear infinite" }} /> : icon}
        {label}
      </button>
    );
  }

  return (
    <>
      <PhotoBackdrop photos={photos} />

      <div style={{
        position: "fixed", inset: 0, zIndex: 601, color: "#fff", overflowY: "auto",
        display: "flex", flexDirection: "column",
        padding: "max(16px, env(safe-area-inset-top)) 24px max(20px, env(safe-area-inset-bottom))",
        background: "linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 58%, #0a0a0a 100%)",
      }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "#fff", fontSize: 15, fontWeight: 500,
            padding: "8px 4px", cursor: "pointer", fontFamily: "inherit",
          }}>
            Not now
          </button>
        </div>

        <div style={{ marginTop: "auto", width: "100%", maxWidth: 420, alignSelf: "center" }}>
          {/* Brand */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 30 }}>
            <img src="/icon-192.png" alt="" width={56} height={56} style={{ borderRadius: 14, boxShadow: "0 0 0 1.5px var(--accent)" }} />
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1 }}>dumpster</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
              Save your dumps and get 15 free AI credits
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {providerButton("apple", "Continue with Apple",
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#000"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
            )}
            {providerButton("google", "Continue with Google",
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            )}
            {providerButton("facebook", "Continue with Facebook",
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            )}

            {showPhone ? (
              <div style={{
                padding: 16, borderRadius: 18, background: "rgba(14,14,14,0.72)",
                backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", border: "1px solid #2a2a2a",
              }}>
                <PhoneCodeForm mode="signin" onDone={onClose} lockedHint="Or continue with Apple, Google or Facebook above." />
              </div>
            ) : (
              <button onClick={function() { setShowPhone(true); }} disabled={loading !== null} style={Object.assign({}, pill, {
                background: "rgba(70,70,70,0.72)", color: "#fff", cursor: "pointer",
                backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
              })}>
                Continue with phone
              </button>
            )}
          </div>

          {error && (
            <div style={{ fontSize: 12, color: "#ef4444", padding: "8px 12px", background: "rgba(239,68,68,0.12)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.25)", marginTop: 14 }}>
              {error}
            </div>
          )}

          {/* Legal links — required for Google OAuth verification */}
          <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 26, fontSize: 12 }}>
            <a href="/privacy" target="_blank" rel="noopener" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>Privacy Policy</a>
            <a href="/terms" target="_blank" rel="noopener" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>Terms of Service</a>
          </div>
        </div>
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    </>
  );
}

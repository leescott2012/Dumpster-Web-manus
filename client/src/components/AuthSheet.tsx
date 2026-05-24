/**
 * AuthSheet — social-only login sheet
 * Apple, Google, Facebook OAuth — no email/password
 */
import { useState } from "react";
import { X, Loader } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface AuthSheetProps {
  open: boolean;
  onClose: () => void;
}

export default function AuthSheet({ open, onClose }: AuthSheetProps) {
  var { signInWithGoogle, signInWithApple, signInWithFacebook } = useAuth();
  var [error, setError] = useState<string | null>(null);
  var [loading, setLoading] = useState<string | null>(null);

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

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(4px)", zIndex: 600,
      }} />

      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 601,
        background: "#0e0e0e", borderTop: "1px solid #2a2a2a",
        borderRadius: "20px 20px 0 0", overflow: "hidden",
        maxHeight: "85vh", display: "flex", flexDirection: "column",
      }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0", flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "#333" }} />
        </div>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 24px 12px", borderBottom: "1px solid #1a1a1a", flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>
              Sign In
            </div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
              Save your dumps and get 15 free AI credits
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: "#1a1a1a", border: "1px solid #2a2a2a",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#666",
          }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Apple */}
            <button
              onClick={function() { handleProvider("apple"); }}
              disabled={loading !== null}
              style={{
                width: "100%", padding: "15px 20px", borderRadius: 12,
                background: "#fff", border: "none",
                color: "#000", fontSize: 15, fontWeight: 600,
                cursor: loading ? "wait" : "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                transition: "all 0.15s", opacity: loading && loading !== "apple" ? 0.5 : 1,
              }}
            >
              {loading === "apple" ? (
                <Loader size={18} style={{ animation: "spin 0.8s linear infinite" }} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#000"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
              )}
              Continue with Apple
            </button>

            {/* Google */}
            <button
              onClick={function() { handleProvider("google"); }}
              disabled={loading !== null}
              style={{
                width: "100%", padding: "15px 20px", borderRadius: 12,
                background: "#141414", border: "1px solid #2a2a2a",
                color: "#e8e8e8", fontSize: 15, fontWeight: 600,
                cursor: loading ? "wait" : "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                transition: "all 0.15s", opacity: loading && loading !== "google" ? 0.5 : 1,
              }}
              onMouseEnter={function(e) { e.currentTarget.style.borderColor = "#444"; }}
              onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#2a2a2a"; }}
            >
              {loading === "google" ? (
                <Loader size={18} style={{ animation: "spin 0.8s linear infinite" }} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              )}
              Continue with Google
            </button>

            {/* Facebook */}
            <button
              onClick={function() { handleProvider("facebook"); }}
              disabled={loading !== null}
              style={{
                width: "100%", padding: "15px 20px", borderRadius: 12,
                background: "#141414", border: "1px solid #2a2a2a",
                color: "#e8e8e8", fontSize: 15, fontWeight: 600,
                cursor: loading ? "wait" : "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                transition: "all 0.15s", opacity: loading && loading !== "facebook" ? 0.5 : 1,
              }}
              onMouseEnter={function(e) { e.currentTarget.style.borderColor = "#444"; }}
              onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#2a2a2a"; }}
            >
              {loading === "facebook" ? (
                <Loader size={18} style={{ animation: "spin 0.8s linear infinite" }} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              )}
              Continue with Facebook
            </button>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: "#ef4444", padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)", marginTop: 16 }}>
              {error}
            </div>
          )}

          {/* Legal text — links required for Google OAuth verification */}
          <div style={{ textAlign: "center", marginTop: 24, paddingBottom: 20 }}>
            <span style={{ fontSize: 11, color: "#666", lineHeight: 1.6 }}>
              By continuing, you agree to our{" "}
              <a href="/terms" target="_blank" rel="noopener" style={{ color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: 2 }}>
                Terms of Service
              </a>
              {" "}and{" "}
              <a href="/privacy" target="_blank" rel="noopener" style={{ color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: 2 }}>
                Privacy Policy
              </a>
              .
            </span>
          </div>
        </div>
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    </>
  );
}

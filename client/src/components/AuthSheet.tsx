/**
 * AuthSheet — login / sign-up bottom sheet
 * Email + password, Google OAuth, toggle between modes
 */
import { useState } from "react";
import { X, Mail, Eye, EyeOff, Loader } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface AuthSheetProps {
  open: boolean;
  onClose: () => void;
}

export default function AuthSheet({ open, onClose }: AuthSheetProps) {
  var { signIn, signUp, signInWithGoogle } = useAuth();
  var [mode, setMode] = useState<"login" | "signup">("login");
  var [email, setEmail] = useState("");
  var [password, setPassword] = useState("");
  var [showPw, setShowPw] = useState(false);
  var [error, setError] = useState<string | null>(null);
  var [loading, setLoading] = useState(false);
  var [success, setSuccess] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    var result = mode === "login"
      ? await signIn(email, password)
      : await signUp(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      if (mode === "signup") {
        setSuccess(true);
      } else {
        onClose();
      }
    }
  }

  async function handleGoogle() {
    setError(null);
    var result = await signInWithGoogle();
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
              {mode === "login" ? "Welcome Back" : "Create Account"}
            </div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
              {mode === "login" ? "Sign in to save your dumps and credits" : "Start with 15 free AI credits"}
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
          {success ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{"✓"}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#4ade80", marginBottom: 8 }}>Check your email</div>
              <div style={{ fontSize: 13, color: "#888", lineHeight: 1.6 }}>
                {"We sent a confirmation link to " + email + ". Click it to activate your account."}
              </div>
            </div>
          ) : (
            <>
              {/* Google OAuth */}
              <button onClick={handleGoogle} style={{
                width: "100%", padding: "14px", borderRadius: 12,
                background: "#141414", border: "1px solid #2a2a2a",
                color: "#e8e8e8", fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                transition: "all 0.15s", marginBottom: 20,
              }}
                onMouseEnter={function(e) { e.currentTarget.style.borderColor = "#444"; }}
                onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#2a2a2a"; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                {"Continue with Google"}
              </button>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: "#1e1e1e" }} />
                <span style={{ fontSize: 11, color: "#444", letterSpacing: "0.05em" }}>OR</span>
                <div style={{ flex: 1, height: 1, background: "#1e1e1e" }} />
              </div>

              {/* Email form */}
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ position: "relative" }}>
                  <Mail size={16} style={{ position: "absolute", left: 14, top: 14, color: "#555" }} />
                  <input
                    type="email" value={email} required placeholder="Email"
                    onChange={function(e) { setEmail(e.target.value); }}
                    style={{
                      width: "100%", padding: "12px 14px 12px 40px",
                      background: "#141414", border: "1px solid #2a2a2a", borderRadius: 10,
                      color: "#e8e8e8", fontSize: 14, fontFamily: "inherit", outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPw ? "text" : "password"} value={password} required
                    placeholder="Password" minLength={6}
                    onChange={function(e) { setPassword(e.target.value); }}
                    style={{
                      width: "100%", padding: "12px 44px 12px 14px",
                      background: "#141414", border: "1px solid #2a2a2a", borderRadius: 10,
                      color: "#e8e8e8", fontSize: 14, fontFamily: "inherit", outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <button type="button" onClick={function() { setShowPw(!showPw); }} style={{
                    position: "absolute", right: 10, top: 10,
                    background: "none", border: "none", color: "#555", cursor: "pointer", padding: 4,
                  }}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {error && (
                  <div style={{ fontSize: 12, color: "#ef4444", padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)" }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading} style={{
                  width: "100%", padding: "14px", borderRadius: 12,
                  background: "var(--accent)", border: "none",
                  color: "#000", fontSize: 15, fontWeight: 700,
                  cursor: loading ? "wait" : "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  opacity: loading ? 0.7 : 1, transition: "opacity 0.15s",
                }}>
                  {loading && <Loader size={16} style={{ animation: "spin 0.8s linear infinite" }} />}
                  {mode === "login" ? "Sign In" : "Create Account"}
                </button>
              </form>

              {/* Toggle mode */}
              <div style={{ textAlign: "center", marginTop: 20, paddingBottom: 20 }}>
                <span style={{ fontSize: 13, color: "#666" }}>
                  {mode === "login" ? "Don't have an account? " : "Already have an account? "}
                </span>
                <button onClick={function() { setMode(mode === "login" ? "signup" : "login"); setError(null); }} style={{
                  background: "none", border: "none", color: "var(--accent)",
                  fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}>
                  {mode === "login" ? "Sign Up" : "Sign In"}
                </button>
              </div>
            </>
          )}
        </div>
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    </>
  );
}

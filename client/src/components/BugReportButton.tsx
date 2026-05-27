/**
 * BugReportButton — floating "report a bug" pill on the right edge.
 *
 * Click opens a small sheet with a textarea. On submit we call
 * Sentry.captureFeedback so reports land in the same dashboard as crashes,
 * tagged with user_id, url, and userAgent so we can reproduce them.
 *
 * No new backend: Sentry's feedback API is purpose-built for this.
 */
import { useState } from "react";
import { Bug, X, Send } from "lucide-react";
import * as Sentry from "@sentry/react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function BugReportButton() {
  var { user } = useAuth();
  var [open, setOpen] = useState(false);
  var [message, setMessage] = useState("");
  var [email, setEmail] = useState("");
  var [sending, setSending] = useState(false);

  var handleSubmit = async function() {
    var trimmed = message.trim();
    if (!trimmed) {
      toast.error("Tell us what went wrong first.");
      return;
    }
    setSending(true);
    try {
      Sentry.captureFeedback(
        {
          message: trimmed,
          name: user?.user_metadata?.full_name || user?.email || undefined,
          email: email.trim() || user?.email || undefined,
        },
        {
          captureContext: {
            tags: {
              source: "in-app-bug-button",
              signed_in: user ? "true" : "false",
            },
            extra: {
              user_id: user?.id || null,
              url: window.location.href,
              userAgent: navigator.userAgent,
              viewport: window.innerWidth + "x" + window.innerHeight,
            },
          },
        }
      );
      toast.success("Thanks — we'll take a look.");
      setMessage("");
      setEmail("");
      setOpen(false);
    } catch (e) {
      console.error("[BugReportButton] submit failed:", e);
      toast.error("Couldn't send. Try again?");
    }
    setSending(false);
  };

  return (
    <>
      {/* Floating pill — right edge, vertically centered, always-on */}
      <button
        onClick={function() { setOpen(true); }}
        aria-label="Report a bug"
        style={{
          position: "fixed",
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 8px 10px 10px",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRight: "none",
          borderRadius: "10px 0 0 10px",
          color: "#bbb",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          transition: "all 0.15s",
          fontFamily: "inherit",
        }}
        onMouseEnter={function(e) {
          (e.currentTarget as HTMLButtonElement).style.color = "#fff";
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.10)";
        }}
        onMouseLeave={function(e) {
          (e.currentTarget as HTMLButtonElement).style.color = "#bbb";
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
        }}
      >
        <Bug size={16} />
      </button>

      {/* Report sheet */}
      {open && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.88)",
            backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
          onClick={function() { if (!sending) setOpen(false); }}
        >
          <div
            onClick={function(e) { e.stopPropagation(); }}
            style={{
              maxWidth: 440, width: "100%",
              background: "#0e0e0e", border: "1px solid #1e1e1e",
              borderRadius: 20, overflow: "hidden",
            }}
          >
            {/* Top accent bar */}
            <div style={{
              height: 3,
              background: "linear-gradient(90deg, #f59e0b, #ef4444, #a78bfa)",
            }} />

            <div style={{ padding: "28px 24px 24px", position: "relative" }}>
              <button
                onClick={function() { if (!sending) setOpen(false); }}
                aria-label="Close"
                style={{
                  position: "absolute", top: 16, right: 16,
                  width: 32, height: 32, borderRadius: "50%",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#888",
                }}
              >
                <X size={14} />
              </button>

              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(245,158,11,0.10)",
                border: "1px solid rgba(245,158,11,0.25)",
                borderRadius: 100, padding: "4px 12px 4px 8px",
                marginBottom: 14,
              }}>
                <Bug size={12} color="#f59e0b" />
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.15em",
                  color: "#f59e0b", textTransform: "uppercase",
                }}>
                  Report a bug
                </span>
              </div>

              <h2 style={{
                fontSize: 22, fontWeight: 800,
                letterSpacing: "-0.02em", color: "#fff",
                marginBottom: 6,
              }}>
                What went wrong?
              </h2>
              <p style={{ fontSize: 13, color: "#777", marginBottom: 18, lineHeight: 1.5 }}>
                Describe what you did and what you expected. We see every report.
              </p>

              <textarea
                value={message}
                onChange={function(e) { setMessage(e.target.value); }}
                placeholder="e.g. tapped Auto Gen and the app froze for ~5s"
                autoFocus
                style={{
                  width: "100%", minHeight: 110, resize: "vertical",
                  padding: "12px 14px",
                  background: "#141414", border: "1px solid #2a2a2a",
                  borderRadius: 12, color: "#e8e8e8",
                  fontSize: 13, fontFamily: "inherit", lineHeight: 1.5,
                  marginBottom: 12, outline: "none",
                }}
              />

              {!user && (
                <input
                  type="email"
                  value={email}
                  onChange={function(e) { setEmail(e.target.value); }}
                  placeholder="Email (optional) — so we can follow up"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: "#141414", border: "1px solid #2a2a2a",
                    borderRadius: 12, color: "#e8e8e8",
                    fontSize: 13, fontFamily: "inherit",
                    marginBottom: 14, outline: "none",
                  }}
                />
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={function() { if (!sending) setOpen(false); }}
                  disabled={sending}
                  style={{
                    flex: 1, padding: "12px 16px",
                    background: "transparent", color: "#aaa",
                    border: "1px solid #2a2a2a", borderRadius: 12,
                    fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                    cursor: sending ? "default" : "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={sending || !message.trim()}
                  style={{
                    flex: 1, padding: "12px 16px",
                    background: message.trim() && !sending ? "var(--accent)" : "#2a2a2a",
                    color: message.trim() && !sending ? "#000" : "#666",
                    border: "none", borderRadius: 12,
                    fontSize: 13, fontWeight: 800, fontFamily: "inherit",
                    cursor: sending || !message.trim() ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    letterSpacing: "0.02em",
                  }}
                >
                  <Send size={14} strokeWidth={2.5} />
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, Send } from "lucide-react";
import { Component, ReactNode } from "react";
import * as Sentry from "@sentry/react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  eventId: string | null;   // Sentry event ID so the user report links to the crash
  message: string;
  email: string;
  sending: boolean;
  sent: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      eventId: null,
      message: "",
      email: "",
      sending: false,
      sent: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Auto-report every crash to Sentry immediately — no user action needed.
    // The eventId links any manual feedback the user also submits.
    var eventId = Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
      tags: { source: "error-boundary" },
    });
    this.setState({ eventId: eventId ?? null });
  }

  private handleSubmit = async () => {
    var trimmed = this.state.message.trim();
    if (!trimmed && !this.state.eventId) return;

    this.setState({ sending: true });
    try {
      Sentry.captureFeedback(
        {
          message: trimmed || "User saw the crash screen (no message added).",
          email: this.state.email.trim() || undefined,
          associatedEventId: this.state.eventId ?? undefined,
        },
        {
          captureContext: {
            tags: { source: "error-boundary-form" },
            extra: {
              url: window.location.href,
              errorMessage: this.state.error?.message ?? "",
            },
          },
        }
      );
      this.setState({ sent: true });
    } catch {
      // swallow — we already auto-captured the exception above
    }
    this.setState({ sending: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    var { error, message, email, sending, sent, eventId } = this.state;

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0a0a0a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: "inherit",
        }}
      >
        <div style={{ maxWidth: 480, width: "100%" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <AlertTriangle size={28} color="#ef4444" />
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}>
              Something went wrong
            </h2>
          </div>

          {/* Error message */}
          <div style={{
            background: "#111",
            border: "1px solid #1e1e1e",
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 24,
            overflow: "auto",
            maxHeight: 120,
          }}>
            <pre style={{
              fontSize: 11,
              color: "#555",
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}>
              {error?.message}
            </pre>
          </div>

          {/* User report form */}
          {!sent ? (
            <div style={{
              background: "#0e0e0e",
              border: "1px solid #1e1e1e",
              borderRadius: 16,
              overflow: "hidden",
              marginBottom: 16,
            }}>
              {/* Top accent bar */}
              <div style={{ height: 3, background: "linear-gradient(90deg, #f59e0b, #ef4444, #a78bfa)" }} />

              <div style={{ padding: "20px 20px 20px" }}>
                <p style={{ fontSize: 13, color: "#888", marginBottom: 14, lineHeight: 1.5 }}>
                  {/* The crash was already sent to us automatically. */}
                  {eventId
                    ? "We already captured this crash automatically — but if you can describe what you were doing, it helps us fix it faster."
                    : "Tell us what you were doing and we'll get it fixed."}
                </p>

                <textarea
                  value={message}
                  onChange={(e) => this.setState({ message: e.target.value })}
                  placeholder="e.g. I tapped Auto Gen and the whole page went white"
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "#141414",
                    border: "1px solid #2a2a2a",
                    borderRadius: 10,
                    color: "#e0e0e0",
                    fontSize: 13,
                    fontFamily: "inherit",
                    lineHeight: 1.5,
                    resize: "vertical",
                    outline: "none",
                    marginBottom: 10,
                    boxSizing: "border-box",
                  }}
                />

                <input
                  type="email"
                  value={email}
                  onChange={(e) => this.setState({ email: e.target.value })}
                  placeholder="Email (optional) — so we can follow up"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "#141414",
                    border: "1px solid #2a2a2a",
                    borderRadius: 10,
                    color: "#e0e0e0",
                    fontSize: 13,
                    fontFamily: "inherit",
                    marginBottom: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />

                <button
                  onClick={this.handleSubmit}
                  disabled={sending}
                  style={{
                    width: "100%",
                    padding: "11px 16px",
                    background: sending ? "#1e1e1e" : "#f59e0b",
                    color: sending ? "#555" : "#000",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: sending ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Send size={13} strokeWidth={2.5} />
                  {sending ? "Sending…" : "Send Report"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.2)",
              borderRadius: 12,
              padding: "14px 18px",
              marginBottom: 16,
              color: "#4ade80",
              fontSize: 13,
            }}>
              ✓ Report sent — thank you.
            </div>
          )}

          {/* Reload */}
          <button
            onClick={() => window.location.reload()}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg w-full justify-center",
              "bg-primary text-primary-foreground hover:opacity-90 cursor-pointer",
            )}
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            <RotateCcw size={14} />
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;

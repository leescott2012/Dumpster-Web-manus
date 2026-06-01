/**
 * Shared layout for /privacy and /terms.
 * Centered max-width column, dark theme, mobile-readable typography.
 * Includes a back-to-app link and the document's "last updated" stamp.
 */
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

interface LegalLayoutProps {
  title: string;
  lastUpdated: string; // e.g. "May 23, 2026"
  children: ReactNode;
}

export default function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  return (
    <div style={{
      minHeight: "100dvh",
      background: "#0a0a0a",
      color: "#e8e8e8",
      fontFamily: "inherit",
      paddingBottom: "max(env(safe-area-inset-bottom, 0px), 48px)",
    }}>
      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(10,10,10,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #1a1a1a",
        padding: "calc(env(safe-area-inset-top, 0px) + 12px) 20px 12px",
      }}>
        <div style={{
          maxWidth: 720, margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <Link href="/" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            color: "#888", fontSize: 13, fontWeight: 500,
            textDecoration: "none",
          }}>
            <ArrowLeft size={14} /> Back to app
          </Link>
          <span style={{
            fontSize: 12, fontWeight: 800, letterSpacing: "0.18em",
            color: "var(--accent)", textTransform: "uppercase",
          }}>
            DUMPSTER
          </span>
        </div>
      </header>

      {/* Body */}
      <main style={{
        maxWidth: 720, margin: "0 auto",
        padding: "32px 24px 64px",
      }}>
        <h1 style={{
          fontSize: 32, fontWeight: 800, lineHeight: 1.15,
          color: "#fff", margin: "0 0 8px",
          letterSpacing: "-0.02em",
        }}>
          {title}
        </h1>
        <p style={{
          fontSize: 12, color: "#666", margin: "0 0 36px",
          letterSpacing: "0.04em",
        }}>
          Last updated: {lastUpdated}
        </p>

        <div style={{
          fontSize: 15, lineHeight: 1.7, color: "#d4d4d4",
        }}>
          {children}
        </div>

        {/* Footer nav between legal pages */}
        <div style={{
          marginTop: 48, paddingTop: 24,
          borderTop: "1px solid #1a1a1a",
          display: "flex", gap: 18,
          fontSize: 13, color: "#666",
        }}>
          <Link href="/privacy" style={{ color: "#888", textDecoration: "none" }}>Privacy</Link>
          <Link href="/terms" style={{ color: "#888", textDecoration: "none" }}>Terms</Link>
          <a href="mailto:axiomonellc@outlook.com" style={{ color: "#888", textDecoration: "none", marginLeft: "auto" }}>
            Contact
          </a>
        </div>
      </main>
    </div>
  );
}

// ── Shared typography primitives ──────────────────────────────────────────

export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 style={{
      fontSize: 20, fontWeight: 700, color: "#fff",
      margin: "32px 0 12px", letterSpacing: "-0.01em",
    }}>
      {children}
    </h2>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p style={{ margin: "0 0 14px" }}>{children}</p>;
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong style={{ color: "#fff", fontWeight: 600 }}>{children}</strong>;
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul style={{
      margin: "0 0 18px 22px", padding: 0,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      {children}
    </ul>
  );
}

export function LI({ children }: { children: ReactNode }) {
  return <li style={{ paddingLeft: 2 }}>{children}</li>;
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      style={{ color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: 2 }}
    >
      {children}
    </a>
  );
}

/**
 * ApiKeysCard — bring-your-own AI key. Each key is checked against the
 * provider (free "list models" call via /api/api-key-test) before it is kept.
 * Keys live in this browser only; the badge shows verified / rejected / etc.
 */
import { useState } from "react";
import { Check, X, KeyRound } from "lucide-react";
import { getAuthHeaders } from "@/lib/supabase";

const PROVIDERS = [
  { id: "gemini", label: "Gemini" },
  { id: "anthropic", label: "Claude" },
  { id: "openai", label: "OpenAI" },
  { id: "openrouter", label: "OpenRouter" },
];
type Status = "verified" | "rejected" | "quota" | "unreachable" | "checking";
const MSG: Record<Status, string> = {
  verified: "Verified ✓",
  rejected: "Key rejected",
  quota: "Key works but is out of quota",
  unreachable: "Couldn't reach provider — try again",
  checking: "Checking…",
};

function load(id: string): { last4: string; status: Status } | null {
  try { return JSON.parse(localStorage.getItem("dumpster_aikey_meta_" + id) || "null"); } catch { return null; }
}

export default function ApiKeysCard() {
  const [meta, setMeta] = useState<Record<string, { last4: string; status: Status } | null>>(
    () => Object.fromEntries(PROVIDERS.map((p) => [p.id, load(p.id)])),
  );
  const [input, setInput] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, Status | undefined>>({});

  async function test(id: string) {
    const key = (input[id] || "").trim();
    if (!key) return;
    setBusy((b) => ({ ...b, [id]: "checking" }));
    let status: Status = "unreachable";
    try {
      const r = await fetch("/api/api-key-test", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({ provider: id, key }),
      });
      status = ((await r.json()) as { status?: Status }).status || "unreachable";
    } catch { /* stays unreachable */ }
    if (status === "verified" || status === "quota") {
      try {
        localStorage.setItem("dumpster_aikey_" + id, key);
        localStorage.setItem("dumpster_aikey_meta_" + id, JSON.stringify({ last4: key.slice(-4), status }));
      } catch { /* storage blocked */ }
      setMeta((m) => ({ ...m, [id]: { last4: key.slice(-4), status } }));
      setInput((i) => ({ ...i, [id]: "" }));
      setBusy((b) => ({ ...b, [id]: undefined }));
    } else {
      setBusy((b) => ({ ...b, [id]: status }));
    }
  }

  function remove(id: string) {
    try { localStorage.removeItem("dumpster_aikey_" + id); localStorage.removeItem("dumpster_aikey_meta_" + id); } catch { /* ignore */ }
    setMeta((m) => ({ ...m, [id]: null }));
    setBusy((b) => ({ ...b, [id]: undefined }));
  }

  return (
    <div style={{ background: "#141414", borderRadius: 12, padding: 16, marginBottom: 16, border: "1px solid #1e1e1e" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, color: "#fff", fontSize: 14, fontWeight: 600 }}>
        <KeyRound size={16} /> Your AI keys
      </div>
      <div style={{ fontSize: 11, color: "#666", marginBottom: 12 }}>
        Stored on this device only. Each key is tested before it's saved.
      </div>
      {PROVIDERS.map((p) => {
        const saved = meta[p.id];
        const b = busy[p.id];
        return (
          <div key={p.id} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>{p.label}</div>
            {saved ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: saved.status === "verified" ? "#6ee7b7" : "#fbbf24" }}>
                <Check size={14} /> …{saved.last4} · {MSG[saved.status]}
                <button onClick={() => remove(p.id)} aria-label={"Remove " + p.label + " key"}
                  style={{ marginLeft: "auto", background: "none", border: "none", color: "#888", cursor: "pointer" }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="password" autoComplete="off" value={input[p.id] || ""} placeholder="Paste key"
                    aria-label={p.label + " API key"}
                    onChange={(e) => setInput((i) => ({ ...i, [p.id]: e.target.value }))}
                    style={{ flex: 1, minWidth: 0, background: "#0a0a0a", border: "1px solid #222", borderRadius: 8, color: "#fff", padding: "8px 10px", fontSize: 13 }} />
                  <button onClick={() => test(p.id)} disabled={b === "checking"}
                    style={{ background: "var(--accent)", color: "#000", border: "none", borderRadius: 8, padding: "0 12px", fontWeight: 600, cursor: "pointer" }}>
                    Test
                  </button>
                </div>
                {b && <div style={{ fontSize: 12, marginTop: 4, color: b === "checking" ? "#888" : "#f87171" }}>{MSG[b]}</div>}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

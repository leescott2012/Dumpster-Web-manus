/**
 * DumpChatSheet — Valet (AI assistant) for a specific dump.
 * The Valet can reorder, swap photos in/out, update vibe, and learn taste preferences.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { getAuthHeaders } from "@/lib/supabase";
import { X, Send, Loader, ArrowUpDown, ArrowDownToLine, ArrowUpFromLine, Palette, Brain } from "lucide-react";
import type { Dump, Photo } from "@/lib/photoData";
import { loadTasteProfile, saveTasteProfile } from "@/lib/captionPool";
import { friendlyError } from "@/lib/friendlyError";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  actions?: ChatAction[];
}

interface ChatAction {
  type: "reorder" | "swap_in" | "swap_out" | "update_vibe" | "taste_update";
  photoIds?: string[];
  photoId?: string;
  position?: number;
  index?: number;
  vibe?: string;
  preference?: string;
}

interface DumpChatSheetProps {
  open: boolean;
  dump: Dump | null;
  pool: Photo[];
  onClose: () => void;
  onReorder: (dumpId: string, photoIds: string[]) => void;
  onSwapIn: (photoId: string, dumpId: string, position: number) => void;
  onSwapOut: (dumpId: string, photoIndex: number) => void;
  onUpdateVibe: (dumpId: string, vibe: string) => void;
  /** Persists chat history onto the Dump itself so it syncs cross-device
   *  via the workspace JSON. localStorage stays the low-latency read cache. */
  onChatHistoryChange?: (dumpId: string, messages: ChatMessage[]) => void;
  /** Auto-send this message when the sheet opens (e.g. from thumbs-down) */
  initialMessage?: string | null;
}

// Persist chat history per dump
var CHAT_KEY_PREFIX = "dumpster_chat_";

function loadChatHistory(dumpId: string): ChatMessage[] {
  try {
    var raw = localStorage.getItem(CHAT_KEY_PREFIX + dumpId);
    if (raw) return JSON.parse(raw) as ChatMessage[];
  } catch {}
  return [];
}

function saveChatHistory(dumpId: string, messages: ChatMessage[]) {
  try {
    // Keep last 20 messages to avoid quota issues
    var trimmed = messages.slice(-20);
    localStorage.setItem(CHAT_KEY_PREFIX + dumpId, JSON.stringify(trimmed));
  } catch {}
}

// Action type icons and labels
var ACTION_META: Record<string, { icon: typeof ArrowUpDown; label: string; color: string }> = {
  reorder:      { icon: ArrowUpDown,       label: "Reordered",     color: "var(--accent)" },
  swap_in:      { icon: ArrowDownToLine,   label: "Added from pool", color: "#4ade80" },
  swap_out:     { icon: ArrowUpFromLine,   label: "Sent to pool",  color: "#f97316" },
  update_vibe:  { icon: Palette,           label: "Vibe updated",  color: "#a78bfa" },
  taste_update: { icon: Brain,             label: "Remembered",    color: "#6ee7b7" },
};

export default function DumpChatSheet({
  open, dump, pool, onClose,
  onReorder, onSwapIn, onSwapOut, onUpdateVibe, onChatHistoryChange,
  initialMessage,
}: DumpChatSheetProps) {
  var [messages, setMessages] = useState<ChatMessage[]>([]);
  var [input, setInput] = useState("");
  var [loading, setLoading] = useState(false);
  var scrollRef = useRef<HTMLDivElement>(null);
  var autoSentRef = useRef<string | null>(null);

  // Load chat history when opening for a dump.
  // Prefer dump.chatHistory (synced from cloud via workspace JSON) and fall
  // back to localStorage for users coming from a pre-sync version.
  useEffect(function() {
    if (open && dump) {
      var saved = (dump.chatHistory && dump.chatHistory.length > 0)
        ? (dump.chatHistory as ChatMessage[])
        : loadChatHistory(dump.id);
      setMessages(saved);
      setInput("");
      setLoading(false);
      autoSentRef.current = null;
    }
  }, [open, dump ? dump.id : null]);

  // Auto-scroll to bottom on new messages
  useEffect(function() {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  var executeActions = useCallback(function(actions: ChatAction[], currentDump: Dump) {
    for (var i = 0; i < actions.length; i++) {
      var action = actions[i];
      if (action.type === "reorder" && action.photoIds) {
        onReorder(currentDump.id, action.photoIds);
      } else if (action.type === "swap_in" && action.photoId) {
        var pos = typeof action.position === "number" ? action.position : currentDump.photos.length;
        onSwapIn(action.photoId, currentDump.id, pos);
      } else if (action.type === "swap_out" && typeof action.index === "number") {
        onSwapOut(currentDump.id, action.index);
      } else if (action.type === "update_vibe" && action.vibe) {
        onUpdateVibe(currentDump.id, action.vibe);
      } else if (action.type === "taste_update" && action.preference) {
        // Append to taste profile
        var current = loadTasteProfile();
        var updated = current ? current + "\n" + action.preference : action.preference;
        saveTasteProfile(updated);
      }
    }
  }, [onReorder, onSwapIn, onSwapOut, onUpdateVibe]);

  var sendMessage = useCallback(async function(messageText: string) {
    if (!messageText.trim() || !dump || loading) return;

    var userMsg: ChatMessage = { role: "user", text: messageText.trim() };
    var newMessages = messages.concat([userMsg]);
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // Build history for API (strip actions)
    var historyForApi = newMessages.slice(0, -1).map(function(m) {
      return { role: m.role, text: m.text };
    });

    try {
      var authH = await getAuthHeaders();
      var res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, authH),
        body: JSON.stringify({
          dumpId: dump.id,
          dumpTitle: dump.title,
          dumpPhotos: dump.photos.map(function(p) {
            return { id: p.id, url: p.url, alt: p.alt, category: p.category };
          }),
          poolPhotos: pool.map(function(p) {
            return { id: p.id, url: p.url, alt: p.alt, category: p.category };
          }),
          history: historyForApi,
          message: userMsg.text,
          tasteProfile: loadTasteProfile(),
          vibe: dump.vibe || "",
        }),
      });

      if (!res.ok) throw new Error("Server error " + res.status);
      var data = await res.json() as { reply: string; actions: ChatAction[]; error?: string };

      if (data.error) throw new Error(data.error);

      var assistantMsg: ChatMessage = {
        role: "assistant",
        text: data.reply,
        actions: data.actions && data.actions.length > 0 ? data.actions : undefined,
      };

      // Execute actions on the dump
      if (data.actions && data.actions.length > 0) {
        executeActions(data.actions, dump);
      }

      var finalMessages = newMessages.concat([assistantMsg]);
      setMessages(finalMessages);
      saveChatHistory(dump.id, finalMessages);
      // Push onto the Dump itself too — workspace JSON sync carries it cross-device.
      // Trim to last 20 here (saveChatHistory does the same for localStorage).
      onChatHistoryChange?.(dump.id, finalMessages.slice(-20));
    } catch (e: unknown) {
      var fe = friendlyError(e, "ai_chat");
      var errText = fe.hint ? fe.message + " " + fe.hint : fe.message;
      var errorMsg: ChatMessage = { role: "assistant", text: errText };
      var errorMessages = newMessages.concat([errorMsg]);
      setMessages(errorMessages);
      saveChatHistory(dump.id, errorMessages);
      onChatHistoryChange?.(dump.id, errorMessages.slice(-20));
    } finally {
      setLoading(false);
    }
  }, [dump, pool, loading, messages, executeActions]);

  var handleSend = useCallback(function() {
    if (input.trim()) {
      sendMessage(input);
      setInput("");
    }
  }, [input, sendMessage]);

  // Auto-send initialMessage on thumbs-down (once per open)
  useEffect(function() {
    if (open && dump && initialMessage && autoSentRef.current !== dump.id + initialMessage) {
      autoSentRef.current = dump.id + initialMessage;
      // Small delay so the sheet renders first
      setTimeout(function() { sendMessage(initialMessage); }, 300);
    }
  }, [open, dump, initialMessage, sendMessage]);

  var handleKeyDown = useCallback(function(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  if (!open || !dump) return null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(4px)", zIndex: 440,
      }} />

      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 441,
        background: "#0e0e0e", borderTop: "1px solid #2a2a2a",
        borderRadius: "20px 20px 0 0", overflow: "hidden",
        height: "85vh", maxHeight: "85vh",
        display: "flex", flexDirection: "column",
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: "rgba(var(--accent-rgb),0.1)", border: "1px solid rgba(var(--accent-rgb),0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15,
            }}>
              <span style={{ color: "var(--accent)" }}>{"✨"}</span>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
                {"Valet · " + dump.title}
              </div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 1 }}>
                {dump.photos.length + " photos" + (dump.vibe ? " · " + dump.vibe : "")}
              </div>
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

        {/* Mini photo strip */}
        <div style={{
          display: "flex", gap: 6, padding: "12px 24px",
          overflowX: "auto", flexShrink: 0,
          borderBottom: "1px solid #1a1a1a",
        }}>
          {dump.photos.map(function(p, i) {
            return (
              <div key={p.id} style={{
                position: "relative", flexShrink: 0,
                width: 48, height: 48, borderRadius: 8, overflow: "hidden",
                border: "1px solid #2a2a2a",
              }}>
                <img src={p.url} alt={p.alt} style={{
                  width: "100%", height: "100%", objectFit: "cover",
                }} />
                <div style={{
                  position: "absolute", bottom: 1, right: 2,
                  fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.6)",
                  textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                }}>
                  {i + 1}
                </div>
              </div>
            );
          })}
          {dump.photos.length === 0 && (
            <div style={{ fontSize: 12, color: "#444", padding: "12px 0" }}>
              Empty dump — tell me what to pull from the pool
            </div>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{
          flex: 1, overflowY: "auto", padding: "16px 24px",
          display: "flex", flexDirection: "column", gap: 14,
        }}>
          {messages.length === 0 && (
            <div style={{
              textAlign: "center", padding: "40px 20px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
            }}>
              <div style={{ fontSize: 28 }}>{"✨"}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#e8e8e8" }}>
                Valet
              </div>
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.7, maxWidth: 280 }}>
                At your service. Tell me what vibe you want, which shot leads,
                what to swap out. I'll remember your taste.
              </div>
              {/* Quick prompts */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, justifyContent: "center" }}>
                {[
                  "make this feel like a saturday night",
                  "lead with the strongest photo",
                  "too many similar shots",
                  "pull something moody from the pool",
                ].map(function(prompt) {
                  return (
                    <button
                      key={prompt}
                      onClick={function() { setInput(prompt); }}
                      style={{
                        background: "rgba(var(--accent-rgb),0.06)", border: "1px solid rgba(var(--accent-rgb),0.15)",
                        borderRadius: 100, padding: "6px 12px", fontSize: 11, color: "#999",
                        cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                      }}
                      onMouseEnter={function(e) { e.currentTarget.style.borderColor = "rgba(var(--accent-rgb),0.4)"; e.currentTarget.style.color = "var(--accent)"; }}
                      onMouseLeave={function(e) { e.currentTarget.style.borderColor = "rgba(var(--accent-rgb),0.15)"; e.currentTarget.style.color = "#999"; }}
                    >
                      {prompt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {messages.map(function(msg, i) {
            var isUser = msg.role === "user";
            return (
              <div key={i} style={{
                display: "flex",
                justifyContent: isUser ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth: "85%",
                  padding: "10px 14px",
                  borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: isUser ? "rgba(var(--accent-rgb),0.15)" : "#1a1a1a",
                  border: isUser ? "1px solid rgba(var(--accent-rgb),0.25)" : "1px solid #2a2a2a",
                }}>
                  <div style={{
                    fontSize: 13, lineHeight: 1.6,
                    color: isUser ? "#e8e8e8" : "#ccc",
                    whiteSpace: "pre-wrap",
                  }}>
                    {msg.text}
                  </div>

                  {/* Action chips */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div style={{
                      display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8,
                      paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)",
                    }}>
                      {msg.actions.map(function(action, ai) {
                        var meta = ACTION_META[action.type];
                        if (!meta) return null;
                        var Icon = meta.icon;
                        return (
                          <span key={ai} style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "3px 8px", borderRadius: 6,
                            background: meta.color + "15",
                            border: "1px solid " + meta.color + "30",
                            fontSize: 10, fontWeight: 600, color: meta.color,
                            letterSpacing: "0.02em",
                          }}>
                            <Icon size={10} />
                            {meta.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{
                padding: "10px 14px", borderRadius: "16px 16px 16px 4px",
                background: "#1a1a1a", border: "1px solid #2a2a2a",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <Loader size={13} style={{ animation: "spin 0.8s linear infinite" }} color="var(--accent)" />
                <span style={{ fontSize: 12, color: "#666" }}>thinking...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{
          padding: "12px 24px 40px", borderTop: "1px solid #1a1a1a", flexShrink: 0,
          display: "flex", gap: 10, alignItems: "flex-end",
        }}>
          <textarea
            value={input}
            onChange={function(e) { setInput(e.target.value); }}
            onKeyDown={handleKeyDown}
            placeholder={"Tell me what to change..."}
            rows={1}
            style={{
              flex: 1, resize: "none",
              background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12,
              padding: "12px 14px", fontSize: 13, color: "#e8e8e8",
              fontFamily: "inherit", lineHeight: 1.5, outline: "none",
              maxHeight: 120, minHeight: 44,
              boxSizing: "border-box" as const,
            }}
            onFocus={function(e) { e.currentTarget.style.borderColor = "rgba(var(--accent-rgb),0.4)"; }}
            onBlur={function(e) { e.currentTarget.style.borderColor = "#2a2a2a"; }}
            onInput={function(e) {
              var el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: loading || !input.trim() ? "#1a1a1a" : "var(--accent)",
              border: "1px solid " + (loading || !input.trim() ? "#2a2a2a" : "var(--accent)"),
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              color: loading || !input.trim() ? "#444" : "#000",
              transition: "all 0.15s",
            }}
          >
            <Send size={16} />
          </button>
        </div>
        <style>{[
          "@keyframes spin { to { transform: rotate(360deg); } }",
        ].join("\n")}</style>
      </div>
    </>
  );
}

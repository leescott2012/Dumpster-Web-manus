/**
 * UserDrillModal — Holographic side-panel for per-user drill-down.
 *
 * Opens as a slide-in panel from the right when an admin clicks a user row.
 * Fetches credit transaction history and activity log via /api/admin-user-detail.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, CreditCard, Clock } from "lucide-react";

interface TransactionRow {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

interface ActivityRow {
  id: string;
  event: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface UserDetail {
  transactions: TransactionRow[];
  activity: ActivityRow[];
  lastSignInIp: string | null;
  userEmail: string;
  lastSignIn: string | null;
}

interface Props {
  userId: string;
  userEmail: string;
  userTier: string;
  userCredits: number;
  sessionToken: string;
  onClose: () => void;
}

const ACCENT = "#D4AF37";

const ACTION_LABELS: Record<string, string> = {
  ai_suggest: "Auto Gen", ai_caption: "Caption", ai_chat: "Chat",
  ai_recycle: "Recycle", ig_scrub: "IG Scrub",
};

const EVENT_LABELS: Record<string, string> = {
  session_start: "Session Start",
  photo_uploaded: "Photos Uploaded",
  dump_exported: "Export",
};

function fmtAction(type: string) { return ACTION_LABELS[type] ?? type; }
function fmtEvent(event: string) { return EVENT_LABELS[event] ?? event; }

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function UserDrillModal({ userId, userEmail, userTier, userCredits, sessionToken, onClose }: Props) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"transactions" | "activity">("transactions");

  useEffect(() => {
    setLoading(true);
    setDetail(null);
    fetch(`/api/admin-user-detail?userId=${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then(r => r.json())
      .then(data => { setDetail(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userId, sessionToken]);

  const totalCreditsSpent = detail?.transactions
    .filter(t => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0) ?? 0;

  const captionCount = detail?.transactions
    .filter(t => t.type === "ai_caption").length ?? 0;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Side panel */}
      <motion.div
        key="panel"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed top-0 right-0 h-full w-full max-w-[480px] bg-[#060606] border-l border-[#D4AF37]/20 z-50 flex flex-col overflow-hidden font-mono"
        style={{ boxShadow: "-30px 0 80px rgba(212,175,55,0.06)" }}
      >
        {/* Corner accent lines */}
        <div className="absolute top-0 left-0 w-8 h-[1px] bg-gradient-to-r from-[#D4AF37]/60 to-transparent" />
        <div className="absolute top-0 left-0 w-[1px] h-8 bg-gradient-to-b from-[#D4AF37]/60 to-transparent" />

        {/* ── Header ── */}
        <div className="p-6 border-b border-[#D4AF37]/10 flex-shrink-0">
          <div className="flex items-start justify-between mb-5">
            <div className="min-w-0 flex-1 pr-4">
              <div className="text-[8px] text-[#D4AF37]/40 uppercase tracking-[0.4em] mb-1.5">
                Neural Node Profile
              </div>
              <div className="text-white font-bold text-sm truncate">
                {userEmail || "ANON_NODE"}
              </div>
              <div className="text-[9px] text-gray-600 mt-1">
                <span className="text-[#D4AF37]/30 mr-2">ID:</span>
                <span className="font-mono">{userId.slice(0, 12)}…</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#D4AF37]/10 rounded-lg transition-colors text-[#D4AF37]/40 hover:text-[#D4AF37] flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick-stat chips */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "Tier", value: userTier.toUpperCase(), icon: <CreditCard className="w-3 h-3" /> },
              { label: "Credits", value: loading ? "—" : String(userCredits), icon: <Zap className="w-3 h-3" /> },
              { label: "Spent", value: loading ? "—" : String(totalCreditsSpent), icon: <Zap className="w-3 h-3" /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="bg-[#0c0c0c] border border-[#D4AF37]/10 rounded-xl p-3">
                <div className="flex items-center gap-1 mb-1 text-[#D4AF37]/30">
                  {icon}
                  <span className="text-[8px] uppercase tracking-widest">{label}</span>
                </div>
                <div className="text-[#D4AF37] font-bold text-sm">{value}</div>
              </div>
            ))}
          </div>

          {/* Meta info */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[9px]">
              <span className="text-[#D4AF37]/30 uppercase tracking-widest w-24 flex-shrink-0">Last IP</span>
              <span className="font-mono text-gray-500">{loading ? "—" : (detail?.lastSignInIp ?? "—")}</span>
            </div>
            <div className="flex items-center gap-2 text-[9px]">
              <span className="text-[#D4AF37]/30 uppercase tracking-widest w-24 flex-shrink-0">Captions Gen</span>
              <span className="font-mono text-gray-500">{loading ? "—" : captionCount}</span>
            </div>
            {detail?.lastSignIn && (
              <div className="flex items-center gap-2 text-[9px]">
                <span className="text-[#D4AF37]/30 uppercase tracking-widest w-24 flex-shrink-0">Last Login</span>
                <span className="font-mono text-gray-500">{fmtDt(detail.lastSignIn)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-[#D4AF37]/10 flex-shrink-0">
          {(["transactions", "activity"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-[9px] uppercase tracking-[0.25em] font-bold transition-all ${
                tab === t
                  ? "text-[#D4AF37] border-b-2 border-[#D4AF37]"
                  : "text-gray-600 hover:text-gray-400"
              }`}
            >
              {t === "transactions" ? "Credit Log" : "Activity"}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="w-6 h-6 border border-t-transparent rounded-full"
                style={{ borderColor: ACCENT }}
              />
              <div className="text-[9px] text-[#D4AF37]/30 uppercase tracking-widest animate-pulse">
                Querying neural records...
              </div>
            </div>
          ) : tab === "transactions" ? (
            <div>
              {(!detail?.transactions.length) && (
                <div className="p-8 text-center text-gray-700 text-[10px] uppercase tracking-widest">
                  No transactions on record.
                </div>
              )}
              {detail?.transactions.map(tx => (
                <div
                  key={tx.id}
                  className="px-6 py-3.5 flex items-center justify-between border-b border-[#D4AF37]/5 hover:bg-[#D4AF37]/3 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-white">{fmtAction(tx.type)}</div>
                    <div className="text-[8px] text-gray-600 flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {fmtDt(tx.created_at)}
                    </div>
                  </div>
                  <div
                    className="text-[11px] font-bold font-mono flex-shrink-0 ml-4"
                    style={{ color: tx.amount < 0 ? "#f87171" : "#4ade80" }}
                  >
                    {tx.amount > 0 ? "+" : ""}{tx.amount}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {(!detail?.activity.length) && (
                <div className="p-8 text-center text-gray-700 text-[10px] uppercase tracking-widest">
                  No activity on record.
                </div>
              )}
              {detail?.activity.map(act => (
                <div
                  key={act.id}
                  className="px-6 py-3.5 border-b border-[#D4AF37]/5 hover:bg-[#D4AF37]/3 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-white">{fmtEvent(act.event)}</div>
                    <div className="text-[8px] text-gray-600 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {fmtDt(act.created_at)}
                    </div>
                  </div>
                  {act.metadata && Object.keys(act.metadata).length > 0 && (
                    <div className="text-[8px] text-gray-600 font-mono mt-1">
                      {JSON.stringify(act.metadata)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom scan-line decoration */}
        <div className="h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/20 to-transparent flex-shrink-0" />
      </motion.div>
    </AnimatePresence>
  );
}

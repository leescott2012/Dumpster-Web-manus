/**
 * UserDrillModal — Per-user activity drill-down panel
 * Opens when a user row is clicked in the Neural Registry table.
 * Pulls per-user activity history from /api/admin-user-detail
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Activity, Zap, Clock, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  tier: string;
  credits: number;
  ai_calls: number;
  credits_used: number;
  photos_uploaded: number;
  exports: number;
}

interface ActivityEntry {
  id: string;
  event: string;
  created_at: string;
  metadata: Record<string, any> | null;
}

interface CreditEntry {
  id: string;
  amount: number;
  type: string;
  created_at: string;
  description: string | null;
}

interface UserDetail {
  activity: ActivityEntry[];
  credits: CreditEntry[];
  last_ip: string | null;
}

const ACCENT = "#D4AF37";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtEvent(event: string): string {
  const map: Record<string, string> = {
    session_start: "Session Start",
    photo_uploaded: "Photos Uploaded",
    dump_exported: "Dump Exported",
    ai_caption: "Caption Generated",
    ai_suggest: "Auto-Gen",
    ai_chat: "Chat",
    ai_recycle: "Recycle",
    ig_scrub: "IG Scrub",
  };
  return map[event] ?? event.replace(/_/g, " ");
}

interface Props {
  user: UserRow | null;
  onClose: () => void;
}

export default function UserDrillModal({ user, onClose }: Props) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"activity" | "credits">("activity");

  useEffect(() => {
    if (!user) return;
    setDetail(null);
    setLoading(true);

    supabase.auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!token) return;

      try {
        const res = await fetch(`/api/admin-user-detail?userId=${user.id}`, {
          headers: { Authorization: "Bearer " + token },
        });
        if (res.ok) {
          const d = await res.json();
          setDetail(d);
        }
      } catch (e) {
        console.error("UserDrillModal fetch error:", e);
      } finally {
        setLoading(false);
      }
    });
  }, [user]);

  return (
    <AnimatePresence>
      {user && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-[#050505] border-l border-[#D4AF37]/20 z-50 overflow-y-auto"
            style={{ boxShadow: `-20px 0 60px rgba(212,175,55,0.05)` }}
          >
            {/* Header */}
            <div className="sticky top-0 bg-[#050505] border-b border-[#D4AF37]/10 p-6 flex items-start justify-between z-10">
              <div>
                <div className="text-[9px] text-[#D4AF37]/40 uppercase tracking-[0.3em] mb-1">
                  Node Intelligence
                </div>
                <div className="text-white font-bold text-sm truncate max-w-[300px]">
                  {user.email || "ANON_NODE"}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    user.tier === "pro" ? "bg-[#D4AF37]/20 text-[#D4AF37]" :
                    user.tier === "lifetime" ? "bg-purple-500/20 text-purple-400" :
                    "bg-gray-900 text-gray-500"
                  }`}>
                    {user.tier}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    Joined {fmtDate(user.created_at)}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-[#D4AF37]/10 rounded-lg transition-colors text-[#D4AF37]/60 hover:text-[#D4AF37]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 p-6">
              {[
                { label: "Credits Remaining", value: user.credits, icon: Zap },
                { label: "Credits Used", value: user.credits_used, icon: Activity },
                { label: "AI Calls", value: user.ai_calls, icon: Activity },
                { label: "Photos Uploaded", value: user.photos_uploaded, icon: Activity },
              ].map((stat, i) => (
                <div key={i} className="bg-[#0a0a0a] border border-[#D4AF37]/10 rounded-xl p-4">
                  <div className="text-[9px] text-[#D4AF37]/40 uppercase tracking-widest mb-1">{stat.label}</div>
                  <div className="text-xl font-bold text-white">{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Last Active + IP */}
            <div className="px-6 pb-4 flex items-center gap-6 text-[10px] text-gray-600">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Last sync: {fmtDate(user.last_sign_in_at)}
              </div>
              {detail?.last_ip && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" />
                  IP: {detail.last_ip}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="px-6 flex gap-1 border-b border-[#D4AF37]/10">
              {(["activity", "credits"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-[10px] uppercase tracking-widest font-bold transition-colors border-b-2 -mb-[1px] ${
                    activeTab === tab
                      ? "border-[#D4AF37] text-[#D4AF37]"
                      : "border-transparent text-gray-600 hover:text-gray-400"
                  }`}
                >
                  {tab === "activity" ? "Activity Log" : "Credit History"}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-t-transparent border-[#D4AF37] rounded-full animate-spin" />
                </div>
              ) : !detail ? (
                <div className="text-center py-12 text-gray-600 text-xs">No data available</div>
              ) : activeTab === "activity" ? (
                <div className="space-y-2">
                  {detail.activity.length === 0 ? (
                    <div className="text-center py-8 text-gray-600 text-xs">No activity recorded</div>
                  ) : (
                    detail.activity.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start justify-between p-3 bg-[#0a0a0a] border border-[#D4AF37]/5 rounded-xl hover:border-[#D4AF37]/15 transition-colors"
                      >
                        <div>
                          <div className="text-[11px] text-white font-medium">{fmtEvent(entry.event)}</div>
                          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                            <div className="text-[9px] text-gray-600 mt-0.5">
                              {JSON.stringify(entry.metadata).slice(0, 60)}
                            </div>
                          )}
                        </div>
                        <div className="text-[9px] text-gray-600 whitespace-nowrap ml-4">
                          {fmtDate(entry.created_at)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {detail.credits.length === 0 ? (
                    <div className="text-center py-8 text-gray-600 text-xs">No credit transactions</div>
                  ) : (
                    detail.credits.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-3 bg-[#0a0a0a] border border-[#D4AF37]/5 rounded-xl hover:border-[#D4AF37]/15 transition-colors"
                      >
                        <div>
                          <div className="text-[11px] text-white font-medium">
                            {entry.type.replace(/_/g, " ")}
                          </div>
                          {entry.description && (
                            <div className="text-[9px] text-gray-600 mt-0.5">{entry.description}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-bold ${entry.amount < 0 ? "text-red-400" : "text-green-400"}`}>
                            {entry.amount > 0 ? "+" : ""}{entry.amount}
                          </div>
                          <div className="text-[9px] text-gray-600">{fmtDate(entry.created_at)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

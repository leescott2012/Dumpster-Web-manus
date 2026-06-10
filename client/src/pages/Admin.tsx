/**
 * /admin — Genius Neural HUD Command Center (IMPROVED)
 *
 * Redesigned for clarity and usability:
 * - Full Jarvis Voice HUD (30% width)
 * - Tabbed main content (Overview | Users | Bugs | Agents)
 * - Better visual hierarchy and information architecture
 */
import { useEffect, useState, useCallback, useRef } from "react";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  BarChart, Bar
} from "recharts";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert, RefreshCw, Home, LogOut, Volume2, VolumeX,
  Users, Bug, Zap as ZapIcon, BarChart3, TrendingUp, ChevronLeft, ChevronRight
} from "lucide-react";

// Genius Components
import JarvisVoiceHUD from "@/components/genius/JarvisVoiceHUD";
import ConsoleTerminal from "@/components/genius/ConsoleTerminal";
import AgentControl from "@/components/genius/AgentControl";
import UserDrillModal from "@/components/genius/UserDrillModal";
import { sfx } from "@/lib/geniusAudio";
import { isMuted, setMuted, onMuteChange } from "@/utils/audioSynth";
import { logBug } from "@/lib/bugLogger";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeatureUsageRow { action: string; count: number; credits: number; }
interface DauRow          { date: string;   count: number; }
interface RevenueDay      { date: string;   amount_cents: number; }
interface RevenueSummary {
  today_cents: number; week_cents: number; month_cents: number; total_cents: number;
  daily: RevenueDay[]; currency: string; source: "stripe" | "unavailable";
}
interface UserRow {
  id: string; email: string; created_at: string;
  last_sign_in_at: string | null; tier: string; credits: number;
  ai_calls: number; credits_used: number; photos_uploaded: number; exports: number;
}
interface AdminStats {
  overview: {
    total_users: number; active_today: number; active_week: number;
    ai_calls_today: number; credits_spent_today: number;
  };
  feature_usage: FeatureUsageRow[];
  dau: DauRow[];
  users: UserRow[];
  revenue: RevenueSummary;
}

interface Task {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  logs: string[];
  summary?: string;
  agentType: 'researcher' | 'coder' | 'social' | 'analyst';
  timestamp: string;
}

interface BugReportRow {
  id: string; user_id: string | null; email: string | null;
  source: string; message: string; error_code: string | null; stack: string | null;
  url: string | null; user_agent: string | null; viewport: string | null;
  status: string; admin_note: string | null;
  context: unknown;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function fmtAction(action: string): string {
  const map: Record<string, string> = {
    ai_suggest: "Auto Gen", ai_caption: "Caption", ai_chat: "Chat",
    ai_recycle: "Recycle", ig_scrub: "IG Scrub",
  };
  return map[action] ?? action;
}

const ACCENT = "#D4AF37"; // Gold

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0a0a0a", border: `1px solid ${ACCENT}33`, borderRadius: 8, padding: "8px 14px", fontSize: 11, fontFamily: "monospace" }}>
      <div style={{ color: "#888", marginBottom: 2, textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: ACCENT, fontWeight: 700 }}>{payload[0].value}</div>
    </div>
  );
}

// ── Sign-in screen ────────────────────────────────────────────────────────────

function SignInScreen({ onGoogle, signingIn, error }: { onGoogle: () => void; signingIn: boolean; error: string | null }) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 text-white font-mono relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(circle, #D4AF37 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#0a0a0a] border border-[#D4AF37]/30 rounded-2xl p-10 relative z-10 shadow-[0_0_50px_rgba(212,175,55,0.1)]"
      >
        <div className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-[0.3em] mb-4">Chamillion Collective</div>
        <h1 className="text-3xl font-bold mb-2 tracking-tight">Genius HUD</h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">Initialize neural linkage to access the command center. Admin credentials required.</p>
        <button onClick={onGoogle} disabled={signingIn} className="w-full py-4 px-6 bg-[#D4AF37] hover:bg-[#B8962E] text-black rounded-xl font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-wait">
          <svg width="20" height="20" viewBox="0 0 18 18">
            <path fill="currentColor" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="currentColor" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="currentColor" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
            <path fill="currentColor" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"/>
          </svg>
          {signingIn ? "INITIALIZING..." : "CONNECT NEURAL LINK"}
        </button>
        {error && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 text-center">{error}</motion.div>}
        <div className="mt-8 pt-8 border-t border-[#D4AF37]/10 flex justify-center">
          <a href="/" className="text-[10px] text-gray-600 hover:text-[#D4AF37] transition-colors uppercase tracking-widest">Return to Surface</a>
        </div>
      </motion.div>
    </div>
  );
}

export default function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [stats, setStats]     = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'bugs' | 'agents'>('overview');
  const [hudExpanded, setHudExpanded] = useState(true);

  const [logs, setLogs] = useState<string[]>([]);
  const [isWarmingUp, setIsWarmingUp] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [bugs, setBugs] = useState<BugReportRow[]>([]);
  const [bugFilter, setBugFilter] = useState<"all" | "new" | "seen" | "fixed">("new");

  const [muted, setMutedState] = useState<boolean>(isMuted());
  useEffect(() => { return onMuteChange(setMutedState); }, []);
  const toggleMute = useCallback(() => { setMuted(!isMuted()); }, []);

  const fetchBugs = useCallback(async function() {
    if (!session) return;
    try {
      const q = bugFilter === "all" ? "" : `?status=${bugFilter}`;
      const res = await fetch("/api/bug-report" + q, { headers: { Authorization: "Bearer " + session.access_token } });
      if (!res.ok) return;
      const body = await res.json();
      setBugs(body.reports || []);
    } catch {}
  }, [session, bugFilter]);

  useEffect(() => { if (session) fetchBugs(); }, [session, fetchBugs]);

  const markBug = useCallback(async function(id: string, status: "seen" | "fixed" | "new") {
    if (!session) return;
    await fetch("/api/bug-report", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify({ id, status }),
    });
    fetchBugs();
  }, [session, fetchBugs]);

  const addLog = (msg: string) => { setLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`]); };

  useEffect(function() {
    supabase.auth.getSession().then(function(r) { setSession(r.data.session); setSessionLoading(false); });
    const sub = supabase.auth.onAuthStateChange(function(_e, s) { setSession(s); });
    return function() { sub.data.subscription.unsubscribe(); };
  }, []);

  const fetchStats = useCallback(async function() {
    if (!session) return;
    setLoading(true);
    addLog("[SYSTEM] Querying neural database for user telemetry...");
    try {
      const res = await fetch("/api/admin-stats", { headers: { Authorization: "Bearer " + session.access_token } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 403) { setError("Unauthorized account."); addLog("[CRITICAL] Access denied."); }
        else { const msg = body.error ?? "HTTP " + res.status; setError(msg); addLog(`[FAIL] Retrieval failed: ${res.status}`); }
        return;
      }
      const data = await res.json();
      setStats(data);
      addLog(`[SUCCESS] Synchronized data for ${data.overview.total_users} active nodes.`);
      sfx.playBeep(600, 0.1);
    } catch (e: any) { setError(e?.message ?? "Network error"); addLog(`[ERROR] Connection timeout.`); }
    finally { setLoading(false); }
  }, [session]);

  useEffect(function() {
    if (session) {
      fetchStats();
      setTimeout(() => { setIsWarmingUp(false); sfx.playStartup(); addLog("[BOOT] Genius Neural HUD v5.0 Online."); }, 1500);
    }
  }, [session, fetchStats]);

  const handleGoogle = useCallback(async function() {
    setSigningIn(true); setError(null);
    const { error: oerr } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/admin" } });
    if (oerr) { setError(oerr.message); setSigningIn(false); }
  }, []);

  const handleSignOut = useCallback(async function() { sfx.playBeep(400, 0.1); await supabase.auth.signOut(); setSession(null); setStats(null); setError(null); }, []);

  if (sessionLoading || (session && isWarmingUp)) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-[#D4AF37] font-mono">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-12 h-12 border-2 border-t-transparent border-[#D4AF37] rounded-full mb-4" />
        <div className="text-[10px] tracking-[0.5em] uppercase animate-pulse">Warming Core...</div>
      </div>
    );
  }

  if (!session) return <SignInScreen onGoogle={handleGoogle} signingIn={signingIn} error={error} />;

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 font-mono text-white">
        <div className="w-full max-w-md bg-[#0a0a0a] border border-red-500/30 rounded-2xl p-8">
          <div className="flex items-center gap-3 text-red-500 mb-6"><ShieldAlert className="w-6 h-6" /><h2 className="text-xl font-bold uppercase tracking-tight">Security Breach</h2></div>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">{error}</p>
          <div className="flex gap-4">
            <button onClick={fetchStats} className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-xl font-bold transition-all text-xs uppercase">Retry Sync</button>
            <button onClick={handleSignOut} className="flex-1 py-3 bg-gray-900 hover:bg-gray-800 text-gray-400 border border-gray-800 rounded-xl font-bold transition-all text-xs uppercase">Disconnect</button>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;
  const { overview, feature_usage, dau, users, revenue } = stats;
  const dauLabelled = dau.map(d => ({ ...d, label: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) }));
  const featureLabelled = feature_usage.map(f => ({ ...f, label: fmtAction(f.action) }));
  const revenueLabelled = (revenue?.daily ?? []).map(d => ({ ...d, label: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }), amount: d.amount_cents / 100 }));
  const fmtMoney = (cents: number) => {
    const dollars = (cents || 0) / 100;
    const code = (revenue?.currency ?? "usd").toUpperCase();
    try { return new Intl.NumberFormat("en-US", { style: "currency", currency: code, maximumFractionDigits: dollars >= 100 ? 0 : 2 }).format(dollars); }
    catch { return "$" + dollars.toFixed(2); }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-[#D4AF37] selection:text-black overflow-hidden flex flex-col">
      {/* Top Nav */}
      <div className="h-16 border-b border-[#D4AF37]/10 flex items-center justify-between px-6 bg-black/50 backdrop-blur-md z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => setHudExpanded(!hudExpanded)} className="p-2 hover:bg-[#D4AF37]/10 rounded-lg transition-colors text-[#D4AF37]">
            {hudExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-2"><div className="w-2 h-2 bg-[#D4AF37] rounded-full animate-pulse" /><span className="text-xs font-bold tracking-widest uppercase text-[#D4AF37]">GENIUSS v5.0</span></div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggleMute} className={`p-2 rounded-lg transition-colors ${muted ? "text-red-500/70 hover:bg-red-500/10" : "hover:bg-[#D4AF37]/10"}`}>{muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</button>
          <button onClick={fetchStats} className="p-2 hover:bg-[#D4AF37]/10 rounded-lg transition-colors group"><RefreshCw className="w-4 h-4 group-active:rotate-180 transition-transform duration-500" /></button>
          <a href="/" className="p-2 hover:bg-[#D4AF37]/10 rounded-lg transition-colors"><Home className="w-4 h-4" /></a>
          <button onClick={handleSignOut} className="p-2 hover:bg-red-500/10 text-red-500/60 hover:text-red-500 rounded-lg transition-colors"><LogOut className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR: Jarvis Voice HUD (30%) */}
        <AnimatePresence>
          {hudExpanded && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: '30%', opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="border-r border-[#D4AF37]/10">
              <JarvisVoiceHUD isOnline={true} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN CONTENT (Remaining 70%) */}
        <div className="flex-1 overflow-y-auto bg-[#050505]">
          <div className="border-b border-[#D4AF37]/10 bg-black/30 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-6 flex items-center gap-1">
              {[{ id: 'overview', label: 'Overview', icon: BarChart3 }, { id: 'users', label: 'Users', icon: Users }, { id: 'bugs', label: 'Bugs', icon: Bug }, { id: 'agents', label: 'Agents', icon: ZapIcon }].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab.id ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}><tab.icon className="w-4 h-4" />{tab.label}</button>
              ))}
            </div>
          </div>

          <div className="max-w-7xl mx-auto p-6">
            {activeTab === 'overview' && (
              <div className="space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {[
                    { label: "Total Users", value: String(overview.total_users), icon: Users },
                    { label: "Active Today", value: String(overview.active_today), icon: TrendingUp },
                    { label: "Active Week", value: String(overview.active_week), icon: BarChart3 },
                    { label: "AI Calls", value: String(overview.ai_calls_today), icon: ZapIcon },
                    { label: "Credits Spent", value: String(overview.credits_spent_today), icon: ZapIcon },
                    { label: "Revenue Today", value: fmtMoney(revenue?.today_cents ?? 0), icon: TrendingUp },
                  ].map((stat, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-[#0a0a0a] border border-[#D4AF37]/10 p-4 rounded-xl hover:border-[#D4AF37]/30 transition-colors">
                      <div className="flex items-center gap-2 mb-2"><stat.icon className="w-4 h-4 text-[#D4AF37]/60" /><div className="text-[10px] text-gray-500 uppercase tracking-widest">{stat.label}</div></div>
                      <div className="text-2xl font-bold text-white">{stat.value}</div>
                    </motion.div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-[#0a0a0a] border border-[#D4AF37]/10 rounded-xl p-6"><h3 className="text-xs font-bold text-[#D4AF37]/60 uppercase tracking-widest mb-4">Revenue</h3><div className="h-[200px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={revenueLabelled} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}><XAxis dataKey="label" tick={{ fill: "#555", fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#555", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => "$" + Math.round(Number(v))} width={50} /><Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(212,175,55,0.05)" }} /><Bar dataKey="amount" radius={[4, 4, 0, 0]}>{revenueLabelled.map((d, i) => (<Cell key={i} fill={d.amount > 0 ? ACCENT : "#1a1a1a"} />))}</Bar></BarChart></ResponsiveContainer></div></div>
                  <div className="bg-[#0a0a0a] border border-[#D4AF37]/10 rounded-xl p-6"><h3 className="text-xs font-bold text-[#D4AF37]/60 uppercase tracking-widest mb-4">Daily Active Users</h3><div className="h-[200px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={dauLabelled} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}><XAxis dataKey="label" tick={{ fill: "#555", fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#555", fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} /><Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(212,175,55,0.05)" }} /><Bar dataKey="count" radius={[4, 4, 0, 0]}>{dauLabelled.map((_, i) => (<Cell key={i} fill={i === dauLabelled.length - 1 ? ACCENT : "#1a1a1a"} />))}</Bar></BarChart></ResponsiveContainer></div></div>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white">User Registry ({users.length})</h2>
                <div className="bg-[#0a0a0a] border border-[#D4AF37]/10 rounded-xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="text-[#D4AF37]/40 uppercase tracking-widest border-b border-[#D4AF37]/5 bg-black/50"><th className="px-6 py-4 font-bold">Email</th><th className="px-6 py-4 font-bold">Joined</th><th className="px-6 py-4 font-bold">Last Sync</th><th className="px-6 py-4 font-bold">Tier</th><th className="px-6 py-4 font-bold">Credits</th><th className="px-6 py-4 font-bold">Calls</th></tr></thead><tbody className="divide-y divide-[#D4AF37]/5">{users.map((u) => (<tr key={u.id} onClick={() => setSelectedUser(u)} className="hover:bg-[#D4AF37]/10 transition-colors group cursor-pointer"><td className="px-6 py-4 text-white font-medium">{u.email || "ANON_NODE"}<span className="ml-2 text-xs text-[#D4AF37]/0 group-hover:text-[#D4AF37]/60 transition-opacity">→</span></td><td className="px-6 py-4 text-gray-500">{fmtDate(u.created_at)}</td><td className="px-6 py-4 text-gray-500">{fmtDate(u.last_sign_in_at)}</td><td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold uppercase ${u.tier === 'pro' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-gray-900 text-gray-500'}`}>{u.tier}</span></td><td className="px-6 py-4 text-gray-400">{u.credits}</td><td className="px-6 py-4 text-gray-400">{u.ai_calls}</td></tr>))}</tbody></table></div></div>
              </div>
            )}

            {activeTab === 'bugs' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-white">Bug Reports ({bugs.length})</h2><div className="flex items-center gap-2">{(["new", "seen", "fixed", "all"] as const).map(f => (<button key={f} onClick={() => setBugFilter(f)} className={`text-xs uppercase tracking-widest px-3 py-1 rounded transition-colors ${bugFilter === f ? "bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40" : "text-gray-500 border border-transparent hover:text-[#D4AF37]"}`}>{f}</button>))}</div></div>
                <div className="bg-[#0a0a0a] border border-[#D4AF37]/10 rounded-xl overflow-hidden">{bugs.length === 0 ? (<div className="p-8 text-center text-gray-600 text-sm">No bugs. System quiet.</div>) : (<div className="divide-y divide-[#D4AF37]/5">{bugs.map(b => (<div key={b.id} className="p-4 hover:bg-[#D4AF37]/5 transition-colors"><div className="flex items-start justify-between gap-4 mb-2"><div className="flex items-center gap-2 text-[10px] uppercase tracking-widest"><span className={b.status === "fixed" ? "text-green-500/70 border border-green-500/30 px-1.5 py-0.5 rounded" : b.status === "seen" ? "text-yellow-500/70 border border-yellow-500/30 px-1.5 py-0.5 rounded" : "text-red-500 border border-red-500/40 px-1.5 py-0.5 rounded"}>{b.status}</span><span className="text-[#D4AF37]/70">{b.source}</span></div><div className="text-[10px] text-gray-600">{new Date(b.created_at).toLocaleString()}</div></div><div className="text-sm text-white mb-2">{b.message}</div><div className="flex gap-2">{b.status !== "seen" && (<button onClick={() => markBug(b.id, "seen")} className="text-[10px] uppercase tracking-widest px-2 py-1 border border-[#D4AF37]/20 text-[#D4AF37]/70 hover:bg-[#D4AF37]/10 rounded">Mark Seen</button>)}{b.status !== "fixed" && (<button onClick={() => markBug(b.id, "fixed")} className="text-[10px] uppercase tracking-widest px-2 py-1 border border-green-500/30 text-green-500/80 hover:bg-green-500/10 rounded">Mark Fixed</button>)}</div></div>))}</div>)}</div>
              </div>
            )}

            {activeTab === 'agents' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-white">Agent Control</h2>
                <AgentControl themeColor="reactor-orange" activeDeploying={loading} tasks={tasks} onDeployAgent={() => {}} onReadAloud={() => {}} />
                <ConsoleTerminal logs={logs} themeColor="reactor-orange" onManualCommand={(cmd) => { addLog(`[USER] ${cmd}`); if (cmd === "refresh") fetchStats(); else if (cmd === "clear") setLogs([]); else addLog(`[Genius] Command unrecognized.`); }} />
              </div>
            )}
          </div>
        </div>
      </div>

      <UserDrillModal user={selectedUser} onClose={() => setSelectedUser(null)} />
    </div>
  );
}

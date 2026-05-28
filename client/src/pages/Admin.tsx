/**
 * /admin — Genius Neural HUD Command Center (Chamillion Collective)
 *
 * An immersive, Iron Man-style holographic dashboard that displays
 * live user activity, revenue, and system telemetry.
 */
import { useEffect, useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  BarChart, Bar
} from "recharts";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert, RefreshCw, Home, LogOut,
  ChevronUp, ChevronDown, Search
} from "lucide-react";

// Genius Components
import UserDrillModal from "@/components/genius/UserDrillModal";

import GeniusHUD from "@/components/genius/GeniusHUD";
import ConsoleTerminal from "@/components/genius/ConsoleTerminal";
import SystemWidget from "@/components/genius/SystemWidget";
import AgentControl from "@/components/genius/AgentControl";
import { sfx } from "@/lib/geniusAudio";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeatureUsageRow { action: string; count: number; credits: number; }
interface DauRow          { date: string;   count: number; }
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

// ── Custom tooltip ────────────────────────────────────────────────────────────

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
      {/* Background HUD elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(circle, #D4AF37 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#0a0a0a] border border-[#D4AF37]/30 rounded-2xl p-10 relative z-10 shadow-[0_0_50px_rgba(212,175,55,0.1)]"
      >
        <div className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-[0.3em] mb-4">
          Chamillion Collective
        </div>
        <h1 className="text-3xl font-bold mb-2 tracking-tight">Genius HUD</h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          Initialize neural linkage to access the command center. Admin credentials required.
        </p>

        <button
          onClick={onGoogle}
          disabled={signingIn}
          className="w-full py-4 px-6 bg-[#D4AF37] hover:bg-[#B8962E] text-black rounded-xl font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-wait"
        >
          <svg width="20" height="20" viewBox="0 0 18 18">
            <path fill="currentColor" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="currentColor" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="currentColor" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
            <path fill="currentColor" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"/>
          </svg>
          {signingIn ? "INITIALIZING..." : "CONNECT NEURAL LINK"}
        </button>

        {error && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 text-center"
          >
            {error}
          </motion.div>
        )}

        <div className="mt-8 pt-8 border-t border-[#D4AF37]/10 flex justify-center">
          <a href="/" className="text-[10px] text-gray-600 hover:text-[#D4AF37] transition-colors uppercase tracking-widest">
            Return to Surface
          </a>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Dashboard component ──────────────────────────────────────────────────

export default function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [stats, setStats]     = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  
  // HUD States
  const [hudState, setHudState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [isWarmingUp, setIsWarmingUp] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Date range, table, drill-down
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all'>('30d');
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [sortColumn, setSortColumn] = useState<keyof UserRow | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [userSearch, setUserSearch] = useState('');

  // Audio setup
  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // Track Supabase session
  useEffect(function() {
    supabase.auth.getSession().then(function(r) {
      setSession(r.data.session);
      setSessionLoading(false);
    });
    const sub = supabase.auth.onAuthStateChange(function(_e, s) {
      setSession(s);
    });
    return function() { sub.data.subscription.unsubscribe(); };
  }, []);

  // Fetch stats
  const fetchStats = useCallback(async function() {
    if (!session) return;
    setLoading(true);
    setHudState('thinking');
    addLog("[SYSTEM] Querying neural database for user telemetry...");

    try {
      const res = await fetch(`/api/admin-stats?range=${dateRange}`, {
        headers: { Authorization: "Bearer " + session.access_token },
      });
      if (!res.ok) {
        const body = await res.json().catch(function() { return {}; });
        if (res.status === 403) {
          setError("This account isn't authorized to view the dashboard.");
          addLog("[CRITICAL] Access denied. Unauthorized signature detected.");
        } else {
          setError(body.error ?? "HTTP " + res.status);
          addLog(`[FAIL] Data retrieval failed: ${res.status}`);
        }
        return;
      }
      const data = await res.json();
      setStats(data);
      addLog(`[SUCCESS] Synchronized data for ${data.overview.total_users} active nodes.`);
      sfx.playBeep(600, 0.1);
    } catch (e: any) {
      setError(e?.message ?? "Network error");
      addLog(`[ERROR] Connection timeout in neural bridge.`);
    } finally {
      setLoading(false);
      setHudState('idle');
    }
  }, [session, dateRange]);

  useEffect(function() {
    if (session) {
      fetchStats();
      // Startup sequence
      setTimeout(() => {
        setIsWarmingUp(false);
        sfx.playStartup();
        addLog("[BOOT] Genius Neural HUD v4.2 Online.");
        addLog("[INFO] Chamillion Collective secure link established.");
      }, 1500);
    }
  }, [session, fetchStats]);

  // ── Sign-in flow ───────────────────────────────────────────────────────────
  const handleGoogle = useCallback(async function() {
    setSigningIn(true);
    setError(null);
    const { error: oerr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/admin" },
    });
    if (oerr) {
      setError(oerr.message);
      setSigningIn(false);
    }
  }, []);

  const handleSignOut = useCallback(async function() {
    sfx.playBeep(400, 0.1);
    await supabase.auth.signOut();
    setSession(null);
    setStats(null);
    setError(null);
  }, []);

  // ── Agent Control ──────────────────────────────────────────────────────────
  const handleDeployAgent = async (taskName: string, agentType: 'researcher' | 'coder' | 'social' | 'analyst') => {
    setLoading(true);
    setHudState('thinking');
    addLog(`[AGENT] Deploying ${agentType} node for task: ${taskName}`);
    
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      name: taskName,
      status: 'running',
      logs: [`[BOOT] Agent initialized.`, `[INFO] Connecting to neural matrix...`],
      agentType,
      timestamp: new Date().toISOString()
    };
    setTasks(prev => [newTask, ...prev]);

    try {
      // Mock agent logic for now - in a real app, this would call an API
      setTimeout(() => {
        setTasks(prev => prev.map(t => t.id === newTask.id ? {
          ...t,
          status: 'completed',
          logs: [...t.logs, `[SUCCESS] Task analysis complete.`, `[INFO] Summarizing findings...`],
          summary: `Genius has analyzed the Dumpster user data. Growth is trending at 12% WoW. Recommended move: Optimize caption generation for the 'Minimalist' aesthetic.`
        } : t));
        addLog(`[AGENT] ${agentType} task completed successfully.`);
        setLoading(false);
        setHudState('idle');
      }, 3000);
    } catch (e) {
      setTasks(prev => prev.map(t => t.id === newTask.id ? { ...t, status: 'failed', logs: [...t.logs, `[ERROR] Synaptic failure.`] } : t));
      setLoading(false);
      setHudState('idle');
    }
  };

  const handleReadAloud = async (text: string) => {
    setHudState('speaking');
    addLog(`[Genius] Synthesizing voice output...`);
    
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => setHudState('idle');
        audio.play();
      } else {
        addLog(`[ERROR] Voice synthesis failed.`);
        setHudState('idle');
      }
    } catch (e) {
      addLog(`[ERROR] Audio bridge connection failure.`);
      setHudState('idle');
    }
  };

  // ── Table sort ────────────────────────────────────────────────────────────
  const handleSort = (col: keyof UserRow) => {
    if (sortColumn === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDir('desc');
    }
  };

  // ── Render: session loading ────────────────────────────────────────────────
  if (sessionLoading || (session && isWarmingUp)) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-[#D4AF37] font-mono">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-2 border-t-transparent border-[#D4AF37] rounded-full mb-4"
        />
        <div className="text-[10px] tracking-[0.5em] uppercase animate-pulse">
          Warming Core...
        </div>
      </div>
    );
  }

  // ── Render: no session → sign-in screen ────────────────────────────────────
  if (!session) {
    return <SignInScreen onGoogle={handleGoogle} signingIn={signingIn} error={error} />;
  }

  // ── Render: signed in but error (likely 403 not authorized) ────────────────
  if (error) {
    const notAuthorized = error.includes("authorized");
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 font-mono">
        <div className="w-full max-w-md bg-[#0a0a0a] border border-red-500/30 rounded-2xl p-8 text-white">
          <div className="flex items-center gap-3 text-red-500 mb-6">
            <ShieldAlert className="w-6 h-6" />
            <h2 className="text-xl font-bold uppercase tracking-tight">Security Breach</h2>
          </div>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">
            {notAuthorized
              ? `Unauthorized access attempt by ${session.user.email}. This signature is not in the Chamillion Collective admin registry.`
              : error}
          </p>
          <div className="flex gap-4">
            <button
              onClick={fetchStats}
              className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-xl font-bold transition-all text-xs uppercase"
            >
              Retry Sync
            </button>
            <button
              onClick={handleSignOut}
              className="flex-1 py-3 bg-gray-900 hover:bg-gray-800 text-gray-400 border border-gray-800 rounded-xl font-bold transition-all text-xs uppercase"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const { overview, feature_usage, dau, users } = stats;

  // Filter + sort user table
  const filteredUsers = users
    .filter(u => !userSearch || u.email.toLowerCase().includes(userSearch.toLowerCase()))
    .sort((a, b) => {
      if (!sortColumn) return 0;
      const aVal = a[sortColumn] ?? "";
      const bVal = b[sortColumn] ?? "";
      const dir = sortDir === 'asc' ? 1 : -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * dir;
      }
      return ((aVal as number) - (bVal as number)) * dir;
    });

  const dauLabelled = dau.map(d => ({
    ...d,
    label: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  const featureLabelled = feature_usage.map(f => ({
    ...f,
    label: fmtAction(f.action),
  }));

  return (
    <div className="min-h-screen bg-black text-[#D4AF37] font-mono selection:bg-[#D4AF37] selection:text-black overflow-x-hidden">
      
      {/* Top Navigation Bar */}
      <div className="h-16 border-b border-[#D4AF37]/10 flex items-center justify-between px-8 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#D4AF37] rounded-full animate-pulse" />
            <span className="text-xs font-bold tracking-[0.4em] uppercase">Genius_v4.2</span>
          </div>
          <div className="h-4 w-[1px] bg-[#D4AF37]/20" />
          <div className="text-[10px] text-[#D4AF37]/50 uppercase tracking-widest">
            Chamillion Collective Neural Link
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={fetchStats} className="p-2 hover:bg-[#D4AF37]/10 rounded-lg transition-colors group">
            <RefreshCw className="w-4 h-4 group-active:rotate-180 transition-transform duration-500" />
          </button>
          <a href="/" className="p-2 hover:bg-[#D4AF37]/10 rounded-lg transition-colors">
            <Home className="w-4 h-4" />
          </a>
          <button onClick={handleSignOut} className="p-2 hover:bg-red-500/10 text-red-500/60 hover:text-red-500 rounded-lg transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-8 grid grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Main HUD & Stats */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          
          {/* Central Genius HUD Component */}
          <div className="bg-[#050505] border border-[#D4AF37]/20 rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(212,175,55,0.05)]">
            <GeniusHUD state={hudState} isOnline={true} />
          </div>

          {/* Overview Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total Users", value: overview.total_users },
              { label: "Active Today", value: overview.active_today },
              { label: "Active Week", value: overview.active_week },
              { label: "AI Calls", value: overview.ai_calls_today },
              { label: "Credits", value: overview.credits_spent_today },
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#0a0a0a] border border-[#D4AF37]/10 p-4 rounded-2xl"
              >
                <div className="text-[9px] text-[#D4AF37]/40 uppercase tracking-widest mb-1">{stat.label}</div>
                <div className="text-2xl font-bold text-white tracking-tight">{stat.value}</div>
              </motion.div>
            ))}
          </div>

          {/* Holographic Date Range Selector */}
          <div className="flex items-center gap-3">
            <div className="text-[9px] text-[#D4AF37]/30 uppercase tracking-[0.3em] font-bold">Time Range</div>
            <div className="flex items-center gap-1 bg-[#0a0a0a] border border-[#D4AF37]/15 rounded-xl p-1">
              {([
                { key: '7d',  label: '7 Days' },
                { key: '30d', label: '30 Days' },
                { key: 'all', label: 'All Time' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setDateRange(key); addLog(`[SYSTEM] Range filter → ${label}`); }}
                  className={`relative px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all duration-300 ${
                    dateRange === key
                      ? 'text-black bg-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.4)]'
                      : 'text-[#D4AF37]/40 hover:text-[#D4AF37]/70'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {loading && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 border border-t-transparent border-[#D4AF37]/40 rounded-full"
              />
            )}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* DAU Chart */}
            <div className="bg-[#0a0a0a] border border-[#D4AF37]/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="text-[10px] text-[#D4AF37]/60 uppercase tracking-[0.2em] font-bold">Neural Activity (DAU)</div>
                <div className="text-[10px] text-gray-600 uppercase">
                  {dateRange === '7d' ? 'Last 7 Days' : dateRange === 'all' ? 'Last 30 Days' : 'Last 14 Days'}
                </div>
              </div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dauLabelled}>
                    <XAxis dataKey="label" hide />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(212,175,55,0.05)" }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {dauLabelled.map((_, i) => (
                        <Cell key={i} fill={i === dauLabelled.length - 1 ? ACCENT : "#1a1a1a"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Feature Usage Chart */}
            <div className="bg-[#0a0a0a] border border-[#D4AF37]/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="text-[10px] text-[#D4AF37]/60 uppercase tracking-[0.2em] font-bold">Synaptic Load (Features)</div>
                <div className="text-[10px] text-gray-600 uppercase">
                  {dateRange === '7d' ? 'Last 7 Days' : dateRange === 'all' ? 'All Time' : 'Last 30 Days'}
                </div>
              </div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={featureLabelled}>
                    <XAxis dataKey="label" hide />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="count" stroke={ACCENT} strokeWidth={3} dot={{ fill: ACCENT, r: 4 }} activeDot={{ r: 6, stroke: '#000', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* User Registry Table */}
          <div className="bg-[#0a0a0a] border border-[#D4AF37]/10 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-[#D4AF37]/10 flex items-center justify-between gap-4">
              <div className="text-[10px] text-[#D4AF37]/60 uppercase tracking-[0.2em] font-bold flex-shrink-0">
                Neural Registry ({filteredUsers.length}/{users.length} Nodes)
              </div>
              {/* Search filter */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-[#D4AF37]/30 pointer-events-none" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Filter by email..."
                  className="w-full bg-[#060606] border border-[#D4AF37]/10 rounded-lg pl-8 pr-3 py-1.5 text-[10px] text-gray-300 placeholder-gray-700 focus:outline-none focus:border-[#D4AF37]/30 transition-colors"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="text-[#D4AF37]/40 uppercase tracking-widest border-b border-[#D4AF37]/5">
                    {([
                      { key: 'email',           label: 'Email' },
                      { key: 'created_at',      label: 'Joined' },
                      { key: 'last_sign_in_at', label: 'Last Sync' },
                      { key: 'tier',            label: 'Tier' },
                      { key: 'credits',         label: 'Credits' },
                      { key: 'ai_calls',        label: 'Calls' },
                    ] as { key: keyof UserRow; label: string }[]).map(({ key, label }) => (
                      <th
                        key={key}
                        className="px-6 py-4 font-bold cursor-pointer hover:text-[#D4AF37]/70 transition-colors select-none"
                        onClick={() => handleSort(key)}
                      >
                        <div className="flex items-center gap-1.5">
                          {label}
                          <span className="opacity-40">
                            {sortColumn === key
                              ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
                              : <ChevronDown className="w-3 h-3 opacity-30" />}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D4AF37]/5">
                  {filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-[#D4AF37]/5 transition-colors group cursor-pointer"
                      onClick={() => { setSelectedUser(u); sfx.playBeep(700, 0.05); }}
                    >
                      <td className="px-6 py-4 text-white font-bold group-hover:text-[#D4AF37] transition-colors">
                        {u.email || "ANON_NODE"}
                      </td>
                      <td className="px-6 py-4 text-gray-500">{fmtDate(u.created_at)}</td>
                      <td className="px-6 py-4 text-gray-500">{fmtDate(u.last_sign_in_at)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${u.tier === 'pro' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-gray-900 text-gray-500'}`}>
                          {u.tier}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400">{u.credits}</td>
                      <td className="px-6 py-4 text-gray-400">{u.ai_calls}</td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-700 text-[10px] uppercase tracking-widest">
                        No nodes match filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Terminal & Controls */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          
          {/* Neural Terminal */}
          <ConsoleTerminal 
            logs={logs} 
            themeColor="reactor-orange" 
            onManualCommand={(cmd) => {
              addLog(`[USER] ${cmd}`);
              if (cmd === "refresh") fetchStats();
              else if (cmd === "clear") setLogs([]);
              else addLog(`[Genius] Command unrecognized. Awaiting valid neural input.`);
            }} 
          />

          {/* System Telemetry */}
          <SystemWidget 
            themeColor="reactor-orange"
            metrics={{
              coreTemp: 42,
              arcReactorPercent: 99.8,
              cpuUsage: 12,
              memoryUsage: 24,
              synapseLatency: 18,
              satelliteStatus: 'online'
            }}
          />

          {/* Agent Workspace */}
          <AgentControl 
            themeColor="reactor-orange"
            activeDeploying={loading}
            tasks={tasks}
            onDeployAgent={handleDeployAgent}
            onReadAloud={handleReadAloud}
          />

        </div>
      </div>

      {/* User Drill-Down side panel (fixed overlay) */}
      {selectedUser && session && (
        <UserDrillModal
          userId={selectedUser.id}
          userEmail={selectedUser.email}
          userTier={selectedUser.tier}
          userCredits={selectedUser.credits}
          sessionToken={session.access_token}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}

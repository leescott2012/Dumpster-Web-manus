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
  Terminal, Shield, Zap,
  ShieldAlert, RefreshCw, Home, LogOut, Volume2, VolumeX
} from "lucide-react";

// Genius Components
import GeniusHUD from "@/components/genius/GeniusHUD";
import ConsoleTerminal from "@/components/genius/ConsoleTerminal";
import SystemWidget from "@/components/genius/SystemWidget";
import AgentControl from "@/components/genius/AgentControl";
import { sfx } from "@/lib/geniusAudio";
import { isMuted, setMuted, onMuteChange } from "@/utils/audioSynth";

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

  // Global mute — persists in localStorage. Silences SFX + TTS (ElevenLabs
  // and browser SpeechSynthesis). Mirror state into React so the button icon
  // can re-render when toggled.
  const [muted, setMutedState] = useState<boolean>(isMuted());
  useEffect(() => {
    return onMuteChange(setMutedState);
  }, []);
  const toggleMute = useCallback(() => {
    setMuted(!isMuted());
  }, []);

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
      const res = await fetch("/api/admin-stats", {
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
  }, [session]);

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

  // ── Voice synthesis (ElevenLabs → browser TTS fallback) ────────────────────
  // Returns a Promise that resolves when audio finishes (or fails silently).
  // Falls back to browser SpeechSynthesis when /api/tts fails (free-tier ElevenLabs
  // 402, missing key, network error, etc.) so the assistant always speaks.
  const handleReadAloud = useCallback(async (text: string): Promise<void> => {
    // Honor global mute — no SFX, no ElevenLabs, no browser TTS.
    // Reply text still ends up in the terminal log so you can read it.
    if (isMuted()) {
      addLog(`[Genius] (muted) ${text}`);
      setHudState('idle');
      return;
    }
    setHudState('speaking');
    addLog(`[Genius] Synthesizing voice output...`);

    const speakWithBrowser = (): Promise<void> => new Promise((resolve) => {
      if (!('speechSynthesis' in window)) { resolve(); return; }
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.05; u.pitch = 1.0; u.volume = 1.0;
        const voices = window.speechSynthesis.getVoices();
        const pref = voices.find(v => /Daniel|Alex|Samantha|Karen|Google US English/i.test(v.name));
        if (pref) u.voice = pref;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      } catch { resolve(); }
    });

    return new Promise(async (resolve) => {
      try {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        if (response.ok && (response.headers.get('content-type') || '').startsWith('audio/')) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => { setHudState('idle'); URL.revokeObjectURL(url); resolve(); };
          audio.onerror = async () => { URL.revokeObjectURL(url); await speakWithBrowser(); setHudState('idle'); resolve(); };
          void audio.play().catch(async () => { await speakWithBrowser(); setHudState('idle'); resolve(); });
          return;
        }

        // ElevenLabs unavailable (free-tier 402, missing key, etc.) → browser TTS
        addLog(`[WARN] ElevenLabs unavailable — using local voice.`);
        await speakWithBrowser();
        setHudState('idle');
        resolve();
      } catch {
        addLog(`[WARN] TTS bridge failure — using local voice.`);
        await speakWithBrowser();
        setHudState('idle');
        resolve();
      }
    });
  }, []);

  // ── Voice conversation (orb click → STT → genius-chat → TTS → loop) ───────
  // The orb at GeniusHUD.tsx exposes onTalk; clicking it fires this. We start
  // browser SpeechRecognition, send the transcript to /api/genius-chat with
  // current stats so it can answer with specifics, then speak the reply via
  // handleReadAloud (ElevenLabs or browser TTS).
  const handleTalk = useCallback(() => {
    if (hudState !== 'idle') return;

    const SR = (window as unknown as {
      SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any;
    }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!SR) {
      addLog("[ERROR] Voice input unsupported on this browser. Use Chrome or Safari.");
      return;
    }

    setHudState('listening');
    addLog("[Genius] Listening. Speak now.");
    sfx.playBeep?.(880, 0.08);

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";

    let finished = false;
    const finish = (transcript: string | null) => {
      if (finished) return; finished = true;
      try { rec.stop(); } catch { /* noop */ }

      if (!transcript) { setHudState('idle'); return; }

      addLog(`[USER] ${transcript}`);
      setHudState('thinking');

      void (async () => {
        try {
          if (!session) { addLog("[ERROR] Session expired."); setHudState('idle'); return; }
          const res = await fetch("/api/genius-chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + session.access_token,
            },
            body: JSON.stringify({ transcript, stats }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            addLog(`[ERROR] ${body.error || res.status}`);
            setHudState('idle');
            return;
          }
          const reply: string = body.reply || "(no reply)";
          addLog(`[GENIUS] ${reply}`);
          await handleReadAloud(reply);
        } catch (e: any) {
          addLog(`[ERROR] Neural bridge: ${e?.message || e}`);
          setHudState('idle');
        }
      })();
    };

    rec.onresult = (e: any) => {
      const t = e?.results?.[0]?.[0]?.transcript?.trim?.() || "";
      finish(t || null);
    };
    rec.onerror = (e: any) => {
      const err = e?.error;
      if (err && err !== "no-speech" && err !== "aborted") {
        addLog(`[ERROR] Mic: ${err}`);
      }
      finish(null);
    };
    rec.onend = () => { if (!finished) finish(null); };

    try { rec.start(); } catch (e: any) {
      addLog(`[ERROR] Mic start failed: ${e?.message || e}`);
      setHudState('idle');
    }
  }, [hudState, session, stats, handleReadAloud]);

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

  const { overview, feature_usage, dau, users, revenue } = stats;

  const dauLabelled = dau.map(d => ({
    ...d,
    label: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  const featureLabelled = feature_usage.map(f => ({
    ...f,
    label: fmtAction(f.action),
  }));

  // Revenue chart data — same x-axis cadence as DAU so they line up visually.
  const revenueLabelled = (revenue?.daily ?? []).map(d => ({
    ...d,
    label: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    amount: d.amount_cents / 100, // chart wants a "natural" axis, not cents
  }));

  // Currency formatter — handles cents → "$X.XX" / "$X,XXX"
  const fmtMoney = (cents: number) => {
    const dollars = (cents || 0) / 100;
    const code = (revenue?.currency ?? "usd").toUpperCase();
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: code, maximumFractionDigits: dollars >= 100 ? 0 : 2 }).format(dollars);
    } catch {
      return "$" + dollars.toFixed(2);
    }
  };

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
          <button
            onClick={toggleMute}
            title={muted ? "Unmute audio" : "Mute audio"}
            className={`p-2 rounded-lg transition-colors ${muted ? "text-red-500/70 hover:bg-red-500/10" : "hover:bg-[#D4AF37]/10"}`}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
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
            <GeniusHUD state={hudState} isOnline={true} onTalk={handleTalk} />
          </div>

          {/* Overview Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[
              { label: "Total Users", value: String(overview.total_users) },
              { label: "Active Today", value: String(overview.active_today) },
              { label: "Active Week", value: String(overview.active_week) },
              { label: "AI Calls", value: String(overview.ai_calls_today) },
              { label: "Credits", value: String(overview.credits_spent_today) },
              { label: "Revenue Today", value: fmtMoney(revenue?.today_cents ?? 0) },
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

          {/* Revenue Chart — full-width row above the DAU/Feature pair */}
          <div className="bg-[#0a0a0a] border border-[#D4AF37]/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-[#D4AF37]/60 uppercase tracking-[0.2em] font-bold">
                Revenue Stream {revenue?.source === "unavailable" && (
                  <span className="ml-2 text-gray-600 normal-case tracking-normal">— Stripe key missing or offline</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-[10px] uppercase">
                <span className="text-gray-600">Week: <span className="text-white">{fmtMoney(revenue?.week_cents ?? 0)}</span></span>
                <span className="text-gray-600">Month: <span className="text-white">{fmtMoney(revenue?.month_cents ?? 0)}</span></span>
                <span className="text-gray-600">All-time: <span className="text-white">{fmtMoney(revenue?.total_cents ?? 0)}</span></span>
              </div>
            </div>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueLabelled} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                  <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#555", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => "$" + Math.round(Number(v))} width={50} />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: "rgba(212,175,55,0.05)" }}
                    formatter={(value: number) => fmtMoney(Math.round(Number(value) * 100))}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {revenueLabelled.map((d, i) => (
                      <Cell key={i} fill={d.amount > 0 ? ACCENT : "#1a1a1a"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* DAU Chart */}
            <div className="bg-[#0a0a0a] border border-[#D4AF37]/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="text-[10px] text-[#D4AF37]/60 uppercase tracking-[0.2em] font-bold">Neural Activity (DAU)</div>
                <div className="text-[10px] text-gray-600 uppercase">Last 14 Days</div>
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
                <div className="text-[10px] text-gray-600 uppercase">Last 30 Days</div>
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
            <div className="p-6 border-b border-[#D4AF37]/10 flex items-center justify-between">
              <div className="text-[10px] text-[#D4AF37]/60 uppercase tracking-[0.2em] font-bold">Neural Registry ({users.length} Nodes)</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="text-[#D4AF37]/40 uppercase tracking-widest border-b border-[#D4AF37]/5">
                    <th className="px-6 py-4 font-bold">Email</th>
                    <th className="px-6 py-4 font-bold">Joined</th>
                    <th className="px-6 py-4 font-bold">Last Sync</th>
                    <th className="px-6 py-4 font-bold">Tier</th>
                    <th className="px-6 py-4 font-bold">Credits</th>
                    <th className="px-6 py-4 font-bold">Calls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D4AF37]/5">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#D4AF37]/5 transition-colors group">
                      <td className="px-6 py-4 text-white font-bold">{u.email || "ANON_NODE"}</td>
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
    </div>
  );
}

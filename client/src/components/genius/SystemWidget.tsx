/**
 * Ops telemetry panel — every number here is REAL (from /api/admin-stats or a
 * live ping). It used to show randomly-fluctuating fake gauges ("core temp",
 * "reactor fuel", "neural CPU") and claimed Gemini on Cloud Run; the app runs
 * on Vercel serverless with Claude. Only the styling is decorative now.
 */
import { Gauge, Cpu, HardDrive, Wifi, Activity, RotateCw } from "lucide-react";

export interface OpsData {
  spend_cents: number;
  budget_cents: number;
  calls_by_action: Record<string, number>;
  source: "redis" | "unavailable";
}

interface FeatureRow { action: string; count: number; refunds: number; }

interface SystemWidgetProps {
  ops: OpsData | undefined;
  features: FeatureRow[];
  creditsSpentToday: number;
  creditsRefundedToday: number;
  latencyMs: number | null;
  pingOk: boolean | null;
  onPing: () => void;
}

const FEATURE_LABELS: Record<string, string> = {
  ai_suggest: "Auto Gen", ai_caption: "Caption", ai_chat: "Valet",
  ai_label: "Labels", ai_label_auto: "Free Labels", ig_scrub: "IG Scrub", ai_recycle: "Recycle",
};

// Mirrors server/rateLimit.ts ai_label_auto_daily (per user, rolling 24h).
const FREE_LABEL_IMAGES_PER_USER = 60;

function Tile({ icon: Icon, label, value, sub, pct, warn }: {
  icon: typeof Gauge; label: string; value: string; sub: string; pct?: number; warn?: boolean;
}) {
  return (
    <div className="p-3.5 rounded-xl border border-slate-900 bg-slate-950/60 flex flex-col justify-between items-start min-w-0">
      <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400 uppercase tracking-widest leading-none">
        <Icon className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="my-2.5">
        <span className={`text-2xl font-mono font-black ${warn ? "text-rose-400" : "text-amber-400"}`}>{value}</span>
        <div className="text-[9px] font-mono text-slate-400 mt-0.5">{sub}</div>
      </div>
      {pct != null && (
        <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden" role="presentation">
          <div className={`h-full ${warn ? "bg-rose-500" : "bg-amber-500"}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
        </div>
      )}
    </div>
  );
}

export default function SystemWidget({
  ops, features, creditsSpentToday, creditsRefundedToday, latencyMs, pingOk, onPing,
}: SystemWidgetProps) {
  const live = ops?.source === "redis";
  const spendPct = ops && ops.budget_cents > 0 ? (ops.spend_cents / ops.budget_cents) * 100 : 0;
  const calls = ops?.calls_by_action ?? {};
  const callRows = Object.entries(calls)
    .filter(([k]) => !k.endsWith("_images"))
    .sort((a, b) => b[1] - a[1]);
  const totalCalls = callRows.reduce((s, [, n]) => s + n, 0);

  const charged = features.reduce((s, f) => s + f.count, 0);
  const refunded = features.reduce((s, f) => s + (f.refunds || 0), 0);
  const refundPct = charged > 0 ? (refunded / charged) * 100 : 0;

  const freeCalls = calls.ai_label_auto ?? 0;
  const freeImages = calls.ai_label_auto_images ?? 0;

  return (
    <section aria-labelledby="ops-telemetry-title" className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 space-y-4" id="system-hardware-monitoring">
      <div className="flex items-center justify-between border-b border-slate-800/50 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-amber-500" aria-hidden="true" />
          <div>
            <h2 id="ops-telemetry-title" className="text-sm font-mono font-bold text-slate-200">Genius OPS TELEMETRY</h2>
            <p className="text-[10px] font-mono text-slate-400">Live AI spend, usage and API health</p>
          </div>
        </div>
        <Wifi className={`w-4 h-4 ${pingOk === false ? "text-rose-500" : pingOk ? "text-emerald-400" : "text-slate-500"}`} aria-label={pingOk === false ? "API unreachable" : pingOk ? "API reachable" : "API not checked"} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Tile
          icon={Gauge}
          label="AI Spend · Today"
          value={live ? "$" + (ops!.spend_cents / 100).toFixed(2) : "—"}
          sub={live ? `of $${(ops!.budget_cents / 100).toFixed(0)}/day cap · UTC day · est.` : "Budget counter offline (Upstash)"}
          pct={live ? spendPct : undefined}
          warn={spendPct >= 80}
        />
        <Tile
          icon={HardDrive}
          label="Credits · 24h"
          value={String(creditsSpentToday)}
          sub={`net spent · ${creditsRefundedToday} refunded`}
        />
        <Tile
          icon={Cpu}
          label="Refund Rate · 30d"
          value={charged > 0 ? refundPct.toFixed(0) + "%" : "—"}
          sub={`${refunded} of ${charged} charged calls failed`}
          pct={charged > 0 ? refundPct : undefined}
          warn={refundPct >= 10}
        />
        <div className="p-3.5 rounded-xl border border-slate-900 bg-slate-950/60 flex flex-col justify-between items-start min-w-0">
          <div className="flex items-center justify-between w-full text-[9px] font-mono text-slate-400 uppercase tracking-widest leading-none">
            <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" aria-hidden="true" />API Latency</span>
            <button onClick={onPing} aria-label="Re-check API latency" className="p-1 -m-1 hover:text-amber-400">
              <RotateCw className="w-3 h-3" aria-hidden="true" />
            </button>
          </div>
          <div className="my-2.5">
            <span className={`text-2xl font-mono font-black ${pingOk === false ? "text-rose-400" : "text-slate-100"}`}>
              {pingOk === false ? "DOWN" : latencyMs != null ? `${latencyMs} ms` : "—"}
            </span>
            <div className="text-[9px] font-mono text-slate-400 mt-0.5 uppercase">Signed-in round trip</div>
          </div>
        </div>
      </div>

      <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-900 font-mono text-[10px] leading-relaxed text-slate-400 space-y-1">
        <div className="flex justify-between text-slate-300 uppercase tracking-widest text-[9px] pb-1">
          <span>AI calls today by feature</span><span>{live ? totalCalls : "—"}</span>
        </div>
        {!live && <div>Unavailable — UPSTASH_REDIS_REST_URL/TOKEN not set.</div>}
        {live && callRows.length === 0 && <div>No AI calls yet today (UTC).</div>}
        {callRows.map(([k, n]) => (
          <div key={k} className="flex justify-between">
            <span>{FEATURE_LABELS[k] ?? k}</span><span className="text-slate-200">{n}</span>
          </div>
        ))}
        {live && (
          <div className="flex justify-between pt-1 border-t border-slate-900">
            <span>Free auto-labels (images)</span>
            <span className="text-slate-200">{freeImages} · {freeCalls} req · cap {FREE_LABEL_IMAGES_PER_USER}/user/day</span>
          </div>
        )}
      </div>

      <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-900 font-mono text-[9px] leading-relaxed text-slate-400 space-y-1">
        <div className="flex justify-between gap-2"><span>HOST:</span><span className="text-slate-300 uppercase text-right">Vercel serverless</span></div>
        <div className="flex justify-between gap-2"><span>AI MODELS:</span><span className="text-slate-300 uppercase text-right">Anthropic Claude (Haiku / Sonnet vision)</span></div>
        <div className="flex justify-between gap-2"><span>DATA:</span><span className="text-slate-300 uppercase text-right">Supabase · Upstash Redis · Stripe</span></div>
      </div>
    </section>
  );
}

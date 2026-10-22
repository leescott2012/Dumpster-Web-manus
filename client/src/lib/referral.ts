/** Referral capture + claim. Code comes from `?ref=` on landing; claimed once after onboarding. */
import { getAuthHeaders } from "@/lib/supabase";

var KEY = "dumpster_ref_code";

export function captureReferral(): void {
  try {
    var code = new URLSearchParams(window.location.search).get("ref");
    if (code && /^[A-Za-z0-9]{4,32}$/.test(code)) localStorage.setItem(KEY, code);
  } catch { /* storage blocked — referral just isn't remembered */ }
}

export function referralLink(code: string): string {
  return window.location.origin + "/?ref=" + code;
}

/** Call after onboarding finishes. Clears the stored code once the server has answered definitively. */
export async function claimReferral(): Promise<void> {
  try {
    var code = localStorage.getItem(KEY);
    if (!code) return;
    var authH = await getAuthHeaders();
    var res = await fetch("/api/referral-claim", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, authH),
      body: JSON.stringify({ code: code }),
    });
    // Keep the code on 5xx (retry next time); drop it on any final answer.
    if (res.status < 500) localStorage.removeItem(KEY);
  } catch { /* offline — retried on next finish */ }
}

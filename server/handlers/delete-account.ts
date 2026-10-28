/**
 * POST /api/delete-account { confirm: "DELETE" } — self-service account
 * deletion (Apple guideline 5.1.1(v); web and iOS both call this).
 *
 * Order matters: cancel Stripe billing first (never leave someone paying for a
 * deleted account), then remove their storage objects and the rows whose FKs
 * don't cascade, then delete the auth user — which cascades profiles, credit
 * ledger, photos, dumps, social rows, notifications and activity_log.
 * Apple subscriptions can't be cancelled server-side; the clients tell the
 * user to cancel in iPhone Settings.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { getUserFromRequest } from "../creditGate.js";
import { enforceRateLimit } from "../rateLimit.js";
import { supabaseAdmin } from "../supabaseAdmin.js";
import { captureServerError } from "../sentry.js";

const BUCKET = "workspace-uploads";

async function removeFolder(prefix: string): Promise<void> {
  // list() pages at 100; loop until the folder is empty.
  for (let i = 0; i < 100; i++) {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(prefix, { limit: 100 });
    if (error) throw new Error("storage list: " + error.message);
    if (!data || data.length === 0) return;
    const { error: rmErr } = await supabaseAdmin.storage.from(BUCKET).remove(data.map((o) => prefix + "/" + o.name));
    if (rmErr) throw new Error("storage remove: " + rmErr.message);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Sign in required.", code: "auth_required" });
  if (!(await enforceRateLimit(req, res, "delete_account", userId))) return;
  if ((req.body || {}).confirm !== "DELETE") {
    return res.status(400).json({ error: "Confirmation missing.", code: "invalid_request" });
  }

  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_subscription_id")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
      try {
        await new Stripe(process.env.STRIPE_SECRET_KEY).subscriptions.cancel(profile.stripe_subscription_id);
      } catch (e: any) {
        // Already gone on Stripe's side is fine; anything else — stop, so we
        // never delete an account that's still being billed.
        if (e?.code !== "resource_missing") throw e;
      }
    }

    await removeFolder(userId);

    const { data: bugs } = await supabaseAdmin.from("bug_reports").select("screenshot_url").eq("user_id", userId);
    const shots = (bugs || [])
      .map((b: { screenshot_url: string | null }) => (b.screenshot_url || "").split("/" + BUCKET + "/")[1])
      .filter((p): p is string => !!p && p.startsWith("bug-reports/"));
    if (shots.length) await supabaseAdmin.storage.from(BUCKET).remove(shots);

    // Rows without ON DELETE CASCADE to auth.users / profiles.
    for (const [table, col] of [["bug_reports", "user_id"], ["user_workspaces", "id"], ["user_ai_profile", "user_id"]] as const) {
      const { error } = await supabaseAdmin.from(table).delete().eq(col, userId);
      if (error) throw new Error(table + " delete: " + error.message);
    }
    const { error: refErr } = await supabaseAdmin.from("profiles").update({ referred_by: null }).eq("referred_by", userId);
    if (refErr) throw new Error("referred_by clear: " + refErr.message);

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delErr) throw new Error("auth delete: " + delErr.message);

    return res.status(200).json({ ok: true });
  } catch (err) {
    captureServerError(err, "delete-account", { userId });
    if (!res.headersSent) {
      return res.status(500).json({ error: "Couldn't finish deleting your account. Please try again.", code: "delete_failed" });
    }
  }
}

/**
 * POST /api/referral-claim { code } — the invited friend finished onboarding;
 * pay the inviter REWARD credits. Fails closed: if the referral_rewards table
 * (supabase-referrals.sql) is missing, nobody is paid.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../creditGate.js";
import { addCredits, supabaseAdmin } from "../supabaseAdmin.js";
import { notify, usernameOf } from "../notify.js";

const REWARD = 10;
const MAX_REWARDS_PER_INVITER = 5;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const inviteeId = await getUserFromRequest(req);
  if (!inviteeId) return res.status(401).json({ error: "Sign in required" });
  const code = String((req.body || {}).code || "").trim().toLowerCase();
  if (!/^[a-z0-9]{4,32}$/.test(code)) return res.status(400).json({ error: "Invalid code" });

  const { data: invitee } = await supabaseAdmin
    .from("profiles").select("id, onboarding_completed_at").eq("id", inviteeId).maybeSingle();
  if (!invitee || !invitee.onboarding_completed_at) {
    return res.status(409).json({ error: "Finish setup first" });
  }
  const { data: inviter } = await supabaseAdmin
    .from("profiles").select("id").ilike("referral_code", code).maybeSingle();
  if (!inviter) return res.status(404).json({ error: "Unknown code" });
  if (inviter.id === inviteeId) return res.status(400).json({ error: "You can't invite yourself" });

  // Claim first (unique invitee_id = one reward per account, idempotent).
  const { error: claimErr } = await supabaseAdmin
    .from("referral_rewards")
    .insert({ inviter_id: inviter.id, invitee_id: inviteeId, amount: REWARD });
  if (claimErr) {
    if (claimErr.code === "23505") return res.json({ rewarded: false, reason: "already_claimed" });
    console.error("[referral-claim] claim failed:", claimErr.message);
    return res.status(503).json({ error: "Referral rewards aren't available yet" });
  }

  const release = () => supabaseAdmin.from("referral_rewards").delete().eq("invitee_id", inviteeId);
  const { count, error: cntErr } = await supabaseAdmin
    .from("referral_rewards").select("id", { count: "exact", head: true }).eq("inviter_id", inviter.id);
  if (cntErr || (count ?? 0) > MAX_REWARDS_PER_INVITER) {
    await release();
    return res.json({ rewarded: false, reason: cntErr ? "error" : "cap_reached" });
  }
  try {
    await addCredits(inviter.id, REWARD, "referral_reward");
  } catch (e) {
    console.error("[referral-claim] credit failed:", e);
    await release();
    return res.status(500).json({ error: "Reward failed" });
  }
  await supabaseAdmin.from("profiles").update({ referred_by: inviter.id }).eq("id", inviteeId);
  await notify({
    userId: inviter.id, type: "referral_reward", actorId: inviteeId, link: "/credits",
    title: "+" + REWARD + " credits: " + (await usernameOf(inviteeId)) + " joined with your invite",
    data: { amount: REWARD }, dedupeKey: "referral:" + inviteeId,
  });
  return res.json({ rewarded: true });
}

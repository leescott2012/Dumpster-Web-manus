/**
 * Credit system — costs per AI function, helpers
 *
 * Different AI features cost different credits.
 * Cheap models = fewer credits, premium models = more.
 */

// Server-side action names live in server/creditGate.ts COSTS. Keep these in
// sync — same key, same cost — or the local affordability check will lie.
// Entries marked "(planned)" don't have a server endpoint yet but are kept
// here so future UI work has the cost ready.
// 1 credit = ~1¢ of real AI cost. Costs mirror server/dailyBudget.ts COST_CENTS
// so we never charge a user fewer credits than the call costs us.
export var CREDIT_COSTS: Record<string, number> = {
  // Captions
  ai_caption: 3,             // Claude Haiku vision — generates 3 captions (~3¢)

  // Dump building
  ai_suggest: 25,            // Claude Haiku vision — clusters pool into a dump (~25¢)

  // Chat
  ai_chat: 1,                // Valet — chat to reorder / swap / set vibe (~1¢)

  // Planned — costs reserved for future endpoints (also ~1¢/credit)
  ai_caption_pro: 6,         // (planned) Sonnet caption upgrade
  ai_recycle: 3,             // (planned) AI pick replacement photo (~3¢)
  ai_vibe: 5,                // (planned) Vibe analysis
  ai_rescan_batch: 20,       // (planned) Batch rescan 10 photos
};

export var CREDIT_LABELS: Record<string, string> = {
  ai_caption: "AI Caption",
  ai_suggest: "Auto Gen Dump",
  ai_chat: "Valet",
  ai_caption_pro: "Pro Caption",
  ai_recycle: "AI Recycle Pick",
  ai_vibe: "Vibe Analysis",
  ai_rescan_batch: "Batch Rescan",
};

/** Credit packs available for purchase */
export var CREDIT_PACKS = [
  { id: "credits_30",   credits: 30,   price: 100,  label: "30 Credits",   tag: "Try it",      priceLabel: "$1.00" },
  { id: "credits_100",  credits: 100,  price: 199,  label: "100 Credits",  tag: "Quick fix",   priceLabel: "$1.99" },
  { id: "credits_500",  credits: 500,  price: 499,  label: "500 Credits",  tag: "Power user",  priceLabel: "$4.99" },
  { id: "credits_1500", credits: 1500, price: 999,  label: "1,500 Credits", tag: "Best value", priceLabel: "$9.99" },
];

/** Subscription plans */
export var SUBSCRIPTION_PLANS = [
  { id: "pro_monthly",  price: 599,  label: "Pro Monthly",  priceLabel: "$5.99/mo",  interval: "month" as const },
  { id: "pro_yearly",   price: 3499, label: "Pro Yearly",   priceLabel: "$34.99/yr", interval: "year" as const, badge: "Save 51%" },
  { id: "lifetime",     price: 1999, label: "Lifetime",     priceLabel: "$19.99",    interval: "once" as const, badge: "Early bird — first 1,000 users" },
];

/** Daily free credits by tier */
export var DAILY_FREE_CREDITS: Record<string, number> = {
  free: 15,
  pro: 200,
};

/** Check if user has enough credits for an action */
export function hasEnoughCredits(
  availableCredits: number,
  dailyRemaining: number,
  action: string
): boolean {
  var cost = CREDIT_COSTS[action] || 0;
  return (availableCredits + dailyRemaining) >= cost;
}

/** Deduct credits — uses daily first, then purchased */
export function deductCredits(
  availableCredits: number,
  dailyRemaining: number,
  action: string
): { newCredits: number; newDaily: number; cost: number } {
  var cost = CREDIT_COSTS[action] || 0;
  var fromDaily = Math.min(cost, dailyRemaining);
  var fromPurchased = cost - fromDaily;
  return {
    newCredits: availableCredits - fromPurchased,
    newDaily: dailyRemaining - fromDaily,
    cost: cost,
  };
}

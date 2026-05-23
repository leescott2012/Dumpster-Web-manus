/**
 * Credit system — costs per AI function, helpers
 *
 * Different AI features cost different credits.
 * Cheap models = fewer credits, premium models = more.
 */

export var CREDIT_COSTS: Record<string, number> = {
  // Captions
  ai_caption_casual: 1,      // Claude Haiku — cheap
  ai_caption_pro: 3,         // Claude Sonnet — premium

  // Dump building
  ai_suggest: 15,            // AI suggest dump (vision analysis)
  ai_recycle: 5,             // AI pick replacement photo

  // Chat & analysis
  ai_chat: 2,                // AI chat message
  ai_vibe: 5,                // Vibe analysis

  // Batch operations
  ai_rescan_batch: 20,       // Batch rescan 10 photos
};

export var CREDIT_LABELS: Record<string, string> = {
  ai_caption_casual: "Casual Caption",
  ai_caption_pro: "Pro Caption",
  ai_suggest: "AI Suggest Dump",
  ai_recycle: "AI Recycle Pick",
  ai_chat: "Valet",
  ai_vibe: "Vibe Analysis",
  ai_rescan_batch: "Batch Rescan",
};

/** Credit packs available for purchase */
export var CREDIT_PACKS = [
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

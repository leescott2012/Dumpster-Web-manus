/**
 * Pro plan: a monthly credit pool, not a daily refill. A credit costs us ~1¢,
 * so 300/month caps Pro's AI cost near $3 against ~$5.09 net of Apple's cut.
 * Used by the Stripe and Apple webhooks and iap-verify. No imports (shared by server + client).
 */
export var PRO_MONTHLY_CREDITS = 300;

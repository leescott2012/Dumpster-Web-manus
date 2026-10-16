/**
 * Paid AI Scan (ai_label) pricing — shared by server (creditGate via
 * api/ai-label.ts) and client (Scan confirm in Home.tsx). No imports, so both
 * sides can load it. 1 credit = ~1¢ of real AI cost.
 */
export var AI_LABEL_PER_PHOTO = 1;
/** Server processes at most this many photos per request (server/aiLabel.ts). */
export var AI_LABEL_MAX_PER_REQUEST = 12;

/** Credits for one paid ai_label request: 1/photo, min 1, max 12 (the server ignores photos past 12). */
export function aiLabelCost(images: number): number {
  var n = Math.floor(Number(images) || 0);
  return AI_LABEL_PER_PHOTO * Math.min(AI_LABEL_MAX_PER_REQUEST, Math.max(1, n));
}

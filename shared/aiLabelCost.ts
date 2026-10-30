/**
 * Paid AI Scan (ai_label) pricing — shared by server (creditGate via
 * api/ai-label.ts) and client (Scan confirm in Home.tsx). No imports, so both
 * sides can load it. 1 credit = ~1¢ of real AI cost.
 */
export var AI_LABEL_PER_PHOTO = 1;
/** Server processes at most this many photos per request (server/aiLabel.ts). */
export var AI_LABEL_MAX_PER_REQUEST = 12;

/**
 * One-time free scan per account, for the first upload. After this, scanning is
 * only the paid Scan button (1 credit/photo), tapped by the user — never automatic.
 * Counted server-side from activity_log (creditGate.checkAutoCredits).
 */
export var FREE_FIRST_SCAN_PHOTOS = 100;
export var FREE_SCAN_USED_CODE = "free_scan_used";

/** Free photos still available, given how many were already auto-scanned. */
export function freeScanLeft(used: number): number {
  return Math.max(0, FREE_FIRST_SCAN_PHOTOS - Math.max(0, Math.floor(Number(used) || 0)));
}

/** Credits for one paid ai_label request: 1/photo, min 1, max 12 (the server ignores photos past 12). */
export function aiLabelCost(images: number): number {
  var n = Math.floor(Number(images) || 0);
  return AI_LABEL_PER_PHOTO * Math.min(AI_LABEL_MAX_PER_REQUEST, Math.max(1, n));
}
